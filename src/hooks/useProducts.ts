import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { generateExternalId } from "@/lib/ccrs-id";
import type {
  CcrsInventoryCategory, CcrsInventoryType,
  UnitOfMeasure, WeightDisplayFormat, StrainType,
} from "@/lib/schema-enums";
import { CCRS_CATEGORY_SKU_PREFIX } from "@/lib/schema-enums";

export interface Product {
  id: string;
  org_id: string;
  external_id: string;
  name: string;
  ccrs_inventory_category: CcrsInventoryCategory | null;
  ccrs_inventory_type: CcrsInventoryType | null;
  category: string | null;
  product_line_id: string | null;
  strain_id: string | null;
  sku: string | null;
  upc: string | null;
  description: string | null;
  image_url: string | null;
  unit_price: number | null;
  cost_per_unit: number | null;
  unit_of_measure: UnitOfMeasure | null;
  default_package_size: number | null;
  unit_weight_grams: number | null;
  package_size: string | null;
  servings_per_unit: number | null;
  is_taxable: boolean | null;
  tax_rate_override: number | null;
  is_medical: boolean | null;
  is_doh_compliant: boolean | null;
  is_trade_sample: boolean | null;
  is_employee_sample: boolean | null;
  requires_lab_testing: boolean | null;
  requires_child_resistant_packaging: boolean | null;
  warning_text: string | null;
  weight_display_format: WeightDisplayFormat | null;
  custom_label_notes: string | null;
  tags: string[] | null;
  sort_order: number | null;
  is_active: boolean | null;
  is_available: boolean | null;
  is_discontinued: boolean | null;
  label_template_id: string | null;
  ccrs_created_by_username: string | null;
  ccrs_updated_by_username: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Joined product line */
  product_line?: { id: string; name: string } | null;
  /** Joined strain */
  strain?: { id: string; name: string; type: StrainType | null } | null;
  /** Derived count: active batches (not destroyed/voided) */
  active_batch_count?: number;
}

export interface ProductInput {
  name: string;
  ccrs_inventory_category: CcrsInventoryCategory;
  ccrs_inventory_type: CcrsInventoryType;
  product_line_id?: string | null;
  strain_id?: string | null;
  sku?: string | null;
  upc?: string | null;
  description?: string | null;
  image_url?: string | null;
  unit_price?: number | null;
  cost_per_unit?: number | null;
  unit_of_measure?: UnitOfMeasure | null;
  default_package_size?: number | null;
  unit_weight_grams?: number | null;
  package_size?: string | null;
  servings_per_unit?: number | null;
  is_taxable?: boolean;
  tax_rate_override?: number | null;
  is_medical?: boolean;
  is_doh_compliant?: boolean;
  is_trade_sample?: boolean;
  is_employee_sample?: boolean;
  requires_lab_testing?: boolean;
  requires_child_resistant_packaging?: boolean;
  warning_text?: string | null;
  weight_display_format?: WeightDisplayFormat | null;
  custom_label_notes?: string | null;
  tags?: string[] | null;
  sort_order?: number | null;
  is_active?: boolean;
  /** Optional synonym for the legacy `category` column — auto-filled from ccrs_inventory_type when blank. */
  category?: string | null;
}

/** Suggest the next SKU for this category given the count of existing ones. */
export function suggestSku(category: CcrsInventoryCategory, existingSkus: string[]): string {
  const prefix = CCRS_CATEGORY_SKU_PREFIX[category];
  const used = new Set(existingSkus);
  let n = 1;
  while (true) {
    const candidate = `${prefix}-${String(n).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
    n++;
  }
}

export function useProducts() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [prodRes, lineRes, strainRes, batchRes] = await Promise.all([
        supabase.from("grow_products").select("*").eq("org_id", orgId).order("sort_order", { ascending: true }).order("name"),
        supabase.from("grow_product_lines").select("id, name").eq("org_id", orgId),
        supabase.from("grow_strains").select("id, name, type").eq("org_id", orgId),
        supabase.from("grow_batches").select("product_id, status").eq("org_id", orgId).not("status", "in", "(destroyed,voided)"),
      ]);
      if (cancelled) return;
      if (prodRes.error) { setError(prodRes.error.message); setLoading(false); return; }

      const lineById = new Map<string, any>();
      (lineRes.data ?? []).forEach((l: any) => lineById.set(l.id, l));
      const strainById = new Map<string, any>();
      (strainRes.data ?? []).forEach((s: any) => strainById.set(s.id, s));
      const batchCount = new Map<string, number>();
      (batchRes.data ?? []).forEach((b: any) => {
        if (!b.product_id) return;
        batchCount.set(b.product_id, (batchCount.get(b.product_id) ?? 0) + 1);
      });

      const merged = (prodRes.data ?? []).map((p: any) => ({
        ...p,
        product_line: p.product_line_id ? lineById.get(p.product_line_id) ?? null : null,
        strain: p.strain_id ? strainById.get(p.strain_id) ?? null : null,
        active_batch_count: batchCount.get(p.id) ?? 0,
      })) as Product[];

      setData(merged);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const createProduct = useCallback(async (input: ProductInput): Promise<Product> => {
    if (!orgId) throw new Error("No active org");
    const payload: any = {
      ...input,
      org_id: orgId,
      external_id: generateExternalId(),
      // Map CCRS type to the legacy `category` column when blank, so old code
      // that still reads `category` keeps working without a rename sweep.
      category: input.category ?? input.ccrs_inventory_type,
      is_active: input.is_active ?? true,
      is_available: input.is_active ?? true,
    };
    const { data: row, error: err } = await supabase.from("grow_products").insert(payload).select("*").single();
    if (err) throw err;
    refresh();
    return row as Product;
  }, [orgId, refresh]);

  const updateProduct = useCallback(async (id: string, patch: Partial<ProductInput>) => {
    const next: any = { ...patch };
    if (patch.ccrs_inventory_type && patch.category === undefined) next.category = patch.ccrs_inventory_type;
    const { data: row, error: err } = await supabase.from("grow_products").update(next).eq("id", id).select("*").single();
    if (err) throw err;
    refresh();
    return row as Product;
  }, [refresh]);

  const archiveProduct = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from("grow_products")
      .update({ is_active: false, is_available: false, is_discontinued: true })
      .eq("id", id);
    if (err) throw err;
    refresh();
  }, [refresh]);

  const duplicateProduct = useCallback(async (product: Product): Promise<Product> => {
    if (!orgId) throw new Error("No active org");
    let name = `${product.name} (copy)`;
    let suffix = 1;
    while (true) {
      const { data: existing } = await supabase.from("grow_products").select("id").eq("org_id", orgId).eq("name", name).maybeSingle();
      if (!existing) break;
      suffix++;
      name = `${product.name} (copy ${suffix})`;
    }
    const { id: _id, created_at: _c, updated_at: _u, external_id: _e, product_line: _pl, strain: _s, active_batch_count: _b, ...rest } = product;
    const { data: row, error: err } = await supabase
      .from("grow_products")
      .insert({ ...rest, name, external_id: generateExternalId(), sku: null })
      .select("*")
      .single();
    if (err) throw err;
    refresh();
    return row as Product;
  }, [orgId, refresh]);

  return { data, loading, error, refresh, createProduct, updateProduct, archiveProduct, duplicateProduct };
}

export function useProductStats(products: Product[]) {
  return useMemo(() => ({
    total: products.length,
    active: products.filter((p) => p.is_active).length,
    propagation: products.filter((p) => p.ccrs_inventory_category === "PropagationMaterial").length,
    harvested: products.filter((p) => p.ccrs_inventory_category === "HarvestedMaterial").length,
    intermediate: products.filter((p) => p.ccrs_inventory_category === "IntermediateProduct").length,
    endProduct: products.filter((p) => p.ccrs_inventory_category === "EndProduct").length,
  }), [products]);
}

export function useProduct(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row, error: err } = await supabase
        .from("grow_products")
        .select("*")
        .eq("id", id)
        .eq("org_id", orgId)
        .maybeSingle();
      if (cancelled) return;
      if (err) { setError(err.message); setLoading(false); return; }
      if (!row) { setData(null); setLoading(false); return; }

      const [lineRes, strainRes, batchRes] = await Promise.all([
        row.product_line_id ? supabase.from("grow_product_lines").select("id, name").eq("id", row.product_line_id).maybeSingle() : Promise.resolve({ data: null }),
        row.strain_id ? supabase.from("grow_strains").select("id, name, type").eq("id", row.strain_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("grow_batches").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("product_id", id).not("status", "in", "(destroyed,voided)"),
      ]);
      if (cancelled) return;

      setData({
        ...(row as any),
        product_line: (lineRes as any).data ?? null,
        strain: (strainRes as any).data ?? null,
        active_batch_count: batchRes.count ?? 0,
      } as Product);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}

// ─── Related records for the detail page ─────────────────────────────────────

export function useProductBatches(productId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !productId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: batches } = await supabase
        .from("grow_batches")
        .select("*")
        .eq("org_id", orgId)
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const strainIds = Array.from(new Set((batches ?? []).map((b: any) => b.strain_id).filter(Boolean))) as string[];
      const strainById = new Map<string, any>();
      if (strainIds.length > 0) {
        const { data: strains } = await supabase.from("grow_strains").select("id, name").in("id", strainIds);
        (strains ?? []).forEach((s: any) => strainById.set(s.id, s));
      }
      setData(((batches ?? []) as any[]).map((b) => ({ ...b, strain: b.strain_id ? strainById.get(b.strain_id) ?? null : null })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, productId]);

  return { data, loading };
}

export function useProductSalesHistory(productId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !productId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      // grow_order_items may not yet exist. Attempt; silently fall back to empty.
      const { data: items, error } = await supabase
        .from("grow_order_items")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) { setData([]); setLoading(false); return; }

      const orderIds = Array.from(new Set((items ?? []).map((i: any) => i.order_id).filter(Boolean))) as string[];
      const orderById = new Map<string, any>();
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from("grow_orders")
          .select("id, order_number, account_id, created_at, status")
          .in("id", orderIds);
        (orders ?? []).forEach((o: any) => orderById.set(o.id, o));
      }
      const accountIds = Array.from(new Set((Array.from(orderById.values())).map((o: any) => o.account_id).filter(Boolean))) as string[];
      const accountById = new Map<string, any>();
      if (accountIds.length > 0) {
        const { data: accs } = await supabase.from("grow_accounts").select("id, company_name").in("id", accountIds);
        (accs ?? []).forEach((a: any) => accountById.set(a.id, a));
      }
      setData(((items ?? []) as any[]).map((i) => {
        const order = orderById.get(i.order_id);
        return {
          ...i,
          order,
          account: order?.account_id ? accountById.get(order.account_id) ?? null : null,
        };
      }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, productId]);

  return { data, loading };
}

export function useProductLabResults(productId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !productId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      // Find batches for this product, then QA results on those batches
      const { data: batches } = await supabase.from("grow_batches").select("id, external_id").eq("org_id", orgId).eq("product_id", productId);
      const batchIds = (batches ?? []).map((b: any) => b.id);
      if (batchIds.length === 0) { if (!cancelled) { setData([]); setLoading(false); } return; }
      const { data: results } = await supabase
        .from("grow_qa_results")
        .select("*")
        .eq("org_id", orgId)
        .in("batch_id", batchIds)
        .order("test_completed_at", { ascending: false });
      if (cancelled) return;
      const batchById = new Map<string, any>();
      (batches ?? []).forEach((b: any) => batchById.set(b.id, b));
      setData(((results ?? []) as any[]).map((r) => ({ ...r, batch: batchById.get(r.batch_id) ?? null })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, productId]);

  return { data, loading };
}

export function useProductPricing(productId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !productId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: items } = await supabase
        .from("grow_price_list_items")
        .select("*")
        .eq("product_id", productId);
      if (cancelled) return;
      const listIds = Array.from(new Set((items ?? []).map((i: any) => i.price_list_id).filter(Boolean))) as string[];
      const listById = new Map<string, any>();
      if (listIds.length > 0) {
        const { data: lists } = await supabase
          .from("grow_price_lists")
          .select("id, name, is_default, is_active")
          .in("id", listIds);
        (lists ?? []).forEach((l: any) => listById.set(l.id, l));
      }
      setData(((items ?? []) as any[]).map((i) => ({ ...i, price_list: listById.get(i.price_list_id) ?? null })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, productId]);

  return { data, loading };
}
