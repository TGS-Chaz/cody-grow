import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface MarketplaceMenu {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  public_slug: string | null;
  is_public: boolean | null;
  is_active: boolean | null;
  password_protected: boolean | null;
  password_hash: string | null;
  visible_to_accounts: string[] | null;
  visible_to_account_groups: string[] | null;
  banner_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  featured_product_ids: string[] | null;
  created_at: string | null;
  item_count?: number;
}

export function useMarketplaceMenus() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<MarketplaceMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_marketplace_menus").select("*").eq("org_id", orgId).order("name");
      // Compute item counts
      const ids = ((rows ?? []) as any[]).map((r) => r.id);
      const countByMenu = new Map<string, number>();
      if (ids.length > 0) {
        const { data: batches } = await supabase.from("grow_batches").select("marketplace_menu_ids").eq("org_id", orgId).not("marketplace_menu_ids", "is", null);
        (batches ?? []).forEach((b: any) => {
          (b.marketplace_menu_ids as string[] ?? []).forEach((mid) => countByMenu.set(mid, (countByMenu.get(mid) ?? 0) + 1));
        });
      }
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({ ...r, item_count: countByMenu.get(r.id) ?? 0 })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useMarketplaceMenu(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<MarketplaceMenu | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row } = await supabase.from("grow_marketplace_menus").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (cancelled) return;
      setData(row as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id]);

  return { data, loading };
}

export function useCreateMenu() {
  const { orgId } = useOrg();
  return useCallback(async (input: {
    name: string; description?: string | null; public_slug?: string; is_public?: boolean;
    banner_url?: string | null; contact_email?: string | null; contact_phone?: string | null;
    visible_to_accounts?: string[];
  }) => {
    if (!orgId) throw new Error("No active org");
    const slug = (input.public_slug || input.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const { data, error } = await supabase.from("grow_marketplace_menus").insert({
      org_id: orgId,
      name: input.name.trim(),
      description: input.description ?? null,
      public_slug: slug,
      is_public: input.is_public ?? true,
      is_active: true,
      banner_url: input.banner_url ?? null,
      contact_email: input.contact_email ?? null,
      contact_phone: input.contact_phone ?? null,
      visible_to_accounts: input.visible_to_accounts ?? null,
    }).select("*").single();
    if (error) throw error;
    return data;
  }, [orgId]);
}

export function useUpdateMenu() {
  return useCallback(async (id: string, patch: Partial<MarketplaceMenu>) => {
    const { error } = await supabase.from("grow_marketplace_menus").update(patch as any).eq("id", id);
    if (error) throw error;
  }, []);
}

export interface MarketplaceBatch {
  id: string;
  barcode: string;
  product_id: string | null;
  strain_id: string | null;
  current_quantity: number;
  current_weight_grams: number | null;
  unit_cost: number | null;
  marketplace_menu_ids: string[] | null;
  product?: { name: string; ccrs_inventory_category: string | null; unit_price: number | null } | null;
  strain?: { name: string; type: string | null } | null;
  potency?: { thc_total_pct: number | null; cbd_total_pct: number | null } | null;
}

export function useMarketplaceItems(menuId?: string) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<MarketplaceBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("grow_batches").select("*").eq("org_id", orgId).eq("is_available", true).gt("current_quantity", 0);
      if (menuId) q = q.contains("marketplace_menu_ids", [menuId]);
      const { data: rows } = await q.order("created_at", { ascending: false });
      const ids = ((rows ?? []) as any[]).map((r) => r.id);
      const productIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.product_id).filter(Boolean)));
      const strainIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.strain_id).filter(Boolean)));
      const [pRes, sRes, qaLotsRes] = await Promise.all([
        productIds.length > 0 ? supabase.from("grow_products").select("id, name, ccrs_inventory_category, unit_price").in("id", productIds) : Promise.resolve({ data: [] }),
        strainIds.length > 0 ? supabase.from("grow_strains").select("id, name, type").in("id", strainIds) : Promise.resolve({ data: [] }),
        ids.length > 0 ? supabase.from("grow_qa_lots").select("id, parent_batch_id").in("parent_batch_id", ids) : Promise.resolve({ data: [] }),
      ]);
      const lotIds = ((qaLotsRes.data ?? []) as any[]).map((l) => l.id);
      const { data: qaResults } = lotIds.length > 0
        ? await supabase.from("grow_qa_results").select("qa_lot_id, thc_total_pct, cbd_total_pct").in("qa_lot_id", lotIds).order("test_date", { ascending: false })
        : { data: [] };
      const lotToBatch = new Map<string, string>(((qaLotsRes.data ?? []) as any[]).map((l) => [l.id, l.parent_batch_id]));
      const potencyByBatch = new Map<string, any>();
      ((qaResults ?? []) as any[]).forEach((r) => {
        const batchId = lotToBatch.get(r.qa_lot_id);
        if (batchId && !potencyByBatch.has(batchId)) potencyByBatch.set(batchId, { thc_total_pct: r.thc_total_pct, cbd_total_pct: r.cbd_total_pct });
      });
      const pById = new Map<string, any>((pRes.data ?? []).map((p: any) => [p.id, p]));
      const sById = new Map<string, any>((sRes.data ?? []).map((s: any) => [s.id, s]));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({
        ...r,
        product: r.product_id ? pById.get(r.product_id) ?? null : null,
        strain: r.strain_id ? sById.get(r.strain_id) ?? null : null,
        potency: potencyByBatch.get(r.id) ?? null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, menuId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useAddToMarketplace() {
  return useCallback(async (batchId: string, menuId: string) => {
    const { data: batch } = await supabase.from("grow_batches").select("marketplace_menu_ids").eq("id", batchId).maybeSingle();
    const current = ((batch as any)?.marketplace_menu_ids ?? []) as string[];
    if (current.includes(menuId)) return;
    const next = [...current, menuId];
    const { error } = await supabase.from("grow_batches").update({ marketplace_menu_ids: next }).eq("id", batchId);
    if (error) throw error;
  }, []);
}

export function useRemoveFromMarketplace() {
  return useCallback(async (batchId: string, menuId: string) => {
    const { data: batch } = await supabase.from("grow_batches").select("marketplace_menu_ids").eq("id", batchId).maybeSingle();
    const current = ((batch as any)?.marketplace_menu_ids ?? []) as string[];
    const next = current.filter((m) => m !== menuId);
    const { error } = await supabase.from("grow_batches").update({ marketplace_menu_ids: next.length > 0 ? next : null }).eq("id", batchId);
    if (error) throw error;
  }, []);
}

/** Public — no auth required. Used by /menu/:slug. */
export function usePublicMenu(slug: string | undefined) {
  const [menu, setMenu] = useState<MarketplaceMenu | null>(null);
  const [items, setItems] = useState<MarketplaceBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: menuRow, error: mErr } = await supabase.from("grow_marketplace_menus")
        .select("*").eq("public_slug", slug).eq("is_active", true).maybeSingle();
      if (mErr) { setError(mErr.message); setLoading(false); return; }
      if (!menuRow) { setError("Menu not found"); setLoading(false); return; }
      if (!menuRow.is_public) { setError("This menu is private"); setLoading(false); return; }
      const { data: batches } = await supabase.from("grow_batches").select("*")
        .eq("org_id", menuRow.org_id).eq("is_available", true).gt("current_quantity", 0)
        .contains("marketplace_menu_ids", [menuRow.id]).order("created_at", { ascending: false });
      const ids = ((batches ?? []) as any[]).map((r) => r.id);
      const productIds = Array.from(new Set(((batches ?? []) as any[]).map((r) => r.product_id).filter(Boolean)));
      const strainIds = Array.from(new Set(((batches ?? []) as any[]).map((r) => r.strain_id).filter(Boolean)));
      const [pRes, sRes, qaLotsRes] = await Promise.all([
        productIds.length > 0 ? supabase.from("grow_products").select("id, name, ccrs_inventory_category, unit_price").in("id", productIds) : Promise.resolve({ data: [] }),
        strainIds.length > 0 ? supabase.from("grow_strains").select("id, name, type").in("id", strainIds) : Promise.resolve({ data: [] }),
        ids.length > 0 ? supabase.from("grow_qa_lots").select("id, parent_batch_id").in("parent_batch_id", ids) : Promise.resolve({ data: [] }),
      ]);
      const lotIds = ((qaLotsRes.data ?? []) as any[]).map((l) => l.id);
      const { data: qaResults } = lotIds.length > 0
        ? await supabase.from("grow_qa_results").select("qa_lot_id, thc_total_pct, cbd_total_pct").in("qa_lot_id", lotIds)
        : { data: [] };
      const lotToBatch = new Map<string, string>(((qaLotsRes.data ?? []) as any[]).map((l) => [l.id, l.parent_batch_id]));
      const potencyByBatch = new Map<string, any>();
      ((qaResults ?? []) as any[]).forEach((r) => {
        const batchId = lotToBatch.get(r.qa_lot_id);
        if (batchId && !potencyByBatch.has(batchId)) potencyByBatch.set(batchId, { thc_total_pct: r.thc_total_pct, cbd_total_pct: r.cbd_total_pct });
      });
      const pById = new Map<string, any>((pRes.data ?? []).map((p: any) => [p.id, p]));
      const sById = new Map<string, any>((sRes.data ?? []).map((s: any) => [s.id, s]));
      if (cancelled) return;
      setMenu(menuRow as any);
      setItems(((batches ?? []) as any[]).map((r) => ({
        ...r,
        product: r.product_id ? pById.get(r.product_id) ?? null : null,
        strain: r.strain_id ? sById.get(r.strain_id) ?? null : null,
        potency: potencyByBatch.get(r.id) ?? null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  return { menu, items, loading, error };
}

export function useSubmitInquiry() {
  return useCallback(async (menuId: string, input: { company_name: string; license_number?: string; contact_email: string; phone?: string; message?: string }) => {
    // Store as an inquiry — we use grow_orders draft with a synthetic account_id placeholder, or
    // create a log entry. For now, record as an audit log entry so sales reps can follow up.
    const { data: menu } = await supabase.from("grow_marketplace_menus").select("org_id").eq("id", menuId).maybeSingle();
    if (!menu) throw new Error("Menu not found");
    await supabase.from("grow_audit_log").insert({
      org_id: menu.org_id,
      action: "marketplace_inquiry",
      entity_type: "marketplace_menu",
      entity_id: menuId,
      entity_name: input.company_name,
      user_email: input.contact_email,
      changes_json: input,
    });
  }, []);
}
