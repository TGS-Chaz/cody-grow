// QuickBooks Online sync: push grow_accounts → Customers, grow_invoices → Invoices,
// grow_payments → Payments. Requires a prior OAuth connection via quickbooks-auth.
//
// Body: { org_id, sync_type: 'customers' | 'invoices' | 'payments' | 'all' }
// Returns: { ok, counts: { customers, invoices, payments }, errors: [] }
//
// Deploy: npx supabase functions deploy quickbooks-sync --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const QBO_CLIENT_ID = Deno.env.get("QBO_CLIENT_ID") ?? "";
const QBO_CLIENT_SECRET = Deno.env.get("QBO_CLIENT_SECRET") ?? "";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

type SyncType = "customers" | "invoices" | "payments" | "all";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function refreshIfNeeded(admin: any, orgId: string, qboConfig: any): Promise<string> {
  const expiresAt = qboConfig.token_expires_at ? new Date(qboConfig.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return qboConfig.access_token;
  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`)}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: qboConfig.refresh_token }).toString(),
  });
  if (!res.ok) throw new Error(`QBO token refresh failed: ${await res.text()}`);
  const t = await res.json();
  const merged = {
    ...qboConfig,
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? qboConfig.refresh_token,
    token_expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
    refresh_expires_at: new Date(Date.now() + (t.x_refresh_token_expires_in ?? 8640000) * 1000).toISOString(),
  };
  const { data: settings } = await admin.from("grow_org_settings").select("integrations").eq("org_id", orgId).maybeSingle();
  const existing = (settings?.integrations ?? {}) as any;
  const nextIntegrations = { ...existing, quickbooks: { ...existing.quickbooks, config: merged } };
  await admin.from("grow_org_settings").update({ integrations: nextIntegrations }).eq("org_id", orgId);
  return merged.access_token;
}

async function qboFetch(apiBase: string, realmId: string, accessToken: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${apiBase}/v3/company/${realmId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`QBO ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const { data: userData, error: uErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (uErr || !userData.user) return json({ error: "Invalid token" }, 401);
  const userId = userData.user.id;

  const { org_id: orgId, sync_type = "all" } = await req.json() as { org_id: string; sync_type?: SyncType };
  if (!orgId) return json({ error: "org_id required" }, 400);

  const { data: membership } = await admin.from("org_members").select("role").eq("user_id", userId).eq("org_id", orgId).maybeSingle();
  if (!membership) return json({ error: "Not a member of that org" }, 403);

  const { data: settings } = await admin.from("grow_org_settings").select("integrations").eq("org_id", orgId).maybeSingle();
  const qbo = ((settings?.integrations ?? {}) as any).quickbooks;
  if (!qbo?.connected || !qbo?.config) return json({ error: "QuickBooks is not connected for this org" }, 400);
  const qCfg = qbo.config;
  const realmId = qCfg.realm_id;
  const env = qCfg.env === "production" ? "production" : "sandbox";
  const apiBase = env === "production" ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com";

  const accessToken = await refreshIfNeeded(admin, orgId, qCfg);

  const counts = { customers: 0, invoices: 0, payments: 0 };
  const errors: string[] = [];

  // ── Customers ─────────────────────────────────────────────────────────────
  if (sync_type === "customers" || sync_type === "all") {
    const { data: accounts } = await admin.from("grow_accounts").select("*").eq("org_id", orgId).eq("is_active", true);
    for (const a of (accounts ?? []) as any[]) {
      try {
        if (a.quickbooks_customer_id) {
          // Update existing — fetch sparse to get SyncToken first
          const existing = await qboFetch(apiBase, realmId, accessToken, `/customer/${a.quickbooks_customer_id}?minorversion=73`);
          const customer = existing.Customer ?? existing;
          const patch = {
            Id: customer.Id,
            SyncToken: customer.SyncToken,
            sparse: true,
            DisplayName: a.company_name,
            CompanyName: a.company_name,
            PrimaryEmailAddr: a.primary_contact_email ? { Address: a.primary_contact_email } : undefined,
            PrimaryPhone: a.primary_contact_phone ? { FreeFormNumber: a.primary_contact_phone } : undefined,
          };
          await qboFetch(apiBase, realmId, accessToken, `/customer?minorversion=73`, { method: "POST", body: JSON.stringify(patch) });
        } else {
          // Try match by license first via DisplayName contains
          const query = `SELECT * FROM Customer WHERE DisplayName = '${String(a.company_name).replace(/'/g, "\\'")}'`;
          const found = await qboFetch(apiBase, realmId, accessToken, `/query?query=${encodeURIComponent(query)}&minorversion=73`);
          const match = found?.QueryResponse?.Customer?.[0];
          let qCustId: string;
          if (match) {
            qCustId = match.Id;
          } else {
            const payload = {
              DisplayName: a.company_name,
              CompanyName: a.company_name,
              PrimaryEmailAddr: a.primary_contact_email ? { Address: a.primary_contact_email } : undefined,
              PrimaryPhone: a.primary_contact_phone ? { FreeFormNumber: a.primary_contact_phone } : undefined,
              BillAddr: a.street_address ? {
                Line1: a.street_address, City: a.city, CountrySubDivisionCode: a.state, PostalCode: a.postal_code,
              } : undefined,
              Notes: a.license_number ? `License: ${a.license_number}` : undefined,
            };
            const created = await qboFetch(apiBase, realmId, accessToken, `/customer?minorversion=73`, { method: "POST", body: JSON.stringify(payload) });
            qCustId = created.Customer.Id;
          }
          await admin.from("grow_accounts").update({ quickbooks_customer_id: qCustId }).eq("id", a.id);
        }
        counts.customers++;
      } catch (err) {
        errors.push(`Customer ${a.company_name}: ${(err as Error).message}`);
      }
    }
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  if (sync_type === "invoices" || sync_type === "all") {
    const { data: invoices } = await admin.from("grow_invoices").select("*").eq("org_id", orgId).is("quickbooks_invoice_id", null);
    for (const inv of (invoices ?? []) as any[]) {
      try {
        const { data: account } = await admin.from("grow_accounts").select("quickbooks_customer_id, company_name").eq("id", inv.account_id).maybeSingle();
        const qCustId = (account as any)?.quickbooks_customer_id;
        if (!qCustId) { errors.push(`Invoice ${inv.invoice_number}: customer not synced yet`); continue; }

        const { data: items } = await admin.from("grow_order_items").select("*, product:grow_products(name)").eq("order_id", inv.order_id);
        const lines = ((items ?? []) as any[]).map((it) => ({
          DetailType: "SalesItemLineDetail",
          Amount: Number(it.line_total ?? 0),
          Description: it.product?.name ?? "Cannabis product",
          SalesItemLineDetail: {
            Qty: Number(it.quantity ?? 0),
            UnitPrice: Number(it.unit_price ?? 0),
            // Defer item mapping: use the fallback "Services" item (Id 1 is typical in new QBO accounts)
            ItemRef: { value: "1", name: "Services" },
          },
        }));
        const payload = {
          CustomerRef: { value: qCustId },
          TxnDate: inv.invoice_date,
          DueDate: inv.due_date,
          DocNumber: inv.invoice_number,
          PrivateNote: inv.notes ?? undefined,
          Line: lines.length > 0 ? lines : [{
            DetailType: "SalesItemLineDetail",
            Amount: Number(inv.total ?? 0),
            Description: `Cody Grow invoice ${inv.invoice_number}`,
            SalesItemLineDetail: { Qty: 1, UnitPrice: Number(inv.total ?? 0), ItemRef: { value: "1", name: "Services" } },
          }],
        };
        const created = await qboFetch(apiBase, realmId, accessToken, `/invoice?minorversion=73`, { method: "POST", body: JSON.stringify(payload) });
        const qId = created.Invoice.Id;
        await admin.from("grow_invoices").update({ quickbooks_invoice_id: qId }).eq("id", inv.id);
        counts.invoices++;
      } catch (err) {
        errors.push(`Invoice ${inv.invoice_number}: ${(err as Error).message}`);
      }
    }
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  if (sync_type === "payments" || sync_type === "all") {
    const { data: payments } = await admin.from("grow_payments").select("*").eq("org_id", orgId).is("quickbooks_payment_id", null);
    for (const p of (payments ?? []) as any[]) {
      try {
        const { data: inv } = p.invoice_id
          ? await admin.from("grow_invoices").select("quickbooks_invoice_id, account_id").eq("id", p.invoice_id).maybeSingle()
          : { data: null };
        const qInvId = (inv as any)?.quickbooks_invoice_id;
        const { data: account } = inv
          ? await admin.from("grow_accounts").select("quickbooks_customer_id").eq("id", (inv as any).account_id).maybeSingle()
          : { data: null };
        const qCustId = (account as any)?.quickbooks_customer_id;
        if (!qCustId) { errors.push(`Payment ${p.id}: customer/invoice not synced yet`); continue; }

        const payload: any = {
          CustomerRef: { value: qCustId },
          TotalAmt: Number(p.amount ?? 0),
          TxnDate: p.payment_date ?? new Date().toISOString().slice(0, 10),
          PaymentMethodRef: p.payment_method ? { name: p.payment_method } : undefined,
        };
        if (qInvId) {
          payload.Line = [{
            Amount: Number(p.amount ?? 0),
            LinkedTxn: [{ TxnId: qInvId, TxnType: "Invoice" }],
          }];
        }
        const created = await qboFetch(apiBase, realmId, accessToken, `/payment?minorversion=73`, { method: "POST", body: JSON.stringify(payload) });
        const qPayId = created.Payment.Id;
        await admin.from("grow_payments").update({ quickbooks_payment_id: qPayId }).eq("id", p.id);
        counts.payments++;
      } catch (err) {
        errors.push(`Payment ${p.id}: ${(err as Error).message}`);
      }
    }
  }

  // Record sync result
  const { data: latest } = await admin.from("grow_org_settings").select("integrations").eq("org_id", orgId).maybeSingle();
  const existing2 = ((latest?.integrations ?? {}) as any);
  const next = {
    ...existing2,
    quickbooks: {
      ...existing2.quickbooks,
      config: {
        ...(existing2.quickbooks?.config ?? {}),
        last_sync_at: new Date().toISOString(),
        last_sync_result: { sync_type, counts, errors_count: errors.length },
      },
    },
  };
  await admin.from("grow_org_settings").update({ integrations: next }).eq("org_id", orgId);

  return json({ ok: true, counts, errors });
});
