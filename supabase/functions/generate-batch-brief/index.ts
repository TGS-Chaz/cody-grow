// generate-batch-brief — grow-ops ambient brief for a single batch.
//
// Answers: "what's the story on this batch right now, and what should
// the operator do next?" Covers QA status, sales traction, age/turn,
// and adjustment events. Mirrors cache + timing shape of
// generate-contact-brief / generate-store-brief across the Cody suite.
//
// Request:  { batch_id: string, force_refresh?: boolean }
// Response: { brief, brief_data, signals, query_timings, cached,
//             generated_at, model, tokens_used }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL_ID = "claude-sonnet-4-20250514";
const SLOW_SIGNAL_MS = 3000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const requestStart = performance.now();
  const timings: Record<string, number> = {};

  async function timed<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
    const t0 = performance.now();
    try {
      const result = await fn();
      const dur = Math.round(performance.now() - t0);
      timings[`${name}_ms`] = dur;
      if (dur > SLOW_SIGNAL_MS) console.warn(`[generate-batch-brief] SLOW ${name}: ${dur}ms`);
      return result;
    } catch (err) {
      timings[`${name}_ms`] = Math.round(performance.now() - t0);
      console.error(`[generate-batch-brief] ${name} failed:`, err);
      return null;
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const batchId = body?.batch_id as string | undefined;
    const forceRefresh = Boolean(body?.force_refresh);
    if (!batchId) {
      return new Response(JSON.stringify({ error: "batch_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: memberships } = await supabase
      .from("org_members").select("org_id").eq("user_id", user.id).limit(1);
    const orgId = memberships?.[0]?.org_id as string | undefined;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "User has no org membership" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Cache lookup ─────────────────────────────────────────────────
    if (!forceRefresh) {
      try {
        const { data: cached } = await supabase.from("batch_briefs")
          .select("brief_text, brief_data, signals, query_timings, generated_at, model, tokens_used, expires_at")
          .eq("batch_id", batchId).eq("org_id", orgId)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (cached?.brief_text) {
          return new Response(JSON.stringify({
            brief: cached.brief_text,
            brief_data: cached.brief_data,
            signals: cached.signals,
            query_timings: cached.query_timings,
            cached: true,
            generated_at: cached.generated_at,
            model: cached.model,
            tokens_used: cached.tokens_used,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (cacheErr) {
        console.error("[generate-batch-brief] cache lookup failed:", cacheErr);
      }
    }

    const signals: Record<string, unknown> = {};

    // ─── batch_core ───────────────────────────────────────────────────
    const batch = await timed("batch_core", async () => {
      const { data } = await supabase.from("grow_batches")
        .select(`
          id, barcode, external_id, source_type, initial_quantity, current_quantity,
          initial_weight_grams, current_weight_grams, unit_cost, is_available,
          is_medical, is_doh_compliant, is_marketplace, is_trade_sample,
          is_employee_sample, is_non_cannabis, is_pack_to_order,
          packaged_date, expiration_date, created_at, updated_at,
          qa_status, qa_parent_batch_id, parent_batch_id, harvest_id, production_run_id,
          product_id, strain_id, area_id
        `)
        .eq("id", batchId).eq("org_id", orgId).single();
      return data;
    });
    if (!batch) {
      return new Response(JSON.stringify({ error: "Batch not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const b = batch as any;
    const ageDays = b.created_at
      ? Math.round((Date.now() - new Date(b.created_at).getTime()) / 86400000) : null;
    const daysUntilExpiration = b.expiration_date
      ? Math.round((new Date(b.expiration_date).getTime() - Date.now()) / 86400000) : null;
    const qtyPctRemaining = b.initial_quantity && Number(b.initial_quantity) > 0
      ? Math.round((Number(b.current_quantity) / Number(b.initial_quantity)) * 100) : null;
    signals.batch_core = {
      barcode: b.barcode, external_id: b.external_id, source_type: b.source_type,
      initial_quantity: b.initial_quantity, current_quantity: b.current_quantity,
      qty_pct_remaining: qtyPctRemaining,
      current_weight_grams: b.current_weight_grams,
      unit_cost: b.unit_cost,
      is_available: b.is_available,
      is_medical: b.is_medical, is_doh_compliant: b.is_doh_compliant,
      is_marketplace: b.is_marketplace, is_trade_sample: b.is_trade_sample,
      packaged_date: b.packaged_date, expiration_date: b.expiration_date,
      age_in_inventory_days: ageDays,
      days_until_expiration: daysUntilExpiration,
      qa_status: b.qa_status,
      has_qa_parent: Boolean(b.qa_parent_batch_id && b.qa_parent_batch_id !== b.id),
    };

    // ─── lineage — product, strain, area, harvest ────────────────────
    await timed("lineage", async () => {
      const [prod, strain, area, harvest] = await Promise.all([
        b.product_id ? supabase.from("grow_products").select("name, category, ccrs_inventory_category, unit_of_measure").eq("id", b.product_id).maybeSingle() : Promise.resolve({ data: null }),
        b.strain_id ? supabase.from("grow_strains").select("name, type").eq("id", b.strain_id).maybeSingle() : Promise.resolve({ data: null }),
        b.area_id ? supabase.from("grow_areas").select("name").eq("id", b.area_id).maybeSingle() : Promise.resolve({ data: null }),
        b.harvest_id ? supabase.from("grow_harvests").select("name").eq("id", b.harvest_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      signals.lineage = {
        product: (prod as any).data
          ? { name: (prod as any).data.name, category: (prod as any).data.category,
              ccrs_category: (prod as any).data.ccrs_inventory_category, uom: (prod as any).data.unit_of_measure }
          : null,
        strain: (strain as any).data
          ? { name: (strain as any).data.name, type: (strain as any).data.type } : null,
        area: (area as any).data ? (area as any).data.name : null,
        harvest: (harvest as any).data ? (harvest as any).data.name : null,
      };
    });

    // ─── qa — latest test + potency ───────────────────────────────────
    await timed("qa_results", async () => {
      const qaRootId = b.qa_parent_batch_id ?? b.id;
      const { data: lots } = await supabase.from("grow_qa_lots")
        .select("id").eq("parent_batch_id", qaRootId);
      const lotIds = ((lots ?? []) as any[]).map((l) => l.id);
      if (lotIds.length === 0) { signals.qa = null; return; }
      const { data: res } = await supabase.from("grow_qa_results")
        .select("test_name, test_date, overall_pass, lab_name, thc_total_pct, cbd_total_pct, total_terpenes_pct, moisture_pct")
        .in("qa_lot_id", lotIds)
        .order("test_date", { ascending: false })
        .limit(5);
      const resArr = (res ?? []) as any[];
      if (resArr.length === 0) { signals.qa = null; return; }
      const latest = resArr[0];
      signals.qa = {
        latest_test: latest.test_name, latest_date: latest.test_date,
        lab: latest.lab_name, overall_pass: latest.overall_pass,
        thc_total_pct: latest.thc_total_pct, cbd_total_pct: latest.cbd_total_pct,
        total_terpenes_pct: latest.total_terpenes_pct,
        moisture_pct: latest.moisture_pct,
        result_count: resArr.length,
      };
    });

    // ─── sales_traction — orders via allocations ─────────────────────
    await timed("sales_traction", async () => {
      const { data: allocs } = await supabase.from("grow_order_allocations")
        .select("quantity, created_at, order_item_id")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: false })
        .limit(200);
      const allocArr = (allocs ?? []) as any[];
      const totalAllocated = allocArr.reduce((sum, a) => sum + Number(a.quantity ?? 0), 0);
      const firstAlloc = allocArr.length ? allocArr[allocArr.length - 1].created_at : null;
      const lastAlloc = allocArr[0]?.created_at ?? null;
      // revenue is optional — pull unit_price for each allocated order_item
      let revenue = 0;
      if (allocArr.length > 0) {
        const itemIds = [...new Set(allocArr.map((a) => a.order_item_id).filter(Boolean))];
        if (itemIds.length > 0) {
          const { data: items } = await supabase.from("grow_order_items")
            .select("id, unit_price").in("id", itemIds);
          const priceById = new Map<string, number>();
          for (const it of ((items ?? []) as any[])) priceById.set(it.id, Number(it.unit_price ?? 0));
          for (const a of allocArr) {
            const p = priceById.get(a.order_item_id) ?? 0;
            revenue += p * Number(a.quantity ?? 0);
          }
        }
      }
      signals.sales_traction = {
        allocation_count: allocArr.length,
        total_units_allocated: totalAllocated,
        first_allocation_at: firstAlloc,
        last_allocation_at: lastAlloc,
        days_since_last_allocation: lastAlloc
          ? Math.round((Date.now() - new Date(lastAlloc).getTime()) / 86400000) : null,
        revenue_allocated: revenue > 0 ? Math.round(revenue * 100) / 100 : null,
      };
    });

    // ─── adjustments_summary ─────────────────────────────────────────
    await timed("adjustments", async () => {
      const { data: adj } = await supabase.from("grow_inventory_adjustments")
        .select("adjustment_reason, adjustment_detail, quantity_delta, adjustment_date, ccrs_reported")
        .eq("batch_id", batchId)
        .order("adjustment_date", { ascending: false })
        .limit(20);
      const adjArr = (adj ?? []) as any[];
      const totalDelta = adjArr.reduce((s, a) => s + Number(a.quantity_delta ?? 0), 0);
      const byReason: Record<string, number> = {};
      for (const a of adjArr) {
        const r = a.adjustment_reason ?? "unknown";
        byReason[r] = (byReason[r] ?? 0) + 1;
      }
      signals.adjustments = {
        count: adjArr.length,
        net_delta: totalDelta,
        reasons: byReason,
        ccrs_unreported: adjArr.filter((a) => !a.ccrs_reported).length,
        recent: adjArr.slice(0, 3).map((a) => ({
          reason: a.adjustment_reason, detail: a.adjustment_detail,
          delta: a.quantity_delta, at: a.adjustment_date, reported: a.ccrs_reported,
        })),
      };
    });

    timings.total_data_gathering_ms = Math.round(
      Object.entries(timings)
        .filter(([k]) => !["total_data_gathering_ms", "claude_api_ms", "total_request_ms"].includes(k))
        .reduce((s, [, v]) => s + (v as number), 0)
    );

    // ─── Org name for tone ────────────────────────────────────────────
    const { data: org } = await supabase.from("organizations")
      .select("name, brand_voice").eq("id", orgId).single();
    const orgName = (org as any)?.name ?? "your cultivation operation";
    const brandVoice = (org as any)?.brand_voice ?? "professional";

    // ─── Build Claude prompt ─────────────────────────────────────────
    const batchLabel = b.barcode || b.external_id || "this batch";
    const systemPrompt =
      `You are Cody, an AI operations assistant for ${orgName}, a Washington State cannabis cultivation/processing operation. The user is viewing the detail page for batch ${batchLabel} in the Cody Grow product.\n\n` +
      `Write a short brief about what's happening with this batch right now — where it is in its lifecycle, how it's moving, and what the operator should do next.\n\n` +
      `What to include (only when signals support it):\n` +
      `- QA status and potency if notable (e.g., "strong THC at X%", "awaiting QA")\n` +
      `- Sales traction (or lack of it) — units allocated, how fast it's moving\n` +
      `- Age vs. expiration proximity — flag if at risk\n` +
      `- Inventory events (significant adjustments, unreported CCRS)\n` +
      `- A concrete next action (make it available, push to marketplace, reconcile an adjustment, follow up on QA)\n\n` +
      `Style:\n` +
      `- 2-3 observation sentences + one suggested action\n` +
      `- Natural prose, not bullets\n` +
      `- Under 120 words\n` +
      `- Specific — real numbers, grams, percentages, days\n` +
      `- No generic grow-ops platitudes\n\n` +
      `Don't invent data beyond what's in the signals. If the batch is brand new with no sales or QA yet, say so plainly. ` +
      `Tone: ${brandVoice}, direct, operator-to-operator.`;

    const userPrompt = JSON.stringify(signals, null, 2);

    let briefText = "";
    let tokensUsed = 0;
    const claudeStart = performance.now();
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL_ID,
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      timings.claude_api_ms = Math.round(performance.now() - claudeStart);
      if (!res.ok) {
        const errText = await res.text();
        console.error("[generate-batch-brief] Claude error:", errText);
        return new Response(JSON.stringify({ error: "AI service error", query_timings: timings }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await res.json();
      briefText = (data?.content?.[0]?.text ?? "").trim();
      tokensUsed = (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0);
    } catch (err) {
      timings.claude_api_ms = Math.round(performance.now() - claudeStart);
      console.error("[generate-batch-brief] Claude call failed:", err);
      return new Response(JSON.stringify({ error: String(err), query_timings: timings }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!briefText || briefText.length < 30) {
      return new Response(JSON.stringify({
        brief: "", signals, query_timings: timings, cached: false,
        generated_at: new Date().toISOString(), model: MODEL_ID, tokens_used: tokensUsed,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    timings.total_request_ms = Math.round(performance.now() - requestStart);
    const generatedAt = new Date().toISOString();

    const briefData = { batch_label: batchLabel, org_name: orgName, signals };

    try {
      await supabase.from("batch_briefs").upsert({
        org_id: orgId,
        batch_id: batchId,
        brief_text: briefText,
        brief_data: briefData,
        signals,
        query_timings: timings,
        generated_at: generatedAt,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        model: MODEL_ID,
        tokens_used: tokensUsed || null,
      }, { onConflict: "batch_id,org_id" });
    } catch (cacheErr) {
      console.error("[generate-batch-brief] cache write failed:", cacheErr);
    }

    return new Response(JSON.stringify({
      brief: briefText, brief_data: briefData, signals, query_timings: timings,
      cached: false, generated_at: generatedAt, model: MODEL_ID, tokens_used: tokensUsed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[generate-batch-brief] error:", err);
    return new Response(JSON.stringify({ error: String(err), query_timings: timings }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
