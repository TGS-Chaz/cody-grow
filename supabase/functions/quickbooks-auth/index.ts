// QuickBooks Online OAuth bridge.
//
// Flow:
// 1) Client posts { action: "authorize_url", org_id } → returns the QBO auth URL.
//    State param encodes user_id + org_id so we can attribute the callback.
// 2) QBO redirects browser to our callback URL (handled here on GET /callback)
//    with ?code=...&state=...&realmId=...
// 3) We exchange the code for access+refresh tokens, store them in
//    grow_org_settings.integrations.quickbooks.config, and render a tiny HTML
//    page that posts a message to window.opener + closes itself.
// 4) The IntegrationsPage listens for that message and refreshes.
//
// Secrets expected in Supabase secrets:
//   QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, QBO_ENV (sandbox|production)
//
// Deploy: npx supabase functions deploy quickbooks-auth --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const QBO_CLIENT_ID = Deno.env.get("QBO_CLIENT_ID") ?? "";
const QBO_CLIENT_SECRET = Deno.env.get("QBO_CLIENT_SECRET") ?? "";
const QBO_REDIRECT_URI = Deno.env.get("QBO_REDIRECT_URI") ?? "";
const QBO_ENV = (Deno.env.get("QBO_ENV") ?? "sandbox") as "sandbox" | "production";

const QBO_AUTH_HOST = "https://appcenter.intuit.com";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_API_BASE = QBO_ENV === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com";

const SCOPES = ["com.intuit.quickbooks.accounting", "openid", "profile", "email"].join(" ");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── GET /callback — QBO → us after the user authorizes ─────────────────────
  if (req.method === "GET" && url.pathname.endsWith("/callback")) {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const realmId = url.searchParams.get("realmId");
    const error = url.searchParams.get("error");
    if (error) return htmlFinal("error", `QuickBooks authorization failed: ${error}`);
    if (!code || !state || !realmId) return htmlFinal("error", "Missing code/state/realmId");

    let parsed: { u: string; o: string };
    try { parsed = JSON.parse(atob(state)); } catch { return htmlFinal("error", "Invalid state"); }
    const { o: orgId } = parsed;

    // Exchange code → tokens
    const tokenRes = await fetch(QBO_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`)}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: QBO_REDIRECT_URI }).toString(),
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      return htmlFinal("error", `Token exchange failed: ${txt}`);
    }
    const tokens = await tokenRes.json();

    // Fetch company name for display
    let companyName = "";
    try {
      const infoRes = await fetch(`${QBO_API_BASE}/v3/company/${realmId}/companyinfo/${realmId}`, {
        headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" },
      });
      if (infoRes.ok) {
        const info = await infoRes.json();
        companyName = info?.CompanyInfo?.CompanyName ?? "";
      }
    } catch { /* best-effort */ }

    // Merge into grow_org_settings.integrations.quickbooks
    const { data: settings } = await admin.from("grow_org_settings").select("integrations").eq("org_id", orgId).maybeSingle();
    const existing = ((settings?.integrations ?? {}) as Record<string, any>);
    const existingQbo = existing.quickbooks ?? {};
    const merged = {
      ...existing,
      quickbooks: {
        ...existingQbo,
        connected: true,
        connected_at: new Date().toISOString(),
        config: {
          ...(existingQbo.config ?? {}),
          realm_id: realmId,
          env: QBO_ENV,
          company_name: companyName,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
          refresh_expires_at: new Date(Date.now() + (tokens.x_refresh_token_expires_in ?? 8640000) * 1000).toISOString(),
        },
      },
    };
    const { error: updErr } = await admin.from("grow_org_settings").update({ integrations: merged }).eq("org_id", orgId);
    if (updErr) return htmlFinal("error", `Failed to save tokens: ${updErr.message}`);

    return htmlFinal("success", `Connected to ${companyName || "QuickBooks"} — you can close this window.`);
  }

  // ── POST { action } ────────────────────────────────────────────────────────
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const jwt = authHeader.replace("Bearer ", "");
  const { data: userData, error: uErr } = await admin.auth.getUser(jwt);
  if (uErr || !userData.user) return json({ error: "Invalid token" }, 401);
  const userId = userData.user.id;

  const body = await req.json().catch(() => ({}));
  const { action, org_id: orgId } = body as { action: string; org_id?: string };

  if (!orgId) return json({ error: "org_id required" }, 400);

  // Confirm user is a member of the org
  const { data: membership } = await admin.from("org_members").select("role").eq("user_id", userId).eq("org_id", orgId).maybeSingle();
  if (!membership) return json({ error: "Not a member of that org" }, 403);

  if (action === "authorize_url") {
    if (!QBO_CLIENT_ID || !QBO_REDIRECT_URI) {
      return json({ error: "QBO_CLIENT_ID / QBO_REDIRECT_URI not configured on the server" }, 500);
    }
    const state = btoa(JSON.stringify({ u: userId, o: orgId }));
    const params = new URLSearchParams({
      client_id: QBO_CLIENT_ID,
      response_type: "code",
      scope: SCOPES,
      redirect_uri: QBO_REDIRECT_URI,
      state,
    });
    return json({ auth_url: `${QBO_AUTH_HOST}/connect/oauth2?${params.toString()}` });
  }

  if (action === "disconnect") {
    const { data: settings } = await admin.from("grow_org_settings").select("integrations").eq("org_id", orgId).maybeSingle();
    const existing = ((settings?.integrations ?? {}) as Record<string, any>);
    const next = { ...existing, quickbooks: { connected: false } };
    const { error: updErr } = await admin.from("grow_org_settings").update({ integrations: next }).eq("org_id", orgId);
    if (updErr) return json({ error: updErr.message }, 500);
    return json({ ok: true });
  }

  if (action === "status") {
    const { data: settings } = await admin.from("grow_org_settings").select("integrations").eq("org_id", orgId).maybeSingle();
    const qbo = ((settings?.integrations ?? {}) as any).quickbooks ?? { connected: false };
    const { access_token: _at, refresh_token: _rt, ...safeConfig } = qbo.config ?? {};
    return json({ connected: !!qbo.connected, connected_at: qbo.connected_at ?? null, config: safeConfig });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});

function htmlFinal(kind: "success" | "error", message: string): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>QuickBooks ${kind}</title><style>
    body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0A0E17;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;}
    .card{max-width:420px;padding:32px;border-radius:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);}
    h1{font-size:18px;margin:0 0 8px 0;color:${kind === "success" ? "#10B981" : "#EF4444"};}
    p{font-size:13px;line-height:1.5;color:rgba(255,255,255,0.7);margin:0;}
    </style></head><body><div class="card"><h1>${kind === "success" ? "Connected" : "Connection failed"}</h1><p>${message}</p></div>
    <script>try{window.opener&&window.opener.postMessage({type:"qbo_${kind}",message:${JSON.stringify(message)}},"*");}catch(e){}setTimeout(()=>{try{window.close();}catch(_){}},1500);</script>
    </body></html>`;
  return new Response(html, { status: kind === "success" ? 200 : 400, headers: { "Content-Type": "text/html", ...corsHeaders } });
}
