/**
 * send-scheduled-report — runs due scheduled reports, emails results.
 *
 * Invocation modes:
 *   - No body: sweeps every due report (WHERE is_active=true AND next_run_at <= NOW())
 *   - Body { schedule_id }: runs that single schedule immediately (triggered by "Run Now")
 *
 * For each due report:
 *   1. Fetch report config + query
 *   2. Execute against Supabase
 *   3. Format as CSV
 *   4. Email via Resend if RESEND_API_KEY is set, else store in Supabase Storage +
 *      create in-app notifications for recipients
 *   5. Insert grow_report_runs with status/row_count/duration_ms
 *   6. Compute next_run_at from schedule_cron and update the schedule
 *
 * Deploy: `npx supabase functions deploy send-scheduled-report --no-verify-jwt`
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "reports@cody.grow";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

interface ReportRunResult { rowCount: number; csv: string; durationMs: number }

async function executeReport(reportId: string, orgId: string): Promise<ReportRunResult> {
  const start = Date.now();
  const { data: report, error } = await sb.from("grow_saved_reports").select("*").eq("id", reportId).maybeSingle();
  if (error) throw error;
  if (!report) throw new Error(`Report ${reportId} not found`);
  const q = report.query_config ?? {};
  const dataSource: string = q.data_source;
  if (!dataSource) throw new Error("Report has no data_source");
  const cols: string[] | undefined = q.columns?.length ? q.columns : undefined;

  let query = sb.from(dataSource).select(cols?.join(", ") ?? "*").eq("org_id", orgId);
  for (const f of (q.filters ?? []) as Array<{ field: string; op: string; value: any }>) {
    switch (f.op) {
      case "eq": query = query.eq(f.field, f.value); break;
      case "neq": query = query.neq(f.field, f.value); break;
      case "gt": query = query.gt(f.field, f.value); break;
      case "gte": query = query.gte(f.field, f.value); break;
      case "lt": query = query.lt(f.field, f.value); break;
      case "lte": query = query.lte(f.field, f.value); break;
      case "in": query = query.in(f.field, f.value); break;
      case "ilike": query = query.ilike(f.field, `%${f.value}%`); break;
      case "not": query = query.not(f.field, "is", f.value); break;
    }
  }
  for (const o of (q.order_by ?? []) as Array<{ field: string; ascending?: boolean }>) {
    query = query.order(o.field, { ascending: o.ascending ?? true });
  }
  if (q.limit) query = query.limit(q.limit);

  const { data: rows, error: qErr } = await query;
  if (qErr) throw qErr;

  // Use columns_config for header labels if present, else the object keys
  const columnsConfig = (report.columns_config ?? []) as Array<{ field: string; label: string }>;
  const header = columnsConfig.length > 0
    ? columnsConfig.map((c) => c.label).join(",")
    : Object.keys((rows?.[0] as object) ?? {}).join(",");
  const fields = columnsConfig.length > 0 ? columnsConfig.map((c) => c.field) : Object.keys((rows?.[0] as object) ?? {});

  const esc = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = (rows ?? []).map((r) => fields.map((f) => esc((r as any)[f])).join(","));
  const csv = [header, ...body].join("\n");
  return { rowCount: rows?.length ?? 0, csv, durationMs: Date.now() - start };
}

async function sendEmailResend(to: string[], subject: string, attachmentCsv: string, filename: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject,
      html: `<p>Your scheduled Cody Grow report is attached.</p><p style="color:#666;font-size:12px">Generated ${new Date().toUTCString()}</p>`,
      attachments: [{ filename, content: btoa(attachmentCsv) }],
    }),
  });
  return r.ok;
}

async function storeAndNotify(orgId: string, recipients: string[], subject: string, csv: string, filename: string): Promise<void> {
  // Store in Supabase Storage under org-scoped bucket
  const path = `${orgId}/scheduled/${filename}`;
  const bucket = "reports";
  // Ensure bucket exists (ignore error if it already does)
  await sb.storage.createBucket(bucket, { public: false }).catch(() => {});
  await sb.storage.from(bucket).upload(path, new Blob([csv], { type: "text/csv" }), { upsert: true });
  const { data: signed } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);

  // For each recipient email, find the matching user (if any) and create a notification
  for (const email of recipients) {
    const { data: user } = await sb.from("organization_members").select("id, user_id").eq("email", email).eq("org_id", orgId).maybeSingle();
    if (!user) continue;
    await sb.from("grow_in_app_notifications").insert({
      org_id: orgId,
      user_id: (user as any).user_id ?? (user as any).id,
      event_key: "scheduled_report_delivered",
      title: subject,
      content: `Your scheduled report is ready. Download link valid for 7 days.`,
      action_url: signed?.signedUrl ?? null,
    });
  }
}

/** Compute next run from a limited cron subset: daily/weekly/monthly presets. */
function computeNextRun(cron: string, from: Date = new Date()): Date {
  const next = new Date(from);
  next.setSeconds(0, 0);
  // Parse: "m h dom mon dow"
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) { next.setDate(next.getDate() + 1); return next; }
  const [min, hr, dom, , dow] = parts;
  next.setMinutes(Number(min) || 0);
  next.setHours(Number(hr) || 0);
  if (dom !== "*") {
    // Monthly on specific day
    next.setDate(Number(dom));
    if (next.getTime() <= from.getTime()) next.setMonth(next.getMonth() + 1);
  } else if (dow !== "*") {
    // Weekly on specific day of week (0=Sunday)
    const targetDow = Number(dow);
    const daysAhead = (targetDow - next.getDay() + 7) % 7 || 7;
    next.setDate(next.getDate() + daysAhead);
  } else {
    // Daily
    if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  }
  return next;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const scheduleId: string | undefined = body.schedule_id;

    let q = sb.from("grow_scheduled_reports").select("*").eq("is_active", true);
    if (scheduleId) q = q.eq("id", scheduleId);
    else q = q.lte("next_run_at", new Date().toISOString());

    const { data: schedules, error } = await q;
    if (error) throw error;

    const results: Array<{ id: string; status: string; rows?: number; error?: string }> = [];

    for (const s of (schedules ?? []) as any[]) {
      const runStart = Date.now();
      try {
        const { rowCount, csv, durationMs } = await executeReport(s.report_id, s.org_id);
        const filename = `${s.name.replace(/[^a-z0-9]+/gi, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
        const recipients = (s.recipient_emails ?? []) as string[];

        let delivered = false;
        if (recipients.length > 0) {
          delivered = await sendEmailResend(recipients, `[Cody Grow] ${s.name}`, csv, filename);
          if (!delivered) await storeAndNotify(s.org_id, recipients, s.name, csv, filename);
        }

        await sb.from("grow_report_runs").insert({
          report_id: s.report_id,
          scheduled_report_id: s.id,
          status: "completed",
          row_count: rowCount,
          duration_ms: durationMs,
          params: { schedule_id: s.id },
        });

        const next = computeNextRun(s.schedule_cron);
        await sb.from("grow_scheduled_reports").update({
          last_run_at: new Date().toISOString(),
          next_run_at: next.toISOString(),
        }).eq("id", s.id);

        results.push({ id: s.id, status: delivered ? "emailed" : "stored", rows: rowCount });
      } catch (err) {
        await sb.from("grow_report_runs").insert({
          report_id: s.report_id,
          scheduled_report_id: s.id,
          status: "failed",
          row_count: 0,
          duration_ms: Date.now() - runStart,
          params: { error: String(err) },
        }).catch(() => {});
        results.push({ id: s.id, status: "failed", error: String(err) });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
