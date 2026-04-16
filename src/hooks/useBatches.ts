import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { generateExternalId } from "@/lib/ccrs-id";
import type { CcrsAdjustmentReason, CcrsInventoryCategory, StrainType } from "@/lib/schema-enums";

/** grow_batches row + common joins. */
export interface Batch {
  id: string;
  org_id: string;
  external_id: string;
  barcode: string;
  product_id: string | null;
  strain_id: string | null;
  area_id: string | null;
  harvest_id: string | null;
  production_run_id: string | null;
  parent_batch_id: string | null;
  qa_parent_batch_id: string | null;
  source_type: string | null;
  initial_quantity: number;
  current_quantity: number;
  initial_weight_grams: number | null;
  current_weight_grams: number | null;
  unit_cost: number | null;
  is_available: boolean | null;
  is_medical: boolean | null;
  is_doh_compliant: boolean | null;
  is_marketplace: boolean | null;
  is_employee_sample: boolean | null;
  is_trade_sample: boolean | null;
  is_non_cannabis: boolean | null;
  is_pack_to_order: boolean | null;
  marketplace_menu_ids: string[] | null;
  packaged_date: string | null;
  expiration_date: string | null;
  procurement_farm: string | null;
  procurement_license: string | null;
  notes: string | null;
  ccrs_created_by_username: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** joins */
  product?: { id: string; name: string; category: string | null; ccrs_inventory_category: CcrsInventoryCategory | null; unit_of_measure: string | null; sku: string | null } | null;
  strain?: { id: string; name: string; type: StrainType | null } | null;
  area?: { id: string; name: string; canopy_type: string | null } | null;
  parent_batch?: { id: string; barcode: string } | null;
  harvest?: { id: string; name: string } | null;
  production_run?: { id: string; name: string | null } | null;
  /** derived */
  qa_status?: "passed" | "failed" | "pending" | "not_required" | null;
  qa_source_batch_id?: string | null;
}

export interface BatchFilters {
  product_id?: string;
  strain_id?: string;
  area_id?: string;
  source_type?: string;
  is_available?: boolean;
  is_medical?: boolean;
  is_doh_compliant?: boolean;
  is_non_cannabis?: boolean;
  has_parent?: boolean;
  q?: string;
}

export interface BatchStats {
  total: number;
  available: number;
  quarantined: number;
  depleted: number;
  medical: number;
  totalWeight: number;
}

const PRODUCT_SELECT = "id, name, category, ccrs_inventory_category, unit_of_measure, sku";

async function fetchBatchJoins(batches: any[]) {
  const productIds = new Set<string>();
  const strainIds = new Set<string>();
  const areaIds = new Set<string>();
  const parentIds = new Set<string>();
  const harvestIds = new Set<string>();
  const productionIds = new Set<string>();
  batches.forEach((b) => {
    if (b.product_id) productIds.add(b.product_id);
    if (b.strain_id) strainIds.add(b.strain_id);
    if (b.area_id) areaIds.add(b.area_id);
    if (b.parent_batch_id) parentIds.add(b.parent_batch_id);
    if (b.harvest_id) harvestIds.add(b.harvest_id);
    if (b.production_run_id) productionIds.add(b.production_run_id);
  });
  const [productRes, strainRes, areaRes, parentRes, harvestRes, prodRes] = await Promise.all([
    productIds.size > 0 ? supabase.from("grow_products").select(PRODUCT_SELECT).in("id", Array.from(productIds)) : Promise.resolve({ data: [] }),
    strainIds.size > 0 ? supabase.from("grow_strains").select("id, name, type").in("id", Array.from(strainIds)) : Promise.resolve({ data: [] }),
    areaIds.size > 0 ? supabase.from("grow_areas").select("id, name, canopy_type").in("id", Array.from(areaIds)) : Promise.resolve({ data: [] }),
    parentIds.size > 0 ? supabase.from("grow_batches").select("id, barcode").in("id", Array.from(parentIds)) : Promise.resolve({ data: [] }),
    harvestIds.size > 0 ? supabase.from("grow_harvests").select("id, name").in("id", Array.from(harvestIds)) : Promise.resolve({ data: [] }),
    productionIds.size > 0 ? supabase.from("grow_production_runs").select("id, name").in("id", Array.from(productionIds)) : Promise.resolve({ data: [] }),
  ]);
  return {
    productById: new Map<string, any>((productRes.data ?? []).map((r: any) => [r.id, r])),
    strainById: new Map<string, any>((strainRes.data ?? []).map((r: any) => [r.id, r])),
    areaById: new Map<string, any>((areaRes.data ?? []).map((r: any) => [r.id, r])),
    parentById: new Map<string, any>((parentRes.data ?? []).map((r: any) => [r.id, r])),
    harvestById: new Map<string, any>((harvestRes.data ?? []).map((r: any) => [r.id, r])),
    productionById: new Map<string, any>((prodRes.data ?? []).map((r: any) => [r.id, r])),
  };
}

/** Compute a single QA status for a batch using the linked QA lot chain. */
async function resolveQaStatuses(batchIds: string[]): Promise<Map<string, { status: Batch["qa_status"]; source: string | null }>> {
  const out = new Map<string, { status: Batch["qa_status"]; source: string | null }>();
  if (batchIds.length === 0) return out;
  // QA lots for any of these batches (including those used as inheritance sources)
  const { data: lots } = await supabase
    .from("grow_qa_lots")
    .select("id, parent_batch_id, status")
    .in("parent_batch_id", batchIds);
  const lotIds = (lots ?? []).map((l: any) => l.id);
  const lotByBatch = new Map<string, any[]>();
  (lots ?? []).forEach((l: any) => {
    const arr = lotByBatch.get(l.parent_batch_id) ?? [];
    arr.push(l);
    lotByBatch.set(l.parent_batch_id, arr);
  });
  let resultsByLot = new Map<string, any[]>();
  if (lotIds.length > 0) {
    const { data: results } = await supabase
      .from("grow_qa_results")
      .select("id, qa_lot_id, overall_pass, lab_test_status")
      .in("qa_lot_id", lotIds);
    (results ?? []).forEach((r: any) => {
      const arr = resultsByLot.get(r.qa_lot_id) ?? [];
      arr.push(r);
      resultsByLot.set(r.qa_lot_id, arr);
    });
  }
  batchIds.forEach((id) => {
    const lots = lotByBatch.get(id) ?? [];
    if (lots.length === 0) {
      out.set(id, { status: null, source: null });
      return;
    }
    let hasPass = false; let hasFail = false; let hasPending = false;
    for (const lot of lots) {
      const res = resultsByLot.get(lot.id) ?? [];
      if (res.length === 0) { hasPending = true; continue; }
      for (const r of res) {
        if (r.overall_pass === true) hasPass = true;
        else if (r.overall_pass === false) hasFail = true;
        else hasPending = true;
      }
    }
    const status: Batch["qa_status"] = hasFail ? "failed" : hasPending ? "pending" : hasPass ? "passed" : "pending";
    out.set(id, { status, source: id });
  });
  return out;
}

export function useBatches(filters: BatchFilters = {}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const sig = [
    filters.product_id, filters.strain_id, filters.area_id, filters.source_type,
    filters.is_available == null ? "" : String(filters.is_available),
    filters.is_medical == null ? "" : String(filters.is_medical),
    filters.is_doh_compliant == null ? "" : String(filters.is_doh_compliant),
    filters.has_parent == null ? "" : String(filters.has_parent),
  ].join(":");

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("grow_batches").select("*").eq("org_id", orgId);
      if (filters.product_id) q = q.eq("product_id", filters.product_id);
      if (filters.strain_id) q = q.eq("strain_id", filters.strain_id);
      if (filters.area_id) q = q.eq("area_id", filters.area_id);
      if (filters.source_type) q = q.eq("source_type", filters.source_type);
      if (filters.is_available != null) q = q.eq("is_available", filters.is_available);
      if (filters.is_medical != null) q = q.eq("is_medical", filters.is_medical);
      if (filters.is_doh_compliant != null) q = q.eq("is_doh_compliant", filters.is_doh_compliant);
      if (filters.is_non_cannabis != null) q = q.eq("is_non_cannabis", filters.is_non_cannabis);
      if (filters.has_parent === true) q = q.not("parent_batch_id", "is", null);
      if (filters.has_parent === false) q = q.is("parent_batch_id", null);
      const { data: rows, error: err } = await q.order("created_at", { ascending: false, nullsFirst: false });
      if (cancelled) return;
      if (err) { setError(err.message); setLoading(false); return; }

      const joins = await fetchBatchJoins(rows ?? []);
      const qaChain = new Set<string>();
      (rows ?? []).forEach((b: any) => {
        qaChain.add(b.id);
        if (b.qa_parent_batch_id) qaChain.add(b.qa_parent_batch_id);
      });
      const qaMap = await resolveQaStatuses(Array.from(qaChain));
      if (cancelled) return;

      const merged: Batch[] = (rows ?? []).map((b: any) => {
        const qaSourceId = b.qa_parent_batch_id ?? b.id;
        const qaRes = qaMap.get(qaSourceId);
        return {
          ...b,
          product: b.product_id ? joins.productById.get(b.product_id) ?? null : null,
          strain: b.strain_id ? joins.strainById.get(b.strain_id) ?? null : null,
          area: b.area_id ? joins.areaById.get(b.area_id) ?? null : null,
          parent_batch: b.parent_batch_id ? joins.parentById.get(b.parent_batch_id) ?? null : null,
          harvest: b.harvest_id ? joins.harvestById.get(b.harvest_id) ?? null : null,
          production_run: b.production_run_id ? joins.productionById.get(b.production_run_id) ?? null : null,
          qa_status: qaRes?.status ?? null,
          qa_source_batch_id: qaRes?.status ? qaSourceId : null,
        } as Batch;
      });

      setData(merged);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, tick, sig]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}

export function useBatch(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row, error: err } = await supabase
        .from("grow_batches").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (cancelled) return;
      if (err) { setError(err.message); setLoading(false); return; }
      if (!row) { setData(null); setLoading(false); return; }

      const joins = await fetchBatchJoins([row]);
      const qaSourceId = (row as any).qa_parent_batch_id ?? row.id;
      const qaMap = await resolveQaStatuses([qaSourceId]);
      if (cancelled) return;

      setData({
        ...(row as any),
        product: row.product_id ? joins.productById.get(row.product_id) ?? null : null,
        strain: row.strain_id ? joins.strainById.get(row.strain_id) ?? null : null,
        area: row.area_id ? joins.areaById.get(row.area_id) ?? null : null,
        parent_batch: (row as any).parent_batch_id ? joins.parentById.get((row as any).parent_batch_id) ?? null : null,
        harvest: row.harvest_id ? joins.harvestById.get(row.harvest_id) ?? null : null,
        production_run: row.production_run_id ? joins.productionById.get(row.production_run_id) ?? null : null,
        qa_status: qaMap.get(qaSourceId)?.status ?? null,
        qa_source_batch_id: qaMap.get(qaSourceId)?.status ? qaSourceId : null,
      } as Batch);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}

// ─── Stats ───────────────────────────────────────────────────────────────────
export function useBatchStats(batches: Batch[]): BatchStats {
  return useMemo(() => {
    let available = 0, quarantined = 0, depleted = 0, medical = 0, totalWeight = 0;
    batches.forEach((b) => {
      const cq = Number(b.current_quantity ?? 0);
      const cw = Number(b.current_weight_grams ?? 0);
      if (cq === 0) depleted += 1;
      else if (b.is_available) available += 1;
      else quarantined += 1;
      if (b.is_medical) medical += 1;
      if (cq > 0) totalWeight += cw;
    });
    return { total: batches.length, available, quarantined, depleted, medical, totalWeight };
  }, [batches]);
}

// ─── Create ──────────────────────────────────────────────────────────────────
export interface CreateBatchInput {
  product_id: string;
  strain_id?: string | null;
  barcode: string;
  initial_quantity: number;
  area_id: string;
  source_type?: "manual" | "harvest" | "production" | "inbound_transfer" | "sublot";
  harvest_id?: string | null;
  production_run_id?: string | null;
  parent_batch_id?: string | null;
  qa_parent_batch_id?: string | null;
  is_available?: boolean;
  is_medical?: boolean;
  is_doh_compliant?: boolean;
  is_trade_sample?: boolean;
  is_employee_sample?: boolean;
  is_non_cannabis?: boolean;
  is_pack_to_order?: boolean;
  unit_cost?: number | null;
  procurement_farm?: string | null;
  procurement_license?: string | null;
  external_id?: string | null;
  expiration_date?: string | null;
  packaged_date?: string | null;
  notes?: string | null;
}

export function useCreateBatch() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: CreateBatchInput): Promise<Batch> => {
    if (!orgId) throw new Error("No active org");
    const { data, error: err } = await supabase
      .from("grow_batches")
      .insert({
        org_id: orgId,
        external_id: input.external_id?.trim() || generateExternalId(),
        barcode: input.barcode.trim(),
        product_id: input.product_id,
        strain_id: input.strain_id ?? null,
        area_id: input.area_id,
        harvest_id: input.harvest_id ?? null,
        production_run_id: input.production_run_id ?? null,
        parent_batch_id: input.parent_batch_id ?? null,
        qa_parent_batch_id: input.qa_parent_batch_id ?? null,
        source_type: input.source_type ?? "manual",
        initial_quantity: input.initial_quantity,
        current_quantity: input.initial_quantity,
        initial_weight_grams: input.initial_quantity,
        current_weight_grams: input.initial_quantity,
        is_available: input.is_available ?? false,
        is_medical: input.is_medical ?? false,
        is_doh_compliant: input.is_doh_compliant ?? false,
        is_trade_sample: input.is_trade_sample ?? false,
        is_employee_sample: input.is_employee_sample ?? false,
        is_non_cannabis: input.is_non_cannabis ?? false,
        is_pack_to_order: input.is_pack_to_order ?? false,
        unit_cost: input.unit_cost ?? null,
        procurement_farm: input.procurement_farm ?? null,
        procurement_license: input.procurement_license ?? null,
        expiration_date: input.expiration_date ?? null,
        packaged_date: input.packaged_date ?? null,
        notes: input.notes ?? null,
        created_by: user?.id ?? null,
      })
      .select("*").single();
    if (err) throw err;
    return data as unknown as Batch;
  }, [orgId, user?.id]);
}

export function useUpdateBatch() {
  return useCallback(async (id: string, patch: Partial<Batch>) => {
    const { data, error: err } = await supabase
      .from("grow_batches").update(patch as any).eq("id", id).select("*").single();
    if (err) throw err;
    return data as unknown as Batch;
  }, []);
}

export function useMakeBatchAvailable() {
  return useCallback(async (batchId: string) => {
    const { error: err } = await supabase
      .from("grow_batches").update({ is_available: true }).eq("id", batchId);
    if (err) throw err;
  }, []);
}

// ─── Sublot ──────────────────────────────────────────────────────────────────
export interface SublotInput {
  quantity: number;
  newBarcode?: string;
  areaId?: string | null;
  notes?: string | null;
  inheritQa?: boolean;
}

export function useSublotBatch() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (parentBatchId: string, input: SublotInput): Promise<Batch> => {
    if (!orgId) throw new Error("No active org");
    if (input.quantity <= 0) throw new Error("Quantity must be positive");

    const { data: parent, error: pErr } = await supabase
      .from("grow_batches").select("*").eq("id", parentBatchId).maybeSingle();
    if (pErr) throw pErr;
    if (!parent) throw new Error("Parent batch not found");
    const parentCurrent = Number((parent as any).current_quantity ?? 0);
    if (input.quantity > parentCurrent) throw new Error(`Quantity exceeds parent's current (${parentCurrent}g)`);

    const childBarcode = input.newBarcode?.trim() || `${(parent as any).barcode}-S${Date.now().toString().slice(-4)}`;

    const { data: child, error: cErr } = await supabase
      .from("grow_batches")
      .insert({
        org_id: orgId,
        external_id: generateExternalId(),
        barcode: childBarcode,
        product_id: (parent as any).product_id,
        strain_id: (parent as any).strain_id,
        area_id: input.areaId ?? (parent as any).area_id,
        parent_batch_id: parentBatchId,
        qa_parent_batch_id: input.inheritQa !== false
          ? ((parent as any).qa_parent_batch_id ?? parentBatchId)
          : null,
        source_type: "sublot",
        initial_quantity: input.quantity,
        current_quantity: input.quantity,
        initial_weight_grams: input.quantity,
        current_weight_grams: input.quantity,
        is_available: (parent as any).is_available ?? false,
        is_medical: (parent as any).is_medical ?? false,
        is_doh_compliant: (parent as any).is_doh_compliant ?? false,
        unit_cost: (parent as any).unit_cost ?? null,
        notes: input.notes ?? null,
        created_by: user?.id ?? null,
      })
      .select("*").single();
    if (cErr) throw cErr;

    const newParentQty = parentCurrent - input.quantity;
    const { error: uErr } = await supabase
      .from("grow_batches")
      .update({ current_quantity: newParentQty, current_weight_grams: newParentQty })
      .eq("id", parentBatchId);
    if (uErr) throw uErr;

    return child as unknown as Batch;
  }, [orgId, user?.id]);
}

export function useReturnToParent() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (childBatchId: string, quantity: number, reason?: string) => {
    if (!orgId) throw new Error("No active org");
    if (quantity <= 0) throw new Error("Quantity must be positive");

    const { data: child, error: cErr } = await supabase
      .from("grow_batches").select("*").eq("id", childBatchId).maybeSingle();
    if (cErr) throw cErr;
    if (!child) throw new Error("Child batch not found");
    const parentId = (child as any).parent_batch_id;
    if (!parentId) throw new Error("Batch has no parent to return to");
    const childCurrent = Number((child as any).current_quantity ?? 0);
    if (quantity > childCurrent) throw new Error(`Quantity exceeds child's current (${childCurrent}g)`);

    const { data: parent, error: pErr } = await supabase
      .from("grow_batches").select("current_quantity").eq("id", parentId).maybeSingle();
    if (pErr) throw pErr;
    if (!parent) throw new Error("Parent batch not found");
    const parentCurrent = Number((parent as any).current_quantity ?? 0);

    const newChildQty = childCurrent - quantity;
    const newParentQty = parentCurrent + quantity;

    await supabase.from("grow_batches")
      .update({ current_quantity: newChildQty, current_weight_grams: newChildQty })
      .eq("id", childBatchId);
    await supabase.from("grow_batches")
      .update({ current_quantity: newParentQty, current_weight_grams: newParentQty })
      .eq("id", parentId);

    const now = new Date().toISOString();
    await supabase.from("grow_inventory_adjustments").insert([
      {
        org_id: orgId,
        external_id: generateExternalId(),
        batch_id: childBatchId,
        adjustment_reason: "Reconciliation",
        adjustment_detail: `Returned ${quantity}g to parent${reason ? `: ${reason}` : ""}`,
        quantity_delta: -quantity,
        adjustment_date: now,
        adjusted_by: user?.id ?? null,
      },
      {
        org_id: orgId,
        external_id: generateExternalId(),
        batch_id: parentId,
        adjustment_reason: "Reconciliation",
        adjustment_detail: `Received ${quantity}g from child ${(child as any).barcode}${reason ? `: ${reason}` : ""}`,
        quantity_delta: quantity,
        adjustment_date: now,
        adjusted_by: user?.id ?? null,
      },
    ]);
  }, [orgId, user?.id]);
}

// ─── Adjust Inventory ────────────────────────────────────────────────────────
export interface AdjustInventoryInput {
  reason: CcrsAdjustmentReason;
  quantity: number; // signed — positive adds, negative subtracts
  detail?: string | null;
  adjustment_date?: string;
}

export function useAdjustInventory() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (batchId: string, input: AdjustInventoryInput) => {
    if (!orgId) throw new Error("No active org");
    if (input.quantity === 0) throw new Error("Quantity must be non-zero");

    const { data: batch, error: bErr } = await supabase
      .from("grow_batches").select("current_quantity").eq("id", batchId).maybeSingle();
    if (bErr) throw bErr;
    if (!batch) throw new Error("Batch not found");
    const current = Number((batch as any).current_quantity ?? 0);
    const next = current + input.quantity;
    if (next < 0) throw new Error(`Adjustment would leave negative quantity (${next}g)`);

    const date = input.adjustment_date ?? new Date().toISOString();
    const { error: aErr } = await supabase.from("grow_inventory_adjustments").insert({
      org_id: orgId,
      external_id: generateExternalId(),
      batch_id: batchId,
      adjustment_reason: input.reason,
      adjustment_detail: input.detail ?? null,
      quantity_delta: input.quantity,
      adjustment_date: date,
      adjusted_by: user?.id ?? null,
    });
    if (aErr) throw aErr;

    const { error: uErr } = await supabase
      .from("grow_batches")
      .update({ current_quantity: next, current_weight_grams: next })
      .eq("id", batchId);
    if (uErr) throw uErr;
  }, [orgId, user?.id]);
}

// ─── Related data ────────────────────────────────────────────────────────────
export function useBatchQAResults(batchId: string | undefined, qaSourceBatchId?: string | null) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const sourceId = qaSourceBatchId ?? batchId ?? null;

  useEffect(() => {
    if (!sourceId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: lots } = await supabase
        .from("grow_qa_lots").select("id, lot_number").eq("parent_batch_id", sourceId);
      const lotIds = (lots ?? []).map((l: any) => l.id);
      const lotById = new Map<string, any>((lots ?? []).map((l: any) => [l.id, l]));
      if (lotIds.length === 0) { if (!cancelled) { setData([]); setLoading(false); } return; }
      const { data: results } = await supabase
        .from("grow_qa_results").select("*").in("qa_lot_id", lotIds).order("test_date", { ascending: false });
      if (cancelled) return;
      setData(((results ?? []) as any[]).map((r) => ({ ...r, lot: lotById.get(r.qa_lot_id) ?? null })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sourceId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useBatchOrderHistory(batchId: string | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!batchId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: allocs } = await supabase
        .from("grow_order_allocations")
        .select("id, batch_id, order_item_id, quantity, created_at")
        .eq("batch_id", batchId);
      if (cancelled) return;
      const itemIds = (allocs ?? []).map((a: any) => a.order_item_id).filter(Boolean);
      if (itemIds.length === 0) { setData([]); setLoading(false); return; }
      const { data: items } = await supabase
        .from("grow_order_items").select("id, order_id, unit_price, quantity").in("id", itemIds);
      const orderIds = Array.from(new Set(((items ?? []) as any[]).map((i) => i.order_id).filter(Boolean)));
      const [ordersRes] = await Promise.all([
        orderIds.length > 0 ? supabase.from("grow_orders").select("id, order_number, status, account_id, created_at").in("id", orderIds) : Promise.resolve({ data: [] }),
      ]);
      const orderById = new Map<string, any>(((ordersRes.data ?? []) as any[]).map((o) => [o.id, o]));
      const itemById = new Map<string, any>(((items ?? []) as any[]).map((i) => [i.id, i]));
      if (cancelled) return;
      setData(((allocs ?? []) as any[]).map((a) => {
        const item = itemById.get(a.order_item_id);
        const order = item ? orderById.get(item.order_id) : null;
        return { ...a, item, order };
      }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [batchId]);

  return { data, loading };
}

export function useBatchAdjustments(batchId: string | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!batchId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase
        .from("grow_inventory_adjustments").select("*").eq("batch_id", batchId).order("adjustment_date", { ascending: false });
      if (cancelled) return;
      setData((rows ?? []) as any[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [batchId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useBatchChildren(parentBatchId: string | undefined) {
  const [data, setData] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!parentBatchId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase
        .from("grow_batches").select("*").eq("parent_batch_id", parentBatchId).order("created_at", { ascending: false });
      if (cancelled) return;
      const joins = await fetchBatchJoins(rows ?? []);
      const merged: Batch[] = ((rows ?? []) as any[]).map((b) => ({
        ...b,
        product: b.product_id ? joins.productById.get(b.product_id) ?? null : null,
        strain: b.strain_id ? joins.strainById.get(b.strain_id) ?? null : null,
        area: b.area_id ? joins.areaById.get(b.area_id) ?? null : null,
      }));
      setData(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [parentBatchId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}
