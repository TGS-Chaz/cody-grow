import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface Recall {
  id: string;
  org_id: string;
  recall_number: string;
  recall_type: string | null;
  severity: string | null;
  status: string | null;
  reason: string;
  detailed_description: string | null;
  affected_batch_ids: string[] | null;
  affected_product_ids: string[] | null;
  affected_strain_ids: string[] | null;
  wslcb_notified: boolean | null;
  wslcb_notified_at: string | null;
  public_notice_issued: boolean | null;
  public_notice_url: string | null;
  initiated_by: string | null;
  resolved_at: string | null;
  created_at: string | null;
  /** Derived */
  affected_account_count?: number;
  notification_count?: number;
}

export interface RecallFilters {
  status?: string;
  severity?: string;
  recall_type?: string;
}

export function useRecalls(filters: RecallFilters = {}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Recall[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const sig = [filters.status, filters.severity, filters.recall_type].join(":");

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("grow_recalls").select("*").eq("org_id", orgId);
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.severity) q = q.eq("severity", filters.severity);
      if (filters.recall_type) q = q.eq("recall_type", filters.recall_type);
      const { data: rows } = await q.order("created_at", { ascending: false });
      const ids = ((rows ?? []) as any[]).map((r) => r.id);
      const { data: notifications } = ids.length > 0
        ? await supabase.from("grow_recall_notifications").select("recall_id, account_id").in("recall_id", ids)
        : { data: [] };
      const accountsByRecall = new Map<string, Set<string>>();
      const countByRecall = new Map<string, number>();
      (notifications ?? []).forEach((n: any) => {
        countByRecall.set(n.recall_id, (countByRecall.get(n.recall_id) ?? 0) + 1);
        if (n.account_id) {
          const set = accountsByRecall.get(n.recall_id) ?? new Set();
          set.add(n.account_id);
          accountsByRecall.set(n.recall_id, set);
        }
      });
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({
        ...r,
        affected_account_count: accountsByRecall.get(r.id)?.size ?? 0,
        notification_count: countByRecall.get(r.id) ?? 0,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, tick, sig]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useRecall(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Recall | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row } = await supabase.from("grow_recalls").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (cancelled) return;
      setData(row as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export interface CreateRecallInput {
  recall_number?: string;
  recall_type: "voluntary" | "mandatory" | "precautionary";
  severity: "class_i" | "class_ii" | "class_iii";
  reason: string;
  detailed_description?: string | null;
  affected_batch_ids: string[];
  affected_product_ids?: string[];
  affected_strain_ids?: string[];
  wslcb_notified?: boolean;
  public_notice_issued?: boolean;
}

export function useCreateRecall() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: CreateRecallInput) => {
    if (!orgId) throw new Error("No active org");
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const number = input.recall_number ?? `RCL-${date}-${now.getTime().toString().slice(-4)}`;
    const { data, error } = await supabase.from("grow_recalls").insert({
      org_id: orgId,
      recall_number: number,
      recall_type: input.recall_type,
      severity: input.severity,
      status: "open",
      reason: input.reason,
      detailed_description: input.detailed_description ?? null,
      affected_batch_ids: input.affected_batch_ids,
      affected_product_ids: input.affected_product_ids ?? null,
      affected_strain_ids: input.affected_strain_ids ?? null,
      wslcb_notified: input.wslcb_notified ?? false,
      wslcb_notified_at: input.wslcb_notified ? new Date().toISOString() : null,
      public_notice_issued: input.public_notice_issued ?? false,
      initiated_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    return data;
  }, [orgId, user?.id]);
}

export function useUpdateRecall() {
  return useCallback(async (id: string, patch: Partial<Recall>) => {
    const { error } = await supabase.from("grow_recalls").update(patch as any).eq("id", id);
    if (error) throw error;
  }, []);
}

export function useResolveRecall() {
  return useCallback(async (id: string) => {
    const { error } = await supabase.from("grow_recalls").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  }, []);
}

export interface AffectedDownstream {
  batch_id: string;
  batch_barcode: string;
  account_id: string;
  account_name: string;
  account_license: string | null;
  account_email: string | null;
  account_phone: string | null;
  order_id: string;
  order_number: string;
  quantity: number;
  order_date: string | null;
  manifest_id: string | null;
  manifest_external_id: string | null;
  notified: boolean;
  acknowledged: boolean;
}

/**
 * Full downstream trace from affected batches → allocations → orders → accounts.
 * This is the core feature we show to WSLCB during audits.
 */
export function useAffectedOrders(recallId: string | undefined) {
  const [data, setData] = useState<AffectedDownstream[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!recallId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: recall } = await supabase.from("grow_recalls").select("affected_batch_ids").eq("id", recallId).maybeSingle();
      const batchIds = ((recall as any)?.affected_batch_ids ?? []) as string[];
      if (batchIds.length === 0) { if (!cancelled) { setData([]); setLoading(false); } return; }

      // Get all allocations for affected batches
      const { data: allocs } = await supabase.from("grow_order_allocations").select("*").in("batch_id", batchIds);
      const itemIds = Array.from(new Set(((allocs ?? []) as any[]).map((a) => a.order_item_id)));
      const [itemsRes, batchesRes] = await Promise.all([
        itemIds.length > 0 ? supabase.from("grow_order_items").select("*").in("id", itemIds) : Promise.resolve({ data: [] }),
        supabase.from("grow_batches").select("id, barcode").in("id", batchIds),
      ]);
      const orderIds = Array.from(new Set(((itemsRes.data ?? []) as any[]).map((i) => i.order_id)));
      const { data: orders } = orderIds.length > 0
        ? await supabase.from("grow_orders").select("*").in("id", orderIds)
        : { data: [] };
      const accountIds = Array.from(new Set(((orders ?? []) as any[]).map((o) => o.account_id).filter(Boolean)));
      const { data: accounts } = accountIds.length > 0
        ? await supabase.from("grow_accounts").select("id, company_name, license_number, primary_contact_email, primary_contact_phone").in("id", accountIds)
        : { data: [] };
      const { data: manifests } = orderIds.length > 0
        ? await supabase.from("grow_manifests").select("id, order_id, external_id").in("order_id", orderIds)
        : { data: [] };
      const { data: notifications } = await supabase.from("grow_recall_notifications").select("*").eq("recall_id", recallId);

      const batchById = new Map<string, any>(((batchesRes as any).data ?? []).map((b: any) => [b.id, b]));
      const itemById = new Map<string, any>(((itemsRes.data ?? []) as any[]).map((i) => [i.id, i]));
      const orderById = new Map<string, any>(((orders ?? []) as any[]).map((o) => [o.id, o]));
      const accountById = new Map<string, any>(((accounts ?? []) as any[]).map((a) => [a.id, a]));
      const manifestByOrder = new Map<string, any>(((manifests ?? []) as any[]).map((m) => [m.order_id, m]));
      const notificationByKey = new Map<string, any>();
      ((notifications ?? []) as any[]).forEach((n) => {
        notificationByKey.set(`${n.account_id}:${n.order_id}:${n.batch_id}`, n);
      });

      const rows: AffectedDownstream[] = ((allocs ?? []) as any[]).map((a) => {
        const item = itemById.get(a.order_item_id);
        const order = item ? orderById.get(item.order_id) : null;
        const account = order ? accountById.get(order.account_id) : null;
        const manifest = order ? manifestByOrder.get(order.id) : null;
        const key = `${account?.id}:${order?.id}:${a.batch_id}`;
        const notification = notificationByKey.get(key);
        return {
          batch_id: a.batch_id,
          batch_barcode: batchById.get(a.batch_id)?.barcode ?? a.batch_id,
          account_id: account?.id ?? "",
          account_name: account?.company_name ?? "—",
          account_license: account?.license_number ?? null,
          account_email: account?.primary_contact_email ?? null,
          account_phone: account?.primary_contact_phone ?? null,
          order_id: order?.id ?? "",
          order_number: order?.order_number ?? "—",
          quantity: Number(a.quantity ?? 0),
          order_date: order?.created_at ?? null,
          manifest_id: manifest?.id ?? null,
          manifest_external_id: manifest?.external_id ?? null,
          notified: !!notification?.notified_at,
          acknowledged: !!notification?.acknowledged_at,
        };
      });
      if (cancelled) return;
      setData(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [recallId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useRecallNotifications(recallId: string | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!recallId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_recall_notifications").select("*").eq("recall_id", recallId).order("notified_at", { ascending: false });
      const accountIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.account_id).filter(Boolean)));
      const batchIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.batch_id).filter(Boolean)));
      const orderIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.order_id).filter(Boolean)));
      const [aRes, bRes, oRes] = await Promise.all([
        accountIds.length > 0 ? supabase.from("grow_accounts").select("id, company_name").in("id", accountIds) : Promise.resolve({ data: [] }),
        batchIds.length > 0 ? supabase.from("grow_batches").select("id, barcode").in("id", batchIds) : Promise.resolve({ data: [] }),
        orderIds.length > 0 ? supabase.from("grow_orders").select("id, order_number").in("id", orderIds) : Promise.resolve({ data: [] }),
      ]);
      const aById = new Map<string, any>((aRes.data ?? []).map((a: any) => [a.id, a]));
      const bById = new Map<string, any>((bRes.data ?? []).map((b: any) => [b.id, b]));
      const oById = new Map<string, any>((oRes.data ?? []).map((o: any) => [o.id, o]));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({
        ...r,
        account: r.account_id ? aById.get(r.account_id) ?? null : null,
        batch: r.batch_id ? bById.get(r.batch_id) ?? null : null,
        order: r.order_id ? oById.get(r.order_id) ?? null : null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [recallId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useSendRecallNotifications() {
  return useCallback(async (recallId: string, affected: AffectedDownstream[], method: "email" | "phone" | "in_person" | "mail" = "email") => {
    const existing = await supabase.from("grow_recall_notifications").select("account_id, order_id, batch_id").eq("recall_id", recallId);
    const existingKeys = new Set(((existing.data ?? []) as any[]).map((n) => `${n.account_id}:${n.order_id}:${n.batch_id}`));
    const toInsert = affected
      .filter((a) => a.account_id && !existingKeys.has(`${a.account_id}:${a.order_id}:${a.batch_id}`))
      .map((a) => ({
        recall_id: recallId,
        account_id: a.account_id,
        order_id: a.order_id,
        batch_id: a.batch_id,
        notification_method: method,
        notified_at: new Date().toISOString(),
      }));
    if (toInsert.length === 0) return 0;
    const { error } = await supabase.from("grow_recall_notifications").insert(toInsert);
    if (error) throw error;
    return toInsert.length;
  }, []);
}

export function useAcknowledgeNotification() {
  return useCallback(async (id: string) => {
    const { error } = await supabase.from("grow_recall_notifications").update({ acknowledged_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  }, []);
}

export function useRecallStats(recalls: Recall[]) {
  return useMemo(() => ({
    total: recalls.length,
    open: recalls.filter((r) => r.status === "open").length,
    in_progress: recalls.filter((r) => r.status === "in_progress").length,
    resolved: recalls.filter((r) => r.status === "resolved").length,
    class_i: recalls.filter((r) => r.severity === "class_i").length,
  }), [recalls]);
}
