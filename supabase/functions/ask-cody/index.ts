import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const PRODUCT_PROMPTS: Record<string, string> = {
  grow: `You are Cody, the AI assistant for Cody Grow — a seed-to-sale cannabis platform for Washington State licensees.

You help cultivators, processors, and producers manage their entire operation: planting, growing, harvesting, processing, packaging, lab testing, sales, fulfillment, and CCRS compliance reporting.

You can answer questions about plants, grow cycles, harvests, batches, products, lab results, orders, manifests, and CCRS upload status. You also surface proactive insights — environmental anomalies, harvest timing, yield comparisons, compliance gaps.

Be concise, factual, and grounded in the actual data the user provides. If you don't have enough context to answer, say so honestly and suggest what data would help. Reference specific strain names, batch barcodes, and dates when applicable. Use grams for weight, °F for temperature, and percentages for cannabinoid potency unless the user specifies otherwise.

When the user asks for an action (create a grow cycle, mark a plant destroyed, etc.), confirm what you'd do but don't execute it yet — action execution will be added in a future update.`,
  crm: `You are Cody, the AI assistant for Cody CRM — a sales and account management platform for cannabis wholesale teams.`,
  intel: `You are Cody, the AI assistant for Cody Intel — a market intelligence platform for the cannabis industry.`,
};

interface AskCodyRequest {
  product: "crm" | "intel" | "grow";
  context_type?: string;
  context_id?: string;
  page_data?: unknown;
  user_message: string;
  conversation_id?: string;
  intent?: "chat" | "extract_coa" | "edit_entity" | "suggest_ccrs_fix";
  /** For intent=extract_coa — base64-encoded file content + mime type */
  attachment?: { base64: string; mime_type: "application/pdf" | "image/jpeg" | "image/png" | "image/webp"; filename?: string };
  /** For intent=edit_entity — current record + plain-English instruction */
  entity?: Record<string, unknown>;
  entity_type?: string;
  editable_fields?: string[];
  instruction?: string;
  /** For intent=suggest_ccrs_fix — submitted record + error details */
  error_details?: unknown;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: unknown }>;
}

const COA_EXTRACTION_PROMPT = `You are a cannabis Certificate of Analysis (COA) data extractor. You will be given a lab-test document (PDF or image) and must extract structured JSON matching WSLCB CCRS QA Results schema.

RETURN EXACTLY THIS JSON SHAPE — no prose, no code fences, no commentary:
{
  "lab_name": string | null,
  "lab_license_number": string | null,
  "lab_sample_id": string | null,
  "test_date": "YYYY-MM-DD" | null,
  "report_date": "YYYY-MM-DD" | null,
  "batch_barcode": string | null,
  "tested_external_id": string | null,
  "product_name": string | null,
  "potency": {
    "thca_pct": number | null,
    "thc_pct": number | null,
    "total_thc_pct": number | null,
    "cbda_pct": number | null,
    "cbd_pct": number | null,
    "total_cbd_pct": number | null,
    "total_cannabinoids_pct": number | null,
    "total_terpenes_pct": number | null
  },
  "pesticides_pass": boolean | null,
  "heavy_metals_pass": boolean | null,
  "microbials_pass": boolean | null,
  "mycotoxins_pass": boolean | null,
  "residual_solvents_pass": boolean | null,
  "water_activity_pass": boolean | null,
  "moisture_content_pass": boolean | null,
  "moisture_content_pct": number | null,
  "water_activity": number | null,
  "overall_result": "Pass" | "Fail" | "FailExtractableOnly" | "FailRetestAllowed" | null,
  "notes": string | null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- Percentages are numbers (e.g. 22.4 not "22.4%")
- Use null for fields you cannot find — do not guess
- confidence="high" if all major fields found, "medium" if most, "low" if the document is hard to read
- Do not add any fields not listed above`;

const EDIT_ENTITY_PROMPT = `You are Cody, performing a structured edit on a record in the Cody Grow seed-to-sale platform.

You will receive:
  ENTITY_TYPE — the record kind (account / product / plant / cycle / batch / etc.)
  CURRENT — the current JSON of the record
  EDITABLE_FIELDS — whitelist of fields you may change
  INSTRUCTION — the user's plain-English request

Return EXACTLY this JSON shape (no prose, no code fences):
{
  "patch": { <only the fields you're changing> },
  "rationale": "<one short sentence explaining what you changed and why>",
  "confidence": "high" | "medium" | "low"
}

Rules:
- Only include fields present in EDITABLE_FIELDS.
- Never guess a field value — if the instruction is ambiguous, return {"patch": {}, "rationale": "need clarification: ...", "confidence": "low"}.
- For numeric fields, output numbers not strings.
- For dates, use YYYY-MM-DD.
- Do not invent new fields.`;

const CCRS_FIX_PROMPT = `You are Cody, helping a cannabis producer fix a failed WSLCB CCRS submission.

Input:
  SUBMITTED — the record as it was sent to CCRS
  ERROR — the error payload returned by CCRS

Return exactly this JSON (no prose, no code fences):
{
  "root_cause": "<one sentence>",
  "fix_instructions": ["<step 1>", "<step 2>", ...],
  "fields_to_correct": ["<field name>", ...],
  "suggested_values": { "<field>": "<value>" }
}

Be specific. Reference the exact column names from the submitted record. If the error suggests a missing reference (e.g. a strain external_id that CCRS doesn't recognize), point that out explicitly.`;

async function callAnthropic(
  system: string,
  messages: AnthropicMessage[],
): Promise<{ content: string; tokens: number; model: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system,
        messages,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    const content =
      data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
    const tokens =
      (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    return { content, tokens, model: data.model ?? "claude-sonnet-4-6" };
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // req.json() can only be called once per request
    const body: AskCodyRequest = await req.json();
    const { product, context_type, context_id, page_data, user_message, intent, attachment, entity, entity_type, editable_fields, instruction, error_details } = body;
    let conversation_id = body.conversation_id;

    const structuredIntents = new Set(["extract_coa", "edit_entity", "suggest_ccrs_fix"]);
    if (!structuredIntents.has(intent ?? "") && (!product || !user_message)) {
      return new Response(
        JSON.stringify({ error: "product and user_message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client for trusted writes (we'll use auth.getUser for identity)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user from JWT
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // COA extraction: authenticated but skips the conversation flow — structured JSON reply.
    if (intent === "extract_coa") {
      if (!attachment?.base64 || !attachment.mime_type) {
        return new Response(JSON.stringify({ error: "extract_coa requires attachment { base64, mime_type }" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const contentBlocks: Array<any> = [];
      if (attachment.mime_type === "application/pdf") {
        contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: attachment.base64 } });
      } else {
        contentBlocks.push({ type: "image", source: { type: "base64", media_type: attachment.mime_type, data: attachment.base64 } });
      }
      contentBlocks.push({ type: "text", text: "Extract the COA fields from the attached document." });
      const { content: jsonText, tokens, model } = await callAnthropic(COA_EXTRACTION_PROMPT, [
        { role: "user", content: contentBlocks },
      ]);
      let parsed: unknown = null;
      try {
        const cleaned = jsonText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
        parsed = JSON.parse(cleaned);
      } catch (_err) {
        return new Response(JSON.stringify({ error: "Model did not return valid JSON", raw: jsonText }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ extraction: parsed, tokens_used: tokens, model }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Inline AI edit — returns a structured JSON patch.
    if (intent === "edit_entity") {
      if (!entity || !instruction || !entity_type) {
        return new Response(JSON.stringify({ error: "edit_entity requires entity, entity_type, and instruction" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const promptText = `ENTITY_TYPE: ${entity_type}\nCURRENT:\n${JSON.stringify(entity, null, 2)}\n\nEDITABLE_FIELDS: ${JSON.stringify(editable_fields ?? [])}\n\nINSTRUCTION: ${instruction}`;
      const { content: jsonText, tokens, model } = await callAnthropic(EDIT_ENTITY_PROMPT, [
        { role: "user", content: promptText },
      ]);
      let parsed: unknown = null;
      try {
        const cleaned = jsonText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
        parsed = JSON.parse(cleaned);
      } catch (_err) {
        return new Response(JSON.stringify({ error: "Model did not return valid JSON", raw: jsonText }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ edit: parsed, tokens_used: tokens, model }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CCRS fix suggestion — returns root cause + field-level fixes.
    if (intent === "suggest_ccrs_fix") {
      if (!entity || !error_details) {
        return new Response(JSON.stringify({ error: "suggest_ccrs_fix requires entity and error_details" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const promptText = `SUBMITTED:\n${JSON.stringify(entity, null, 2)}\n\nERROR:\n${JSON.stringify(error_details, null, 2)}`;
      const { content: jsonText, tokens, model } = await callAnthropic(CCRS_FIX_PROMPT, [
        { role: "user", content: promptText },
      ]);
      let parsed: unknown = null;
      try {
        const cleaned = jsonText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
        parsed = JSON.parse(cleaned);
      } catch (_err) {
        return new Response(JSON.stringify({ error: "Model did not return valid JSON", raw: jsonText }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ suggestion: parsed, tokens_used: tokens, model }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve org_id (first membership; matches client's localStorage default)
    const { data: members } = await supabaseAdmin
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1);
    const orgId = members?.[0]?.org_id;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "User has no org membership" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create or load conversation
    let messages: AnthropicMessage[] = [];
    if (conversation_id) {
      const { data: existing } = await supabaseAdmin
        .from("cody_messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: true });
      messages = (existing ?? [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    } else {
      const { data: newConvo, error: convoError } = await supabaseAdmin
        .from("cody_conversations")
        .insert({
          org_id: orgId, // explicit org_id per ops rules
          user_id: userId,
          product,
          context_type: context_type ?? null,
          context_id: context_id ?? null,
          title: user_message.slice(0, 80),
        })
        .select("id")
        .single();
      if (convoError || !newConvo) {
        throw new Error(`Failed to create conversation: ${convoError?.message}`);
      }
      conversation_id = newConvo.id;
    }

    // Persist user message
    await supabaseAdmin.from("cody_messages").insert({
      conversation_id,
      role: "user",
      content: user_message,
    });

    // Build system prompt with page context
    const basePrompt = PRODUCT_PROMPTS[product] ?? PRODUCT_PROMPTS.grow;
    let contextBlock = "";
    if (context_type) {
      contextBlock += `\n\nCURRENT PAGE: ${context_type}`;
      if (context_id) contextBlock += ` (id: ${context_id})`;
    }
    if (page_data) {
      contextBlock += `\n\nPAGE DATA:\n${JSON.stringify(page_data).slice(0, 6000)}`;
    }
    const systemPrompt = basePrompt + contextBlock;

    // Append the new user message to the history
    messages.push({ role: "user", content: user_message });

    // Call Claude
    const { content: reply, tokens, model } = await callAnthropic(systemPrompt, messages);

    // Persist assistant message
    await supabaseAdmin.from("cody_messages").insert({
      conversation_id,
      role: "assistant",
      content: reply,
      tokens_used: tokens,
      model,
    });

    // Bump conversation updated_at (handled by trigger but explicit insert refreshes it)
    await supabaseAdmin
      .from("cody_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation_id);

    return new Response(
      JSON.stringify({ reply, conversation_id, tokens_used: tokens, model }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("ask-cody error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
