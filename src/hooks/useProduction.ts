import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { generateExternalId } from "@/lib/ccrs-id";
import type { CcrsInventoryCategory } from "@/lib/schema-enums";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BOMInput {
  id: string;
  bom_id: string;
  input_category: string;
  notes: string | null;
  sort_order: number | null;
}

export interface BOM {
  id: string;
  org_id: string;
  name: string;
  output_product_id: string | null;
  output_category: string | null;
  byproduct_category: string | null;
  notes: string | null;
  is_active: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  output_product?: { id: string; name: string; category: string | null; ccrs_inventory_category: CcrsInventoryCategory | null } | null;
  input_count?: number;
  run_count?: number;
  inputs?: BOMInput[];
}

export interface ProductionRun {
  id: string;
  org_id: string;
  bom_id: string | null;
  name: string;
  output_product_id: string;
  output_batch_id: string | null;
  area_id: string | null;
  status: string | null;
  planned_date: string | null;
  started_at: string | null;
  finalized_at: string | null;
  yield_quantity: number | null;
  yield_weight_grams: number | null;
  waste_weight_grams: number | null;
  requires_new_qa: boolean | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  bom?: { id: string; name: string } | null;
  output_product?: { id: string; name: string; category: string | null; ccrs_inventory_category: CcrsInventoryCategory | null } | null;
  output_batch?: { id: string; barcode: string } | null;
  area?: { id: string; name: string } | null;
  input_count?: number;
}

export interface ProductionInput {
  id: string;
  production_run_id: string;
  batch_id: string;
  quantity_used: number;
  weight_used_grams: number | null;
  created_at: string | null;
  batch?: { id: string; barcode: string; product_id: string | null; current_quantity: number; current_weight_grams: number | null } | null;
  product?: { id: string; name: string } | null;
}

// ─── BOMs ───────────────────────────────────────────────────────────────────

export function useBOMs(options: { is_active?: boolean } = {}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const sig = options.is_active == null ? "" : String(options.is_active);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("grow_boms").select("*").eq("org_id", orgId);
      if (options.is_active != null) q = q.eq("is_active", options.is_active);
      const { data: rows } = await q.order("name");
      const bomIds = (rows ?? []).map((r: any) => r.id);
      const productIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.output_product_id).filter(Boolean)));
      const [inputsRes, productsRes, runsRes] = await Promise.all([
        bomIds.length > 0 ? supabase.from("grow_bom_inputs").select("id, bom_id").in("bom_id", bomIds) : Promise.resolve({ data: [] }),
        productIds.length > 0 ? supabase.from("grow_products").select("id, name, category, ccrs_inventory_category").in("id", productIds) : Promise.resolve({ data: [] }),
        bomIds.length > 0 ? supabase.from("grow_production_runs").select("id, bom_id").in("bom_id", bomIds) : Promise.resolve({ data: [] }),
      ]);
      const inputCountByBom = new Map<string, number>();
      (inputsRes.data ?? []).forEach((i: any) => inputCountByBom.set(i.bom_id, (inputCountByBom.get(i.bom_id) ?? 0) + 1));
      const runCountByBom = new Map<string, number>();
      (runsRes.data ?? []).forEach((r: any) => { if (r.bom_id) runCountByBom.set(r.bom_id, (runCountByBom.get(r.bom_id) ?? 0) + 1); });
      const productById = new Map<string, any>((productsRes.data ?? []).map((p: any) => [p.id, p]));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({
        ...r,
        output_product: r.output_product_id ? productById.get(r.output_product_id) ?? null : null,
        input_count: inputCountByBom.get(r.id) ?? 0,
        run_count: runCountByBom.get(r.id) ?? 0,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, tick, sig]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useBOM(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<BOM | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row } = await supabase.from("grow_boms").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (cancelled) return;
      if (!row) { setData(null); setLoading(false); return; }
      const [inputsRes, productRes, runsRes] = await Promise.all([
        supabase.from("grow_bom_inputs").select("*").eq("bom_id", id).order("sort_order"),
        row.output_product_id ? supabase.from("grow_products").select("id, name, category, ccrs_inventory_category").eq("id", row.output_product_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("grow_production_runs").select("id").eq("bom_id", id),
      ]);
      if (cancelled) return;
      setData({
        ...(row as any),
        inputs: (inputsRes.data ?? []) as BOMInput[],
        output_product: (productRes as any).data ?? null,
        input_count: (inputsRes.data ?? []).length,
        run_count: (runsRes.data ?? []).length,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export interface CreateBOMInput {
  name: string;
  output_product_id?: string | null;
  output_category?: string | null;
  byproduct_category?: string | null;
  notes?: string | null;
  is_active?: boolean;
  inputs: Array<{ input_category: string; notes?: string | null; sort_order?: number }>;
}

export function useCreateBOM() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: CreateBOMInput): Promise<BOM> => {
    if (!orgId) throw new Error("No active org");
    const { data: bom, error } = await supabase.from("grow_boms").insert({
      org_id: orgId,
      name: input.name.trim(),
      output_product_id: input.output_product_id ?? null,
      output_category: input.output_category ?? null,
      byproduct_category: input.byproduct_category ?? null,
      notes: input.notes ?? null,
      is_active: input.is_active ?? true,
      created_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    if (input.inputs.length > 0) {
      const { error: iErr } = await supabase.from("grow_bom_inputs").insert(
        input.inputs.map((x, idx) => ({
          bom_id: bom!.id,
          input_category: x.input_category,
          notes: x.notes ?? null,
          sort_order: x.sort_order ?? idx,
        })),
      );
      if (iErr) throw iErr;
    }
    return bom as unknown as BOM;
  }, [orgId, user?.id]);
}

export function useUpdateBOM() {
  return useCallback(async (id: string, patch: Partial<BOM> & { inputs?: Array<{ input_category: string; notes?: string | null; sort_order?: number }> }) => {
    const { inputs, ...rest } = patch;
    const { error } = await supabase.from("grow_boms").update(rest as any).eq("id", id);
    if (error) throw error;
    if (inputs) {
      await supabase.from("grow_bom_inputs").delete().eq("bom_id", id);
      if (inputs.length > 0) {
        await supabase.from("grow_bom_inputs").insert(inputs.map((x, idx) => ({
          bom_id: id, input_category: x.input_category, notes: x.notes ?? null, sort_order: x.sort_order ?? idx,
        })));
      }
    }
  }, []);
}

export function useArchiveBOM() {
  return useCallback(async (id: string) => {
    const { error } = await supabase.from("grow_boms").update({ is_active: false }).eq("id", id);
    if (error) throw error;
  }, []);
}

// ─── Production Runs ────────────────────────────────────────────────────────

export function useProductionRuns(options: { status?: string; bom_id?: string; product_id?: string } = {}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<ProductionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const sig = `${options.status ?? ""}:${options.bom_id ?? ""}:${options.product_id ?? ""}`;

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("grow_production_runs").select("*").eq("org_id", orgId);
      if (options.status) q = q.eq("status", options.status);
      if (options.bom_id) q = q.eq("bom_id", options.bom_id);
      if (options.product_id) q = q.eq("output_product_id", options.product_id);
      const { data: rows } = await q.order("planned_date", { ascending: false, nullsFirst: false });
      const runIds = (rows ?? []).map((r: any) => r.id);
      const bomIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.bom_id).filter(Boolean)));
      const productIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.output_product_id).filter(Boolean)));
      const areaIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.area_id).filter(Boolean)));
      const batchIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.output_batch_id).filter(Boolean)));
      const [bomsRes, productsRes, areasRes, batchesRes, inputsRes] = await Promise.all([
        bomIds.length > 0 ? supabase.from("grow_boms").select("id, name").in("id", bomIds) : Promise.resolve({ data: [] }),
        productIds.length > 0 ? supabase.from("grow_products").select("id, name, category, ccrs_inventory_category").in("id", productIds) : Promise.resolve({ data: [] }),
        areaIds.length > 0 ? supabase.from("grow_areas").select("id, name").in("id", areaIds) : Promise.resolve({ data: [] }),
        batchIds.length > 0 ? supabase.from("grow_batches").select("id, barcode").in("id", batchIds) : Promise.resolve({ data: [] }),
        runIds.length > 0 ? supabase.from("grow_production_inputs").select("id, production_run_id").in("production_run_id", runIds) : Promise.resolve({ data: [] }),
      ]);
      const bomById = new Map<string, any>((bomsRes.data ?? []).map((b: any) => [b.id, b]));
      const productById = new Map<string, any>((productsRes.data ?? []).map((p: any) => [p.id, p]));
      const areaById = new Map<string, any>((areasRes.data ?? []).map((a: any) => [a.id, a]));
      const batchById = new Map<string, any>((batchesRes.data ?? []).map((b: any) => [b.id, b]));
      const inputCountByRun = new Map<string, number>();
      (inputsRes.data ?? []).forEach((i: any) => inputCountByRun.set(i.production_run_id, (inputCountByRun.get(i.production_run_id) ?? 0) + 1));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({
        ...r,
        bom: r.bom_id ? bomById.get(r.bom_id) ?? null : null,
        output_product: r.output_product_id ? productById.get(r.output_product_id) ?? null : null,
        output_batch: r.output_batch_id ? batchById.get(r.output_batch_id) ?? null : null,
        area: r.area_id ? areaById.get(r.area_id) ?? null : null,
        input_count: inputCountByRun.get(r.id) ?? 0,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, tick, sig]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useProductionRun(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<ProductionRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row } = await supabase.from("grow_production_runs").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (cancelled) return;
      if (!row) { setData(null); setLoading(false); return; }
      const [bomRes, productRes, areaRes, batchRes] = await Promise.all([
        row.bom_id ? supabase.from("grow_boms").select("id, name").eq("id", row.bom_id).maybeSingle() : Promise.resolve({ data: null }),
        row.output_product_id ? supabase.from("grow_products").select("id, name, category, ccrs_inventory_category").eq("id", row.output_product_id).maybeSingle() : Promise.resolve({ data: null }),
        row.area_id ? supabase.from("grow_areas").select("id, name").eq("id", row.area_id).maybeSingle() : Promise.resolve({ data: null }),
        row.output_batch_id ? supabase.from("grow_batches").select("id, barcode").eq("id", row.output_batch_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      setData({
        ...(row as any),
        bom: (bomRes as any).data ?? null,
        output_product: (productRes as any).data ?? null,
        area: (areaRes as any).data ?? null,
        output_batch: (batchRes as any).data ?? null,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export interface CreateProductionRunInput {
  bom_id?: string | null;
  name: string;
  output_product_id: string;
  planned_date?: string | null;
  area_id?: string | null;
  requires_new_qa?: boolean;
  notes?: string | null;
  inputs: Array<{ batch_id: string; quantity_used: number; weight_used_grams?: number | null }>;
}

export function useCreateProductionRun() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: CreateProductionRunInput): Promise<ProductionRun> => {
    if (!orgId) throw new Error("No active org");
    const { data: run, error } = await supabase.from("grow_production_runs").insert({
      org_id: orgId,
      bom_id: input.bom_id ?? null,
      name: input.name.trim(),
      output_product_id: input.output_product_id,
      planned_date: input.planned_date ?? null,
      area_id: input.area_id ?? null,
      requires_new_qa: input.requires_new_qa ?? true,
      status: "draft",
      notes: input.notes ?? null,
      created_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    if (input.inputs.length > 0) {
      const { error: iErr } = await supabase.from("grow_production_inputs").insert(input.inputs.map((x) => ({
        production_run_id: run!.id,
        batch_id: x.batch_id,
        quantity_used: x.quantity_used,
        weight_used_grams: x.weight_used_grams ?? x.quantity_used,
      })));
      if (iErr) throw iErr;
    }
    return run as unknown as ProductionRun;
  }, [orgId, user?.id]);
}

export function useUpdateProductionRun() {
  return useCallback(async (id: string, patch: Partial<ProductionRun>) => {
    const { error } = await supabase.from("grow_production_runs").update(patch as any).eq("id", id);
    if (error) throw error;
  }, []);
}

export function useStartProductionRun() {
  return useCallback(async (runId: string) => {
    const { error } = await supabase.from("grow_production_runs").update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    }).eq("id", runId);
    if (error) throw error;
  }, []);
}

export interface FinalizeRunInput {
  yield_quantity: number;
  yield_weight_grams: number;
  waste_weight_grams?: number | null;
  output_batch_barcode?: string;
  area_id?: string | null;
}

export function useFinalizeProductionRun() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (runId: string, input: FinalizeRunInput) => {
    if (!orgId) throw new Error("No active org");

    const { data: run } = await supabase.from("grow_production_runs")
      .select("*").eq("id", runId).maybeSingle();
    if (!run) throw new Error("Run not found");

    // 1. Create the output batch
    const barcode = input.output_batch_barcode?.trim() || `PROD-${Date.now().toString().slice(-8)}`;
    const { data: product } = await supabase.from("grow_products").select("strain_id").eq("id", run.output_product_id).maybeSingle();
    const { data: batch, error: bErr } = await supabase.from("grow_batches").insert({
      org_id: orgId,
      external_id: generateExternalId(),
      barcode,
      product_id: run.output_product_id,
      strain_id: product?.strain_id ?? null,
      area_id: input.area_id ?? run.area_id ?? null,
      production_run_id: runId,
      source_type: "production",
      initial_quantity: input.yield_quantity,
      current_quantity: input.yield_quantity,
      initial_weight_grams: input.yield_weight_grams,
      current_weight_grams: input.yield_weight_grams,
      is_available: false,
      created_by: user?.id ?? null,
    }).select("id, barcode").single();
    if (bErr) throw bErr;

    // 2. Decrement input batch quantities
    const { data: inputs } = await supabase.from("grow_production_inputs")
      .select("batch_id, quantity_used, weight_used_grams").eq("production_run_id", runId);
    for (const inp of (inputs ?? []) as any[]) {
      const { data: inBatch } = await supabase.from("grow_batches")
        .select("current_quantity, current_weight_grams").eq("id", inp.batch_id).maybeSingle();
      if (!inBatch) continue;
      const newQty = Math.max(0, Number(inBatch.current_quantity ?? 0) - Number(inp.quantity_used));
      const newWt = Math.max(0, Number(inBatch.current_weight_grams ?? 0) - Number(inp.weight_used_grams ?? inp.quantity_used));
      await supabase.from("grow_batches")
        .update({ current_quantity: newQty, current_weight_grams: newWt })
        .eq("id", inp.batch_id);
    }

    // 3. Update run status + output batch link
    const { error: uErr } = await supabase.from("grow_production_runs").update({
      status: "finalized",
      finalized_at: new Date().toISOString(),
      yield_quantity: input.yield_quantity,
      yield_weight_grams: input.yield_weight_grams,
      waste_weight_grams: input.waste_weight_grams ?? null,
      output_batch_id: batch!.id,
      area_id: input.area_id ?? run.area_id ?? null,
    }).eq("id", runId);
    if (uErr) throw uErr;

    return { batch_id: batch!.id, barcode: batch!.barcode };
  }, [orgId, user?.id]);
}

export function useVoidProductionRun() {
  return useCallback(async (runId: string) => {
    const { error } = await supabase.from("grow_production_runs").update({ status: "voided" }).eq("id", runId);
    if (error) throw error;
  }, []);
}

export function useProductionInputs(runId: string | undefined) {
  const [data, setData] = useState<ProductionInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!runId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase
        .from("grow_production_inputs").select("*").eq("production_run_id", runId);
      const batchIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.batch_id)));
      const { data: batches } = batchIds.length > 0
        ? await supabase.from("grow_batches").select("id, barcode, product_id, current_quantity, current_weight_grams").in("id", batchIds)
        : { data: [] };
      const productIds = Array.from(new Set(((batches ?? []) as any[]).map((b) => b.product_id).filter(Boolean)));
      const { data: products } = productIds.length > 0
        ? await supabase.from("grow_products").select("id, name").in("id", productIds)
        : { data: [] };
      const bById = new Map<string, any>((batches ?? []).map((b: any) => [b.id, b]));
      const pById = new Map<string, any>((products ?? []).map((p: any) => [p.id, p]));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => {
        const batch = bById.get(r.batch_id) ?? null;
        return {
          ...r,
          batch,
          product: batch?.product_id ? pById.get(batch.product_id) ?? null : null,
        };
      }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [runId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useProductionRunStats(runs: ProductionRun[]) {
  return useMemo(() => ({
    total: runs.length,
    draft: runs.filter((r) => r.status === "draft").length,
    in_progress: runs.filter((r) => r.status === "in_progress").length,
    finalized: runs.filter((r) => r.status === "finalized").length,
    voided: runs.filter((r) => r.status === "voided").length,
  }), [runs]);
}
