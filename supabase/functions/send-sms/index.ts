// Send an SMS via Twilio using the org's configured credentials.
// Body: { org_id, to, message }
// Returns: { ok, sid }
//
// Twilio credentials are read from grow_org_settings.integrations.twilio.config:
//   { account_sid, auth_token, from_number }
//
// Deploy: npx supabase functions deploy send-sms --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
    const { data: userData, error: uErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (uErr || !userData.user) return json({ error: "Invalid token" }, 401);
    const userId = userData.user.id;

    const { org_id: orgId, to, message } = await req.json() as { org_id: string; to: string; message: string };
    if (!orgId || !to || !message) return json({ error: "org_id, to, and message are required" }, 400);
    if (message.length > 1600) return json({ error: "Message exceeds 1600 characters" }, 400);

    const { data: membership } = await admin.from("org_members").select("role").eq("user_id", userId).eq("org_id", orgId).maybeSingle();
    if (!membership) return json({ error: "Not a member of that org" }, 403);

    const { data: settings } = await admin.from("grow_org_settings").select("integrations").eq("org_id", orgId).maybeSingle();
    const twilio = ((settings?.integrations ?? {}) as any).twilio?.config ?? {};
    const { account_sid, auth_token, from_number } = twilio;
    if (!account_sid || !auth_token || !from_number) {
      return json({ error: "Twilio not configured for this org" }, 400);
    }

    // Basic E.164 normalization: ensure leading +. We don't rewrite — just validate.
    const normalized = String(to).trim();
    if (!normalized.startsWith("+") || normalized.length < 8) {
      return json({ error: "Recipient must be in E.164 format (e.g. +15095551234)" }, 400);
    }

    const body = new URLSearchParams({ To: normalized, From: from_number, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${account_sid}:${auth_token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ error: payload?.message ?? `Twilio error (${res.status})`, code: payload?.code }, 502);
    }

    return json({ ok: true, sid: payload.sid, status: payload.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-sms error:", msg);
    return json({ error: msg }, 500);
  }
});
