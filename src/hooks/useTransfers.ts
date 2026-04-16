import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { generateExternalId } from "@/lib/ccrs-id";
import { parseWCIAJSON } from "@/lib/ccrs/generateWCIAJSON";

/**
 * Inbound transfers are stored as grow_manifests with manifest_type='inbound'.
 * Items use grow_manifest_items; accepted ones get converted into grow_batches.
 */

export interface InboundTransfer {
  id: string;
  external_id: string;
  status: string | null;
  origin_license_number: string;
  origin_license_name: string | null;
  destination_license_number: string;
  destination_license_name: string | null;
  departure_datetime: string | null;
  arrival_datetime: string | null;
  wcia_json_url: string | null;
  wcia_json_data: any | null;
  notes: string | null;
  created_at: string | null;
  item_count?: number;
  source?: "wcia" | "manual";
}

export function useTransfers() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<InboundTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase
        .from("grow_manifests").select("*").eq("org_id", orgId).eq("manifest_type", "inbound")
        .order("created_at", { ascending: false });
      const ids = ((rows ?? []) as any[]).map((r) => r.id);
      const { data: items } = ids.length > 0
        ? await supabase.from("grow_manifest_items").select("manifest_id").in("manifest_id", ids)
        : { data: [] };
      const countById = new Map<string, number>();
      (items ?? []).forEach((i: any) => countById.set(i.manifest_id, (countById.get(i.manifest_id) ?? 0) + 1));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({
        ...r,
        item_count: countById.get(r.id) ?? 0,
        source: r.wcia_json_data ? "wcia" : "manual",
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useTransfer(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row } = await supabase.from("grow_manifests").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (cancelled) return;
      if (!row) { setData(null); setItems([]); setLoading(false); return; }
      const { data: itemRows } = await supabase.from("grow_manifest_items").select("*").eq("manifest_id", id);
      const batchIds = Array.from(new Set(((itemRows ?? []) as any[]).map((i) => i.batch_id).filter(Boolean)));
      const { data: batches } = batchIds.length > 0
        ? await supabase.from("grow_batches").select("id, barcode").in("id", batchIds)
        : { data: [] };
      const bById = new Map<string, any>((batches ?? []).map((b: any) => [b.id, b]));
      if (cancelled) return;
      setData(row);
      setItems(((itemRows ?? []) as any[]).map((i) => ({ ...i, batch: i.batch_id ? bById.get(i.batch_id) ?? null : null })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, items, loading, refresh };
}

export interface CreateTransferInput {
  origin_license_number: string;
  origin_license_name?: string | null;
  origin_address?: string | null;
  destination_license_number: string;
  destination_license_name?: string | null;
  arrival_datetime?: string | null;
  departure_datetime?: string | null;
  notes?: string | null;
  wcia_json_data?: any | null;
  items: Array<{
    inventory_external_identifier?: string | null;
    product_name?: string | null;
    quantity: number;
    unit_price?: number | null;
    labtest_external_identifier?: string | null;
    servings_per_unit?: number | null;
  }>;
}

export function useCreateTransfer() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: CreateTransferInput) => {
    if (!orgId) throw new Error("No active org");
    const { data: manifest, error } = await supabase.from("grow_manifests").insert({
      org_id: orgId,
      external_id: generateExternalId(),
      manifest_type: "inbound",
      status: "in_transit",
      origin_license_number: input.origin_license_number,
      origin_license_name: input.origin_license_name ?? null,
      origin_address: input.origin_address ?? null,
      destination_license_number: input.destination_license_number,
      destination_license_name: input.destination_license_name ?? null,
      arrival_datetime: input.arrival_datetime ?? null,
      departure_datetime: input.departure_datetime ?? null,
      notes: input.notes ?? null,
      wcia_json_data: input.wcia_json_data ?? null,
      created_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;

    if (input.items.length > 0) {
      // Items don't have batch_id yet — they're pending acceptance
      // Store metadata in a temp JSON on the manifest for now.
      // We can only insert manifest_items if we have batch_id, so we stage
      // pending items in wcia_json_data.pending_items field.
      const pendingItems = input.items.map((i, idx) => ({
        sort_order: idx,
        inventory_external_identifier: i.inventory_external_identifier,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        labtest_external_identifier: i.labtest_external_identifier,
        servings_per_unit: i.servings_per_unit,
      }));
      const mergedData = { ...(manifest!.wcia_json_data ?? {}), pending_items: pendingItems };
      await supabase.from("grow_manifests").update({ wcia_json_data: mergedData }).eq("id", manifest!.id);
    }
    return manifest;
  }, [orgId, user?.id]);
}

export function useAcceptTransfer() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (transferId: string, opts: { areaId: string; productMap?: Record<string, string> } = { areaId: "" }) => {
    if (!orgId) throw new Error("No active org");
    const { data: manifest } = await supabase.from("grow_manifests").select("*").eq("id", transferId).maybeSingle();
    if (!manifest) throw new Error("Transfer not found");
    const pending = (manifest.wcia_json_data as any)?.pending_items ?? [];
    const createdBatchIds: string[] = [];
    for (const item of pending as any[]) {
      const productId = opts.productMap?.[item.inventory_external_identifier ?? ""] ?? null;
      const barcode = item.inventory_external_identifier || `IN-${Date.now().toString().slice(-6)}-${item.sort_order ?? 0}`;
      const { data: batch } = await supabase.from("grow_batches").insert({
        org_id: orgId,
        external_id: item.inventory_external_identifier ?? generateExternalId(),
        barcode,
        product_id: productId,
        area_id: opts.areaId || null,
        source_type: "inbound_transfer",
        initial_quantity: item.quantity,
        current_quantity: item.quantity,
        initial_weight_grams: item.quantity,
        current_weight_grams: item.quantity,
        is_available: false,
        unit_cost: item.unit_price ?? null,
        created_by: user?.id ?? null,
      }).select("id").single();
      if (batch) {
        createdBatchIds.push(batch.id);
        await supabase.from("grow_manifest_items").insert({
          manifest_id: transferId,
          batch_id: batch.id,
          quantity: item.quantity,
          unit_price: item.unit_price ?? null,
          labtest_external_identifier: item.labtest_external_identifier ?? null,
          servings_per_unit: item.servings_per_unit ?? null,
          accepted_quantity: item.quantity,
          sort_order: item.sort_order,
        });
      }
    }
    await supabase.from("grow_manifests").update({ status: "accepted" }).eq("id", transferId);
    return { createdBatchIds };
  }, [orgId, user?.id]);
}

export function useRejectTransfer() {
  return useCallback(async (transferId: string) => {
    const { error } = await supabase.from("grow_manifests").update({ status: "rejected" }).eq("id", transferId);
    if (error) throw error;
  }, []);
}

export function useImportFromWCIA() {
  const { orgId } = useOrg();
  return useCallback(async (jsonInput: string | any, ourLicenseNumber: string) => {
    if (!orgId) throw new Error("No active org");
    const obj = typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;
    const parsed = parseWCIAJSON(obj);
    if (!parsed) throw new Error("Invalid WCIA JSON");
    return {
      origin_license_number: parsed.origin.licenseNumber,
      origin_license_name: parsed.origin.licenseeName,
      destination_license_number: parsed.destination.licenseNumber || ourLicenseNumber,
      destination_license_name: parsed.destination.licenseeName,
      arrival_datetime: parsed.manifest.arrival_datetime,
      departure_datetime: parsed.manifest.departure_datetime,
      notes: parsed.manifest.notes,
      wcia_json_data: parsed,
      items: parsed.items.map((i) => ({
        inventory_external_identifier: i.external_id ?? null,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        labtest_external_identifier: i.labtest_external_id ?? null,
        servings_per_unit: i.servings_per_unit ?? null,
      })),
    };
  }, [orgId]);
}

export function useTransferStats(transfers: InboundTransfer[]) {
  return useMemo(() => ({
    total: transfers.length,
    pending: transfers.filter((t) => t.status === "in_transit" || t.status === "generated").length,
    accepted: transfers.filter((t) => t.status === "accepted").length,
    rejected: transfers.filter((t) => t.status === "rejected").length,
  }), [transfers]);
}
