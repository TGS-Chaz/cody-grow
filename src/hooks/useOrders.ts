import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { generateExternalId } from "@/lib/ccrs-id";
import type { OrderStatus, OrderSaleType } from "@/lib/schema-enums";

export interface Order {
  id: string;
  org_id: string;
  account_id: string;
  order_number: string;
  status: OrderStatus | null;
  sale_type: OrderSaleType | null;
  subtotal: number | null;
  discount_total: number | null;
  tax_total: number | null;
  charges_total: number | null;
  total: number | null;
  notes: string | null;
  is_non_cannabis: boolean | null;
  is_trade_sample: boolean | null;
  sale_external_identifier: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  released_at: string | null;
  manifested_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** joined */
  account?: { id: string; company_name: string; license_number: string | null } | null;
  item_count?: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number | null;
  discount_amount: number | null;
  sales_tax: number | null;
  other_tax: number | null;
  line_total: number;
  notes: string | null;
  sort_order: number | null;
  sale_detail_external_identifier: string | null;
  /** joined */
  product?: { id: string; name: string; category: string | null; ccrs_inventory_category: string | null; is_doh_compliant: boolean | null; unit_price: number | null; servings_per_unit: number | null; unit_weight_grams: number | null } | null;
  allocated_quantity?: number;
}

export interface OrderAllocation {
  id: string;
  order_item_id: string;
  batch_id: string;
  quantity: number;
  new_barcode: string | null;
  created_at: string | null;
  batch?: { id: string; barcode: string; current_quantity: number | null; product_id: string | null } | null;
  item?: OrderItem | null;
  product?: { id: string; name: string } | null;
}

export interface OrderFilters {
  account_id?: string;
  status?: OrderStatus;
  sale_type?: OrderSaleType;
  page?: number;
  pageSize?: number;
}

export function useOrders(filters: OrderFilters = {}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const sig = [filters.account_id, filters.status, filters.sale_type, filters.page ?? "", filters.pageSize ?? ""].join(":");
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setTotalCount(0); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const paginated = filters.page != null && filters.pageSize != null;
      let q = paginated
        ? supabase.from("grow_orders").select("*", { count: "exact" }).eq("org_id", orgId)
        : supabase.from("grow_orders").select("*").eq("org_id", orgId);
      if (filters.account_id) q = q.eq("account_id", filters.account_id);
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.sale_type) q = q.eq("sale_type", filters.sale_type);
      q = q.order("created_at", { ascending: false, nullsFirst: false });
      if (paginated) {
        const from = (filters.page! - 1) * filters.pageSize!;
        q = q.range(from, from + filters.pageSize! - 1);
      }
      const { data: rows, count } = await q;
      if (paginated) setTotalCount(count ?? 0);
      const accountIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.account_id).filter(Boolean)));
      const orderIds = ((rows ?? []) as any[]).map((r) => r.id);
      const [accountsRes, itemsRes] = await Promise.all([
        accountIds.length > 0 ? supabase.from("grow_accounts").select("id, company_name, license_number").in("id", accountIds) : Promise.resolve({ data: [] }),
        orderIds.length > 0 ? supabase.from("grow_order_items").select("order_id").in("order_id", orderIds) : Promise.resolve({ data: [] }),
      ]);
      const accountById = new Map<string, any>((accountsRes.data ?? []).map((a: any) => [a.id, a]));
      const countByOrder = new Map<string, number>();
      (itemsRes.data ?? []).forEach((i: any) => countByOrder.set(i.order_id, (countByOrder.get(i.order_id) ?? 0) + 1));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({
        ...r,
        account: r.account_id ? accountById.get(r.account_id) ?? null : null,
        item_count: countByOrder.get(r.id) ?? 0,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, tick, sig]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh, totalCount };
}

export function useOrder(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row } = await supabase.from("grow_orders").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (cancelled) return;
      if (!row) { setData(null); setLoading(false); return; }
      const { data: account } = row.account_id
        ? await supabase.from("grow_accounts").select("id, company_name, license_number").eq("id", row.account_id).maybeSingle()
        : { data: null };
      if (cancelled) return;
      setData({ ...(row as any), account: account ?? null });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useOrderItems(orderId: string | undefined) {
  const [data, setData] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!orderId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_order_items").select("*").eq("order_id", orderId).order("sort_order", { nullsFirst: false });
      const productIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.product_id).filter(Boolean)));
      const itemIds = ((rows ?? []) as any[]).map((r) => r.id);
      const [productsRes, allocsRes] = await Promise.all([
        productIds.length > 0 ? supabase.from("grow_products").select("id, name, category, ccrs_inventory_category, is_doh_compliant, unit_price, servings_per_unit, unit_weight_grams").in("id", productIds) : Promise.resolve({ data: [] }),
        itemIds.length > 0 ? supabase.from("grow_order_allocations").select("order_item_id, quantity").in("order_item_id", itemIds) : Promise.resolve({ data: [] }),
      ]);
      const productById = new Map<string, any>((productsRes.data ?? []).map((p: any) => [p.id, p]));
      const allocByItem = new Map<string, number>();
      (allocsRes.data ?? []).forEach((a: any) => allocByItem.set(a.order_item_id, (allocByItem.get(a.order_item_id) ?? 0) + Number(a.quantity ?? 0)));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({
        ...r,
        product: productById.get(r.product_id) ?? null,
        allocated_quantity: allocByItem.get(r.id) ?? 0,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orderId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useOrderAllocations(orderId: string | undefined) {
  const [data, setData] = useState<OrderAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!orderId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: items } = await supabase.from("grow_order_items").select("*").eq("order_id", orderId);
      const itemIds = ((items ?? []) as any[]).map((i) => i.id);
      const { data: allocs } = itemIds.length > 0
        ? await supabase.from("grow_order_allocations").select("*").in("order_item_id", itemIds)
        : { data: [] };
      const batchIds = Array.from(new Set(((allocs ?? []) as any[]).map((a) => a.batch_id).filter(Boolean)));
      const productIds = Array.from(new Set(((items ?? []) as any[]).map((i) => i.product_id).filter(Boolean)));
      const [batchesRes, productsRes] = await Promise.all([
        batchIds.length > 0 ? supabase.from("grow_batches").select("id, barcode, current_quantity, product_id").in("id", batchIds) : Promise.resolve({ data: [] }),
        productIds.length > 0 ? supabase.from("grow_products").select("id, name").in("id", productIds) : Promise.resolve({ data: [] }),
      ]);
      const batchById = new Map<string, any>((batchesRes.data ?? []).map((b: any) => [b.id, b]));
      const productById = new Map<string, any>((productsRes.data ?? []).map((p: any) => [p.id, p]));
      const itemById = new Map<string, any>(((items ?? []) as any[]).map((i) => [i.id, i]));
      if (cancelled) return;
      setData(((allocs ?? []) as any[]).map((a) => {
        const item = itemById.get(a.order_item_id);
        return {
          ...a,
          batch: batchById.get(a.batch_id) ?? null,
          item,
          product: item ? productById.get(item.product_id) ?? null : null,
        };
      }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orderId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export interface CreateOrderInput {
  account_id: string;
  sale_type: OrderSaleType;
  is_trade_sample?: boolean;
  is_non_cannabis?: boolean;
  notes?: string | null;
  delivery_notes?: string | null;
  sale_external_identifier?: string | null;
}

export function useCreateOrder() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: CreateOrderInput): Promise<Order> => {
    if (!orgId) throw new Error("No active org");
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const orderNumber = `ORD-${date}-${now.getTime().toString().slice(-4)}`;
    const { data, error } = await supabase.from("grow_orders").insert({
      org_id: orgId,
      account_id: input.account_id,
      order_number: orderNumber,
      status: "draft",
      sale_type: input.sale_type,
      is_trade_sample: input.is_trade_sample ?? false,
      is_non_cannabis: input.is_non_cannabis ?? false,
      sale_external_identifier: input.sale_external_identifier ?? generateExternalId(),
      notes: input.notes ?? null,
      delivery_notes: input.delivery_notes ?? null,
      subtotal: 0,
      total: 0,
      created_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    return data as unknown as Order;
  }, [orgId, user?.id]);
}

export function useUpdateOrder() {
  return useCallback(async (id: string, patch: Partial<Order>) => {
    const { error } = await supabase.from("grow_orders").update(patch as any).eq("id", id);
    if (error) throw error;
  }, []);
}

export function useCancelOrder() {
  return useCallback(async (id: string) => {
    const { error } = await supabase.from("grow_orders").update({ status: "cancelled" }).eq("id", id);
    if (error) throw error;
  }, []);
}

export interface AddOrderItemInput {
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount?: number | null;
  notes?: string | null;
  sale_type?: OrderSaleType | null;
  is_doh_compliant?: boolean;
}

export function useAddOrderItem() {
  return useCallback(async (input: AddOrderItemInput): Promise<OrderItem> => {
    // Tax calc: medical exempt for DOH-compliant products on medical orders
    const isMedical = input.sale_type === "RecreationalMedical";
    const medicalExempt = isMedical && input.is_doh_compliant;
    const subtotal = input.quantity * input.unit_price;
    const discount = Number(input.discount ?? 0);
    const afterDiscount = Math.max(0, subtotal - discount);
    const salesTax = medicalExempt ? 0 : Number((afterDiscount * 0.37).toFixed(2)); // WA excise tax ~37% for recreational
    const lineTotal = Number((afterDiscount + salesTax).toFixed(2));

    const { data, error } = await supabase.from("grow_order_items").insert({
      order_id: input.order_id,
      product_id: input.product_id,
      quantity: input.quantity,
      unit_price: input.unit_price,
      discount: discount || null,
      discount_amount: discount || null,
      sales_tax: salesTax || null,
      other_tax: null,
      line_total: lineTotal,
      notes: input.notes ?? null,
      sale_detail_external_identifier: generateExternalId(),
    }).select("*").single();
    if (error) throw error;
    await recomputeOrderTotals(input.order_id);
    return data as unknown as OrderItem;
  }, []);
}

export function useRemoveOrderItem() {
  return useCallback(async (itemId: string, orderId: string) => {
    await supabase.from("grow_order_allocations").delete().eq("order_item_id", itemId);
    const { error } = await supabase.from("grow_order_items").delete().eq("id", itemId);
    if (error) throw error;
    await recomputeOrderTotals(orderId);
  }, []);
}

export function useUpdateOrderItem() {
  return useCallback(async (itemId: string, orderId: string, patch: Partial<OrderItem>) => {
    const { error } = await supabase.from("grow_order_items").update(patch as any).eq("id", itemId);
    if (error) throw error;
    await recomputeOrderTotals(orderId);
  }, []);
}

async function recomputeOrderTotals(orderId: string) {
  const { data: items } = await supabase.from("grow_order_items").select("quantity, unit_price, discount, sales_tax, other_tax, line_total").eq("order_id", orderId);
  let subtotal = 0, discount = 0, tax = 0, total = 0;
  for (const i of (items ?? []) as any[]) {
    const sub = Number(i.quantity ?? 0) * Number(i.unit_price ?? 0);
    subtotal += sub;
    discount += Number(i.discount ?? 0);
    tax += Number(i.sales_tax ?? 0) + Number(i.other_tax ?? 0);
    total += Number(i.line_total ?? 0);
  }
  await supabase.from("grow_orders").update({
    subtotal: Number(subtotal.toFixed(2)),
    discount_total: Number(discount.toFixed(2)),
    tax_total: Number(tax.toFixed(2)),
    total: Number(total.toFixed(2)),
  }).eq("id", orderId);
}

// ─── Allocations ────────────────────────────────────────────────────────────

export interface PackToOrderSuggestion {
  item_id: string;
  product_id: string;
  quantity_needed: number;
  source_batch: { id: string; barcode: string; current_quantity: number };
}

export interface AllocateResult {
  fulfilled: number;
  unfulfilled: number;
  packToOrderSuggestions: PackToOrderSuggestion[];
}

export function useAllocateOrder() {
  return useCallback(async (orderId: string): Promise<AllocateResult> => {
    const { data: items } = await supabase.from("grow_order_items").select("*").eq("order_id", orderId);
    let fulfilled = 0, unfulfilled = 0;
    const packToOrderSuggestions: PackToOrderSuggestion[] = [];

    for (const item of (items ?? []) as any[]) {
      // Check existing allocations
      const { data: existingAllocs } = await supabase.from("grow_order_allocations")
        .select("quantity").eq("order_item_id", item.id);
      const alreadyAllocated = ((existingAllocs ?? []) as any[]).reduce((s, a) => s + Number(a.quantity ?? 0), 0);
      let remaining = Number(item.quantity ?? 0) - alreadyAllocated;
      if (remaining <= 0) { fulfilled++; continue; }

      // Find available batches (FIFO by created_at, matching product, available=true).
      // Pack-to-order batches are surfaced separately so the user can package first.
      const { data: batches } = await supabase.from("grow_batches")
        .select("id, current_quantity, current_weight_grams, barcode, is_pack_to_order")
        .eq("product_id", item.product_id).eq("is_available", true).gt("current_quantity", 0)
        .order("created_at", { ascending: true });

      const regular = ((batches ?? []) as any[]).filter((b) => !b.is_pack_to_order);
      const packToOrder = ((batches ?? []) as any[]).filter((b) => b.is_pack_to_order);

      for (const batch of regular) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, Number(batch.current_quantity));
        await supabase.from("grow_order_allocations").insert({
          order_item_id: item.id,
          batch_id: batch.id,
          quantity: take,
        });
        const newQty = Number(batch.current_quantity) - take;
        await supabase.from("grow_batches").update({
          current_quantity: newQty,
          current_weight_grams: newQty,
        }).eq("id", batch.id);
        remaining -= take;
      }

      if (remaining > 0) {
        // See if a pack-to-order batch could cover the remainder
        const source = packToOrder.find((b) => Number(b.current_quantity) >= remaining);
        if (source) {
          packToOrderSuggestions.push({
            item_id: item.id,
            product_id: item.product_id,
            quantity_needed: remaining,
            source_batch: { id: source.id, barcode: source.barcode, current_quantity: Number(source.current_quantity) },
          });
        }
        unfulfilled++;
      } else {
        fulfilled++;
      }
    }

    if ((items ?? []).length > 0 && unfulfilled === 0) {
      await supabase.from("grow_orders").update({ status: "allocated" }).eq("id", orderId);
    }
    return { fulfilled, unfulfilled, packToOrderSuggestions };
  }, []);
}

/** Allocate a pre-packaged sublot (just-created via PackagingModal) to a specific order item. */
export function useAllocatePackedSublot() {
  return useCallback(async (orderItemId: string, sublotBatchId: string, quantity: number) => {
    const { data: batch } = await supabase.from("grow_batches")
      .select("current_quantity, current_weight_grams").eq("id", sublotBatchId).maybeSingle();
    if (!batch) throw new Error("Sublot not found");
    const take = Math.min(quantity, Number((batch as any).current_quantity ?? 0));
    if (take <= 0) throw new Error("Sublot has no quantity");
    await supabase.from("grow_order_allocations").insert({
      order_item_id: orderItemId, batch_id: sublotBatchId, quantity: take,
    });
    const newQty = Number((batch as any).current_quantity) - take;
    await supabase.from("grow_batches").update({
      current_quantity: newQty, current_weight_grams: newQty,
    }).eq("id", sublotBatchId);
  }, []);
}

export function useDeallocateOrder() {
  return useCallback(async (orderId: string) => {
    const { data: items } = await supabase.from("grow_order_items").select("id").eq("order_id", orderId);
    const itemIds = ((items ?? []) as any[]).map((i) => i.id);
    if (itemIds.length === 0) return;
    const { data: allocs } = await supabase.from("grow_order_allocations").select("*").in("order_item_id", itemIds);
    // Return quantities to batches
    for (const a of (allocs ?? []) as any[]) {
      const { data: batch } = await supabase.from("grow_batches")
        .select("current_quantity").eq("id", a.batch_id).maybeSingle();
      if (batch) {
        const newQty = Number(batch.current_quantity ?? 0) + Number(a.quantity ?? 0);
        await supabase.from("grow_batches").update({
          current_quantity: newQty,
          current_weight_grams: newQty,
        }).eq("id", a.batch_id);
      }
    }
    await supabase.from("grow_order_allocations").delete().in("order_item_id", itemIds);
    await supabase.from("grow_orders").update({ status: "submitted" }).eq("id", orderId);
  }, []);
}

export function useSubmitOrder() {
  return useCallback(async (orderId: string) => {
    const { error } = await supabase.from("grow_orders").update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }).eq("id", orderId);
    if (error) throw error;
  }, []);
}

export function useReleaseOrder() {
  return useCallback(async (orderId: string) => {
    const { error } = await supabase.from("grow_orders").update({
      status: "released",
      released_at: new Date().toISOString(),
    }).eq("id", orderId);
    if (error) throw error;
  }, []);
}

export function useCompleteOrder() {
  return useCallback(async (orderId: string) => {
    const { error } = await supabase.from("grow_orders").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", orderId);
    if (error) throw error;
  }, []);
}

export function useOrderStats(orders: Order[]) {
  return useMemo(() => {
    const byStatus: Record<string, number> = {};
    orders.forEach((o) => { const s = o.status ?? "draft"; byStatus[s] = (byStatus[s] ?? 0) + 1; });
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
    return {
      total: orders.length,
      draft: byStatus.draft ?? 0,
      submitted: byStatus.submitted ?? 0,
      allocated: byStatus.allocated ?? 0,
      packaged: byStatus.packaged ?? 0,
      manifested: byStatus.manifested ?? 0,
      released: byStatus.released ?? 0,
      completed: byStatus.completed ?? 0,
      cancelled: byStatus.cancelled ?? 0,
      totalRevenue,
    };
  }, [orders]);
}

