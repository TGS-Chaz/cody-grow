// Generate WCIA-style menu JSON per account that opted into menu push.
// Stores each as a signed URL on the `menus` storage bucket at
//   menus/{org_id}/{account_id}/latest.json
// and writes that URL back to grow_accounts.menu_push_url.
//
// Body: { org_id, account_id?, menu_id? }
//   - account_id given → push only that account
//   - menu_id given → only accounts subscribed to that menu
//   - neither → push for every menu_push_enabled account in the org
//
// Deploy: npx supabase functions deploy push-menu-update --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "menus";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

  const { org_id: orgId, account_id: targetAccountId, menu_id: targetMenuId } = await req.json() as {
    org_id: string; account_id?: string; menu_id?: string;
  };
  if (!orgId) return json({ error: "org_id required" }, 400);

  const { data: membership } = await admin.from("org_members").select("role").eq("user_id", userId).eq("org_id", orgId).maybeSingle();
  if (!membership) return json({ error: "Not a member of that org" }, 403);

  // Ensure bucket exists (idempotent)
  try { await admin.storage.createBucket(BUCKET, { public: false }); } catch { /* may already exist */ }

  // Resolve target accounts
  let accountQ = admin.from("grow_accounts").select("id, company_name, menu_push_enabled, license_number").eq("org_id", orgId).eq("is_active", true).eq("menu_push_enabled", true);
  if (targetAccountId) accountQ = accountQ.eq("id", targetAccountId);
  const { data: accounts } = await accountQ;

  // Load all currently-available batches for the org — these are what could go on a menu
  const { data: batches } = await admin.from("grow_batches")
    .select("id, barcode, external_id, product_id, strain_id, current_quantity, unit_cost, marketplace_group_id, image_url")
    .eq("org_id", orgId)
    .eq("is_available", true)
    .gt("current_quantity", 0);
  const productIds = Array.from(new Set(((batches ?? []) as any[]).map((b) => b.product_id).filter(Boolean)));
  const strainIds = Array.from(new Set(((batches ?? []) as any[]).map((b) => b.strain_id).filter(Boolean)));
  const [productsRes, strainsRes] = await Promise.all([
    productIds.length > 0 ? admin.from("grow_products").select("id, name, ccrs_inventory_category, unit_price, image_url").in("id", productIds) : Promise.resolve({ data: [] }),
    strainIds.length > 0 ? admin.from("grow_strains").select("id, name, type").in("id", strainIds) : Promise.resolve({ data: [] }),
  ]);
  const productById = new Map<string, any>(((productsRes.data ?? []) as any[]).map((p) => [p.id, p]));
  const strainById = new Map<string, any>(((strainsRes.data ?? []) as any[]).map((s) => [s.id, s]));

  const results: Array<{ account_id: string; url: string | null; error?: string }> = [];

  for (const acct of ((accounts ?? []) as any[])) {
    try {
      // Menu subscriptions — if the account has any, filter batches
      const { data: memberships } = await admin.from("grow_marketplace_menu_accounts" as any)
        .select("menu_id, grow_marketplace_menus!inner(id, is_active)")
        .eq("account_id", acct.id);
      const menuIds = ((memberships ?? []) as any[]).map((m) => m.menu_id).filter(Boolean);
      if (targetMenuId && !menuIds.includes(targetMenuId)) continue;

      // Load marketplace batch memberships for these menus
      let allowedBatchIds = new Set<string>();
      if (menuIds.length > 0) {
        const { data: menuBatches } = await admin.from("grow_marketplace_menu_items" as any)
          .select("batch_id").in("menu_id", menuIds);
        allowedBatchIds = new Set(((menuBatches ?? []) as any[]).map((m) => m.batch_id).filter(Boolean));
      }

      const batchesForAccount = ((batches ?? []) as any[]).filter((b) => allowedBatchIds.size === 0 || allowedBatchIds.has(b.id));

      const menuItems = batchesForAccount.map((b) => {
        const p = b.product_id ? productById.get(b.product_id) : null;
        const s = b.strain_id ? strainById.get(b.strain_id) : null;
        return {
          inventoryExternalIdentifier: b.external_id,
          barcode: b.barcode,
          productName: p?.name ?? null,
          productCategory: p?.ccrs_inventory_category ?? null,
          strainName: s?.name ?? null,
          strainType: s?.type ?? null,
          quantityAvailable: Number(b.current_quantity ?? 0),
          unitPrice: Number(b.unit_cost ?? p?.unit_price ?? 0),
          imageUrl: b.image_url ?? p?.image_url ?? null,
          marketplaceGroupId: b.marketplace_group_id ?? null,
        };
      });

      const doc = {
        generated_at: new Date().toISOString(),
        origin_org_id: orgId,
        for_account_id: acct.id,
        for_account_name: acct.company_name,
        for_account_license: acct.license_number,
        items: menuItems,
      };

      const path = `${orgId}/${acct.id}/latest.json`;
      const body = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
      await admin.storage.from(BUCKET).upload(path, body, { upsert: true, contentType: "application/json" });
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 30); // 30d
      const url = signed?.signedUrl ?? null;

      await admin.from("grow_accounts").update({ menu_push_url: url }).eq("id", acct.id);
      results.push({ account_id: acct.id, url });
    } catch (err) {
      results.push({ account_id: acct.id, url: null, error: (err as Error).message });
    }
  }

  return json({ ok: true, pushed: results.length, results });
});
