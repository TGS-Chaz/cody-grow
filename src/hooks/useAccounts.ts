import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface Account {
  id: string;
  org_id: string;
  company_name: string;
  dba: string | null;
  license_number: string | null;
  license_type: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  workflow_status_id: string | null;
  route_id: string | null;
  assigned_rep_id: string | null;
  account_group_id: string | null;
  payment_terms: string | null;
  label_barcode_preference: string | null;
  is_active: boolean | null;
  is_non_cannabis: boolean | null;
  notes: string | null;
  tags: string[] | null;
  crm_company_id: string | null;
  crm_contact_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Joined */
  status?: { id: string; name: string; color: string | null } | null;
  route?: { id: string; name: string; color: string | null } | null;
  group?: { id: string; name: string } | null;
  rep?: { id: string; full_name: string | null; email: string | null } | null;
  last_order_at?: string | null;
  ytd_revenue?: number;
}

export interface AccountNote {
  id: string;
  org_id: string;
  account_id: string;
  content: string;
  attribute_ids: string[] | null;
  is_pinned: boolean | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** joined */
  author?: { id: string; full_name: string | null; email: string | null } | null;
}

export interface AccountFilters {
  status_id?: string;
  route_id?: string;
  rep_id?: string;
  group_id?: string;
  is_active?: boolean;
  license_type?: string;
}

export function useAccounts(filters: AccountFilters = {}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const sig = [filters.status_id, filters.route_id, filters.rep_id, filters.group_id, filters.is_active, filters.license_type].join(":");

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("grow_accounts").select("*").eq("org_id", orgId);
      if (filters.status_id) q = q.eq("workflow_status_id", filters.status_id);
      if (filters.route_id) q = q.eq("route_id", filters.route_id);
      if (filters.rep_id) q = q.eq("assigned_rep_id", filters.rep_id);
      if (filters.group_id) q = q.eq("account_group_id", filters.group_id);
      if (filters.is_active != null) q = q.eq("is_active", filters.is_active);
      if (filters.license_type) q = q.eq("license_type", filters.license_type);
      const { data: rows } = await q.order("company_name");
      const accountIds = (rows ?? []).map((r: any) => r.id);
      const statusIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.workflow_status_id).filter(Boolean)));
      const routeIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.route_id).filter(Boolean)));
      const groupIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.account_group_id).filter(Boolean)));
      const repIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.assigned_rep_id).filter(Boolean)));
      const [statusRes, routeRes, groupRes, repRes, ordersRes] = await Promise.all([
        statusIds.length > 0 ? supabase.from("grow_account_statuses").select("id, name, color").in("id", statusIds) : Promise.resolve({ data: [] }),
        routeIds.length > 0 ? supabase.from("grow_routes").select("id, name, color").in("id", routeIds) : Promise.resolve({ data: [] }),
        groupIds.length > 0 ? supabase.from("grow_account_groups").select("id, name").in("id", groupIds) : Promise.resolve({ data: [] }),
        repIds.length > 0 ? supabase.from("organization_members").select("id, full_name, email").in("id", repIds) : Promise.resolve({ data: [] }),
        accountIds.length > 0 ? supabase.from("grow_orders").select("id, account_id, total, created_at").in("account_id", accountIds) : Promise.resolve({ data: [] }),
      ]);
      const statusById = new Map<string, any>((statusRes.data ?? []).map((s: any) => [s.id, s]));
      const routeById = new Map<string, any>((routeRes.data ?? []).map((r: any) => [r.id, r]));
      const groupById = new Map<string, any>((groupRes.data ?? []).map((g: any) => [g.id, g]));
      const repById = new Map<string, any>((repRes.data ?? []).map((r: any) => [r.id, r]));
      const lastByAccount = new Map<string, string>();
      const ytdByAccount = new Map<string, number>();
      const ytdStart = new Date(new Date().getFullYear(), 0, 1).getTime();
      ((ordersRes.data ?? []) as any[]).forEach((o) => {
        const prev = lastByAccount.get(o.account_id);
        if (!prev || new Date(o.created_at).getTime() > new Date(prev).getTime()) lastByAccount.set(o.account_id, o.created_at);
        if (o.created_at && new Date(o.created_at).getTime() >= ytdStart) {
          ytdByAccount.set(o.account_id, (ytdByAccount.get(o.account_id) ?? 0) + Number(o.total ?? 0));
        }
      });
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({
        ...r,
        status: r.workflow_status_id ? statusById.get(r.workflow_status_id) ?? null : null,
        route: r.route_id ? routeById.get(r.route_id) ?? null : null,
        group: r.account_group_id ? groupById.get(r.account_group_id) ?? null : null,
        rep: r.assigned_rep_id ? repById.get(r.assigned_rep_id) ?? null : null,
        last_order_at: lastByAccount.get(r.id) ?? null,
        ytd_revenue: ytdByAccount.get(r.id) ?? 0,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, tick, sig]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useAccount(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row } = await supabase.from("grow_accounts").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (cancelled) return;
      if (!row) { setData(null); setLoading(false); return; }
      const [statusRes, routeRes, groupRes, repRes, ordersRes] = await Promise.all([
        row.workflow_status_id ? supabase.from("grow_account_statuses").select("id, name, color").eq("id", row.workflow_status_id).maybeSingle() : Promise.resolve({ data: null }),
        row.route_id ? supabase.from("grow_routes").select("id, name, color").eq("id", row.route_id).maybeSingle() : Promise.resolve({ data: null }),
        row.account_group_id ? supabase.from("grow_account_groups").select("id, name").eq("id", row.account_group_id).maybeSingle() : Promise.resolve({ data: null }),
        row.assigned_rep_id ? supabase.from("organization_members").select("id, full_name, email").eq("id", row.assigned_rep_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("grow_orders").select("total, created_at").eq("account_id", id),
      ]);
      if (cancelled) return;
      const ytdStart = new Date(new Date().getFullYear(), 0, 1).getTime();
      const ytd = ((ordersRes.data ?? []) as any[]).filter((o) => o.created_at && new Date(o.created_at).getTime() >= ytdStart).reduce((sum, o) => sum + Number(o.total ?? 0), 0);
      const last = ((ordersRes.data ?? []) as any[]).reduce((latest: string | null, o) => !latest || new Date(o.created_at).getTime() > new Date(latest).getTime() ? o.created_at : latest, null);
      setData({
        ...(row as any),
        status: (statusRes as any).data ?? null,
        route: (routeRes as any).data ?? null,
        group: (groupRes as any).data ?? null,
        rep: (repRes as any).data ?? null,
        last_order_at: last,
        ytd_revenue: ytd,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export interface AccountInput {
  company_name: string;
  license_number?: string | null;
  license_type?: string | null;
  dba?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  workflow_status_id?: string | null;
  route_id?: string | null;
  assigned_rep_id?: string | null;
  account_group_id?: string | null;
  payment_terms?: string | null;
  label_barcode_preference?: string | null;
  is_non_cannabis?: boolean;
  is_active?: boolean;
}

export function useCreateAccount() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: AccountInput): Promise<Account> => {
    if (!orgId) throw new Error("No active org");
    const { data, error } = await supabase.from("grow_accounts").insert({
      org_id: orgId,
      ...input,
      is_active: input.is_active ?? true,
      created_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    return data as unknown as Account;
  }, [orgId, user?.id]);
}

export function useUpdateAccount() {
  return useCallback(async (id: string, patch: Partial<AccountInput>) => {
    const { error } = await supabase.from("grow_accounts").update(patch as any).eq("id", id);
    if (error) throw error;
  }, []);
}

export function useArchiveAccount() {
  return useCallback(async (id: string) => {
    const { error } = await supabase.from("grow_accounts").update({ is_active: false }).eq("id", id);
    if (error) throw error;
  }, []);
}

export function useAccountStats(accounts: Account[]) {
  return useMemo(() => {
    const now = Date.now();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const sixtyDaysAgo = now - 60 * 86400000;
    const withOrdersThisMonth = accounts.filter((a) => a.last_order_at && new Date(a.last_order_at).getTime() >= monthStart).length;
    const needsAttention = accounts.filter((a) => a.is_active && (!a.last_order_at || new Date(a.last_order_at).getTime() < sixtyDaysAgo)).length;
    const totalYtd = accounts.reduce((sum, a) => sum + Number(a.ytd_revenue ?? 0), 0);
    return {
      total: accounts.length,
      active: accounts.filter((a) => a.is_active).length,
      withOrdersThisMonth,
      totalYtdRevenue: totalYtd,
      needsAttention,
    };
  }, [accounts]);
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export function useAccountNotes(accountId: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<AccountNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !accountId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase
        .from("grow_account_notes").select("*").eq("account_id", accountId).eq("org_id", orgId)
        .order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
      const authorIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.created_by).filter(Boolean)));
      const { data: authors } = authorIds.length > 0
        ? await supabase.from("organization_members").select("id, full_name, email").in("id", authorIds)
        : { data: [] };
      const authorById = new Map<string, any>((authors ?? []).map((a: any) => [a.id, a]));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({ ...r, author: r.created_by ? authorById.get(r.created_by) ?? null : null })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, accountId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useCreateNote() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (accountId: string, input: { content: string; attribute_ids?: string[]; is_pinned?: boolean }) => {
    if (!orgId) throw new Error("No active org");
    const { data, error } = await supabase.from("grow_account_notes").insert({
      org_id: orgId,
      account_id: accountId,
      content: input.content,
      attribute_ids: input.attribute_ids ?? null,
      is_pinned: input.is_pinned ?? false,
      created_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    return data as unknown as AccountNote;
  }, [orgId, user?.id]);
}

export function usePinNote() {
  return useCallback(async (id: string, pinned: boolean) => {
    const { error } = await supabase.from("grow_account_notes").update({ is_pinned: pinned }).eq("id", id);
    if (error) throw error;
  }, []);
}

export function useDeleteNote() {
  return useCallback(async (id: string) => {
    const { error } = await supabase.from("grow_account_notes").delete().eq("id", id);
    if (error) throw error;
  }, []);
}

export function useAccountOrders(accountId: string | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!accountId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_orders").select("*").eq("account_id", accountId).order("created_at", { ascending: false });
      const orderIds = ((rows ?? []) as any[]).map((r) => r.id);
      const { data: items } = orderIds.length > 0
        ? await supabase.from("grow_order_items").select("order_id").in("order_id", orderIds)
        : { data: [] };
      const countByOrder = new Map<string, number>();
      (items ?? []).forEach((i: any) => countByOrder.set(i.order_id, (countByOrder.get(i.order_id) ?? 0) + 1));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({ ...r, item_count: countByOrder.get(r.id) ?? 0 })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [accountId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useAccountPriceLists(accountId: string | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!accountId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_account_price_lists").select("*").eq("account_id", accountId);
      const ids = ((rows ?? []) as any[]).map((r) => r.price_list_id);
      const { data: lists } = ids.length > 0
        ? await supabase.from("grow_price_lists").select("id, name, description, is_default").in("id", ids)
        : { data: [] };
      const listById = new Map<string, any>((lists ?? []).map((l: any) => [l.id, l]));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({ ...r, price_list: listById.get(r.price_list_id) ?? null })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [accountId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useAccountDrivers(accountId: string | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_drivers").select("*").eq("client_account_id", accountId);
      if (cancelled) return;
      setData((rows ?? []) as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [accountId]);

  return { data, loading };
}

export function useAccountVehicles(accountId: string | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_vehicles").select("*").eq("client_account_id", accountId);
      if (cancelled) return;
      setData((rows ?? []) as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [accountId]);

  return { data, loading };
}
