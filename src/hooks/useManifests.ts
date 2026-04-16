import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { generateExternalId } from "@/lib/ccrs-id";
import type { ManifestStatus, ManifestType } from "@/lib/schema-enums";

export interface Manifest {
  id: string;
  org_id: string;
  external_id: string;
  manifest_type: ManifestType;
  status: ManifestStatus | null;
  order_id: string | null;
  origin_license_number: string;
  origin_license_name: string | null;
  origin_address: string | null;
  origin_phone: string | null;
  origin_email: string | null;
  destination_license_number: string;
  destination_license_name: string | null;
  destination_address: string | null;
  destination_phone: string | null;
  destination_email: string | null;
  transportation_type: string | null;
  transporter_license_number: string | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_license_number: string | null;
  driver_phone: string | null;
  vehicle_id: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  vehicle_color: string | null;
  vehicle_vin: string | null;
  vehicle_license_plate: string | null;
  route_id: string | null;
  departure_datetime: string | null;
  arrival_datetime: string | null;
  ccrs_submitted_at: string | null;
  ccrs_confirmed_at: string | null;
  ccrs_manifest_pdf_url: string | null;
  ccrs_created_by_username: string | null;
  wcia_json_url: string | null;
  wcia_json_data: any | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** joined */
  order?: { id: string; order_number: string; account_id: string | null } | null;
  account?: { id: string; company_name: string } | null;
  driver?: { id: string; first_name: string | null; last_name: string | null } | null;
  vehicle?: { id: string; make: string; model: string; license_plate: string } | null;
  route?: { id: string; name: string; color: string | null } | null;
  item_count?: number;
}

export interface ManifestItem {
  id: string;
  manifest_id: string;
  batch_id: string | null;
  plant_id: string | null;
  quantity: number;
  unit_price: number | null;
  servings_per_unit: number | null;
  labtest_external_identifier: string | null;
  accepted_quantity: number | null;
  rejected_quantity: number | null;
  sort_order: number | null;
  /** joined */
  batch?: { id: string; barcode: string; product_id: string | null; external_id: string } | null;
  plant?: { id: string; plant_identifier: string | null } | null;
  product?: { id: string; name: string; ccrs_inventory_category: string | null } | null;
  strain?: { id: string; name: string } | null;
}

export interface ManifestFilters {
  status?: ManifestStatus;
  type?: ManifestType;
  order_id?: string;
}

export function useManifests(filters: ManifestFilters = {}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const sig = [filters.status, filters.type, filters.order_id].join(":");

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("grow_manifests").select("*").eq("org_id", orgId);
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.type) q = q.eq("manifest_type", filters.type);
      if (filters.order_id) q = q.eq("order_id", filters.order_id);
      const { data: rows } = await q.order("departure_datetime", { ascending: false, nullsFirst: false });
      const manifestIds = ((rows ?? []) as any[]).map((r) => r.id);
      const orderIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.order_id).filter(Boolean)));
      const driverIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.driver_id).filter(Boolean)));
      const vehicleIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.vehicle_id).filter(Boolean)));
      const routeIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.route_id).filter(Boolean)));
      const [ordersRes, driversRes, vehiclesRes, routesRes, itemsRes] = await Promise.all([
        orderIds.length > 0 ? supabase.from("grow_orders").select("id, order_number, account_id").in("id", orderIds) : Promise.resolve({ data: [] }),
        driverIds.length > 0 ? supabase.from("grow_drivers").select("id, first_name, last_name").in("id", driverIds) : Promise.resolve({ data: [] }),
        vehicleIds.length > 0 ? supabase.from("grow_vehicles").select("id, make, model, license_plate").in("id", vehicleIds) : Promise.resolve({ data: [] }),
        routeIds.length > 0 ? supabase.from("grow_routes").select("id, name, color").in("id", routeIds) : Promise.resolve({ data: [] }),
        manifestIds.length > 0 ? supabase.from("grow_manifest_items").select("manifest_id").in("manifest_id", manifestIds) : Promise.resolve({ data: [] }),
      ]);
      const accountIds = Array.from(new Set(((ordersRes.data ?? []) as any[]).map((o) => o.account_id).filter(Boolean)));
      const { data: accounts } = accountIds.length > 0
        ? await supabase.from("grow_accounts").select("id, company_name").in("id", accountIds)
        : { data: [] };
      const accountById = new Map<string, any>(((accounts ?? []) as any[]).map((a) => [a.id, a]));
      const orderById = new Map<string, any>((ordersRes.data ?? []).map((o: any) => [o.id, o]));
      const driverById = new Map<string, any>((driversRes.data ?? []).map((d: any) => [d.id, d]));
      const vehicleById = new Map<string, any>((vehiclesRes.data ?? []).map((v: any) => [v.id, v]));
      const routeById = new Map<string, any>((routesRes.data ?? []).map((r: any) => [r.id, r]));
      const countByManifest = new Map<string, number>();
      (itemsRes.data ?? []).forEach((i: any) => countByManifest.set(i.manifest_id, (countByManifest.get(i.manifest_id) ?? 0) + 1));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => {
        const order = r.order_id ? orderById.get(r.order_id) : null;
        const account = order?.account_id ? accountById.get(order.account_id) : null;
        return {
          ...r,
          order: order ?? null,
          account: account ?? null,
          driver: r.driver_id ? driverById.get(r.driver_id) ?? null : null,
          vehicle: r.vehicle_id ? vehicleById.get(r.vehicle_id) ?? null : null,
          route: r.route_id ? routeById.get(r.route_id) ?? null : null,
          item_count: countByManifest.get(r.id) ?? 0,
        };
      }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, tick, sig]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useManifest(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row } = await supabase.from("grow_manifests").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (cancelled) return;
      if (!row) { setData(null); setLoading(false); return; }
      const [orderRes, driverRes, vehicleRes, routeRes] = await Promise.all([
        row.order_id ? supabase.from("grow_orders").select("id, order_number, account_id").eq("id", row.order_id).maybeSingle() : Promise.resolve({ data: null }),
        row.driver_id ? supabase.from("grow_drivers").select("id, first_name, last_name").eq("id", row.driver_id).maybeSingle() : Promise.resolve({ data: null }),
        row.vehicle_id ? supabase.from("grow_vehicles").select("id, make, model, license_plate").eq("id", row.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
        row.route_id ? supabase.from("grow_routes").select("id, name, color").eq("id", row.route_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const order = (orderRes as any).data;
      const { data: account } = order?.account_id
        ? await supabase.from("grow_accounts").select("id, company_name").eq("id", order.account_id).maybeSingle()
        : { data: null };
      if (cancelled) return;
      setData({
        ...(row as any),
        order: order ?? null,
        account: account ?? null,
        driver: (driverRes as any).data ?? null,
        vehicle: (vehicleRes as any).data ?? null,
        route: (routeRes as any).data ?? null,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useManifestItems(manifestId: string | undefined) {
  const [data, setData] = useState<ManifestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!manifestId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_manifest_items").select("*").eq("manifest_id", manifestId).order("sort_order", { nullsFirst: false });
      const batchIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.batch_id).filter(Boolean)));
      const plantIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.plant_id).filter(Boolean)));
      const [batchesRes, plantsRes] = await Promise.all([
        batchIds.length > 0 ? supabase.from("grow_batches").select("id, barcode, product_id, strain_id, external_id").in("id", batchIds) : Promise.resolve({ data: [] }),
        plantIds.length > 0 ? supabase.from("grow_plants").select("id, plant_identifier").in("id", plantIds) : Promise.resolve({ data: [] }),
      ]);
      const productIds = Array.from(new Set(((batchesRes.data ?? []) as any[]).map((b) => b.product_id).filter(Boolean)));
      const strainIds = Array.from(new Set(((batchesRes.data ?? []) as any[]).map((b) => b.strain_id).filter(Boolean)));
      const [productsRes, strainsRes] = await Promise.all([
        productIds.length > 0 ? supabase.from("grow_products").select("id, name, ccrs_inventory_category").in("id", productIds) : Promise.resolve({ data: [] }),
        strainIds.length > 0 ? supabase.from("grow_strains").select("id, name").in("id", strainIds) : Promise.resolve({ data: [] }),
      ]);
      const batchById = new Map<string, any>((batchesRes.data ?? []).map((b: any) => [b.id, b]));
      const plantById = new Map<string, any>((plantsRes.data ?? []).map((p: any) => [p.id, p]));
      const productById = new Map<string, any>((productsRes.data ?? []).map((p: any) => [p.id, p]));
      const strainById = new Map<string, any>((strainsRes.data ?? []).map((s: any) => [s.id, s]));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => {
        const batch = r.batch_id ? batchById.get(r.batch_id) ?? null : null;
        return {
          ...r,
          batch,
          plant: r.plant_id ? plantById.get(r.plant_id) ?? null : null,
          product: batch?.product_id ? productById.get(batch.product_id) ?? null : null,
          strain: batch?.strain_id ? strainById.get(batch.strain_id) ?? null : null,
        };
      }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [manifestId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export interface CreateManifestInput {
  manifest_type: ManifestType;
  order_id?: string | null;
  origin_license_number: string;
  origin_license_name?: string | null;
  origin_address?: string | null;
  origin_phone?: string | null;
  origin_email?: string | null;
  destination_license_number: string;
  destination_license_name?: string | null;
  destination_address?: string | null;
  destination_phone?: string | null;
  destination_email?: string | null;
  transportation_type?: string | null;
  transporter_license_number?: string | null;
  driver_id?: string | null;
  driver_name?: string | null;
  driver_license_number?: string | null;
  driver_phone?: string | null;
  vehicle_id?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: string | null;
  vehicle_color?: string | null;
  vehicle_vin?: string | null;
  vehicle_license_plate?: string | null;
  route_id?: string | null;
  departure_datetime?: string | null;
  arrival_datetime?: string | null;
  notes?: string | null;
}

export function useCreateManifest() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: CreateManifestInput): Promise<Manifest> => {
    if (!orgId) throw new Error("No active org");
    const { data, error } = await supabase.from("grow_manifests").insert({
      org_id: orgId,
      external_id: generateExternalId(),
      status: "draft",
      ...input,
      created_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;

    // If linked to an order, auto-populate manifest items from order allocations
    if (input.order_id) {
      const { data: items } = await supabase.from("grow_order_items").select("id, quantity, unit_price, product_id").eq("order_id", input.order_id);
      const itemIds = ((items ?? []) as any[]).map((i) => i.id);
      if (itemIds.length > 0) {
        const { data: allocs } = await supabase.from("grow_order_allocations").select("*").in("order_item_id", itemIds);
        const itemById = new Map<string, any>(((items ?? []) as any[]).map((i) => [i.id, i]));
        const batchIds = Array.from(new Set(((allocs ?? []) as any[]).map((a) => a.batch_id)));
        const { data: qaLots } = batchIds.length > 0
          ? await supabase.from("grow_qa_lots").select("id, parent_batch_id, external_id").in("parent_batch_id", batchIds)
          : { data: [] };
        const qaByBatch = new Map<string, any>(((qaLots ?? []) as any[]).map((q) => [q.parent_batch_id, q]));
        const manifestItems = ((allocs ?? []) as any[]).map((a, idx) => {
          const item = itemById.get(a.order_item_id);
          return {
            manifest_id: data!.id,
            batch_id: a.batch_id,
            quantity: a.quantity,
            unit_price: item?.unit_price ?? null,
            labtest_external_identifier: qaByBatch.get(a.batch_id)?.external_id ?? null,
            sort_order: idx,
          };
        });
        if (manifestItems.length > 0) {
          await supabase.from("grow_manifest_items").insert(manifestItems);
        }
      }
      await supabase.from("grow_orders").update({ status: "manifested", manifested_at: new Date().toISOString() }).eq("id", input.order_id);
    }

    return data as unknown as Manifest;
  }, [orgId, user?.id]);
}

export function useUpdateManifest() {
  return useCallback(async (id: string, patch: Partial<Manifest>) => {
    const { error } = await supabase.from("grow_manifests").update(patch as any).eq("id", id);
    if (error) throw error;
  }, []);
}

export function useCancelManifest() {
  return useCallback(async (id: string) => {
    const { error } = await supabase.from("grow_manifests").update({ status: "cancelled" }).eq("id", id);
    if (error) throw error;
  }, []);
}

export function useManifestStats(manifests: Manifest[]) {
  return useMemo(() => {
    const byStatus: Record<string, number> = {};
    manifests.forEach((m) => { const s = m.status ?? "draft"; byStatus[s] = (byStatus[s] ?? 0) + 1; });
    return {
      total: manifests.length,
      draft: byStatus.draft ?? 0,
      generated: byStatus.generated ?? 0,
      uploaded: byStatus.uploaded_to_ccrs ?? 0,
      in_transit: byStatus.in_transit ?? 0,
      accepted: byStatus.accepted ?? 0,
    };
  }, [manifests]);
}
