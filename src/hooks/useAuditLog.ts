import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface AuditLogEntry {
  id: string;
  org_id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  changes_json: any | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
}

export interface AuditLogFilters {
  user_id?: string;
  entity_type?: string;
  entity_id?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function useAuditLog(filters: AuditLogFilters = {}, limit: number = 100) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<AuditLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const sig = [filters.user_id, filters.entity_type, filters.entity_id, filters.action, filters.dateFrom, filters.dateTo, filters.page ?? "", filters.pageSize ?? "", limit].join(":");

  useEffect(() => {
    if (!user || !orgId) { setData([]); setTotalCount(0); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const paginated = filters.page != null && filters.pageSize != null;
      let q = paginated
        ? supabase.from("grow_audit_log").select("*", { count: "exact" }).eq("org_id", orgId)
        : supabase.from("grow_audit_log").select("*").eq("org_id", orgId);
      if (filters.user_id) q = q.eq("user_id", filters.user_id);
      if (filters.entity_type) q = q.eq("entity_type", filters.entity_type);
      if (filters.entity_id) q = q.eq("entity_id", filters.entity_id);
      if (filters.action) q = q.eq("action", filters.action);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("created_at", filters.dateTo);
      q = q.order("created_at", { ascending: false });
      if (paginated) {
        const from = (filters.page! - 1) * filters.pageSize!;
        q = q.range(from, from + filters.pageSize! - 1);
      } else {
        q = q.limit(limit);
      }
      const { data: rows, count } = await q;
      if (cancelled) return;
      setData((rows ?? []) as AuditLogEntry[]);
      if (paginated) setTotalCount(count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, tick, sig]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh, totalCount };
}

export function useAuditLogStats(entries: AuditLogEntry[]) {
  return useMemo(() => {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekAgo = now - 7 * 86400000;
    const today = entries.filter((e) => e.created_at && new Date(e.created_at).getTime() >= todayStart);
    const thisWeek = entries.filter((e) => e.created_at && new Date(e.created_at).getTime() >= weekAgo);
    const activeUsersToday = new Set(today.map((e) => e.user_id).filter(Boolean)).size;
    const entityCounts: Record<string, number> = {};
    entries.forEach((e) => { entityCounts[e.entity_type] = (entityCounts[e.entity_type] ?? 0) + 1; });
    const topEntities = Object.entries(entityCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    return {
      total: entries.length,
      today: today.length,
      thisWeek: thisWeek.length,
      activeUsersToday,
      topEntities,
    };
  }, [entries]);
}

/**
 * Helper to log audit events. Call from hooks that perform compliance-sensitive operations.
 * Non-throwing: failures to write audit log should not block the operation.
 */
export async function logAuditEvent(input: {
  org_id: string;
  user_id?: string | null;
  user_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  entity_name?: string | null;
  changes?: Record<string, { from: any; to: any }> | any;
}) {
  try {
    await supabase.from("grow_audit_log").insert({
      org_id: input.org_id,
      user_id: input.user_id ?? null,
      user_email: input.user_email ?? null,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      entity_name: input.entity_name ?? null,
      changes_json: input.changes ?? null,
    });
  } catch (err) {
    console.warn("[audit] write failed", err);
  }
}

export function useLogAuditEvent() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: Parameters<typeof logAuditEvent>[0] extends infer T
    ? Omit<Extract<T, { org_id: string }>, "org_id" | "user_id" | "user_email"> & { user_id?: string | null; user_email?: string | null }
    : never,
  ) => {
    if (!orgId) return;
    await logAuditEvent({
      org_id: orgId,
      user_id: input.user_id ?? user?.id ?? null,
      user_email: input.user_email ?? user?.email ?? null,
      ...input,
    });
  }, [orgId, user?.id, user?.email]);
}
