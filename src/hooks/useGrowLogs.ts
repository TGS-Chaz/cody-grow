import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface GrowLog {
  id: string;
  org_id: string;
  title: string | null;
  content: string;
  log_type: string | null;
  recorded_at: string | null;
  recorded_by: string | null;
  area_id: string | null;
  grow_cycle_id: string | null;
  plant_id: string | null;
  batch_id: string | null;
  harvest_id: string | null;
  photo_urls: string[] | null;
  measurements: any;
  tags: string[] | null;
  created_at: string | null;
  area?: { id: string; name: string } | null;
  cycle?: { id: string; name: string } | null;
  author?: { id: string; full_name: string | null; email: string | null } | null;
}

export interface GrowLogFilters {
  area_id?: string;
  cycle_id?: string;
  plant_id?: string;
  log_type?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function useGrowLogs(filters: GrowLogFilters = {}, limit: number = 100) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<GrowLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const sig = [filters.area_id, filters.cycle_id, filters.plant_id, filters.log_type, filters.dateFrom, filters.dateTo, filters.page ?? "", filters.pageSize ?? "", limit].join(":");

  useEffect(() => {
    if (!user || !orgId) { setData([]); setTotalCount(0); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const paginated = filters.page != null && filters.pageSize != null;
      let q = paginated
        ? supabase.from("grow_logs").select("*", { count: "exact" }).eq("org_id", orgId)
        : supabase.from("grow_logs").select("*").eq("org_id", orgId);
      if (filters.area_id) q = q.eq("area_id", filters.area_id);
      if (filters.cycle_id) q = q.eq("grow_cycle_id", filters.cycle_id);
      if (filters.plant_id) q = q.eq("plant_id", filters.plant_id);
      if (filters.log_type) q = q.eq("log_type", filters.log_type);
      q = q.order("recorded_at", { ascending: false, nullsFirst: false });
      if (paginated) {
        const from = (filters.page! - 1) * filters.pageSize!;
        q = q.range(from, from + filters.pageSize! - 1);
      } else {
        q = q.limit(limit);
      }
      const { data: rows, count } = await q;
      if (paginated) setTotalCount(count ?? 0);
      const areaIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.area_id).filter(Boolean)));
      const cycleIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.grow_cycle_id).filter(Boolean)));
      const userIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.recorded_by).filter(Boolean)));
      const [aRes, cRes, uRes] = await Promise.all([
        areaIds.length > 0 ? supabase.from("grow_areas").select("id, name").in("id", areaIds) : Promise.resolve({ data: [] }),
        cycleIds.length > 0 ? supabase.from("grow_cycles").select("id, name").in("id", cycleIds) : Promise.resolve({ data: [] }),
        userIds.length > 0 ? supabase.from("organization_members").select("id, full_name, email").in("id", userIds) : Promise.resolve({ data: [] }),
      ]);
      const aById = new Map<string, any>((aRes.data ?? []).map((a: any) => [a.id, a]));
      const cById = new Map<string, any>((cRes.data ?? []).map((c: any) => [c.id, c]));
      const uById = new Map<string, any>((uRes.data ?? []).map((u: any) => [u.id, u]));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({
        ...r,
        area: r.area_id ? aById.get(r.area_id) ?? null : null,
        cycle: r.grow_cycle_id ? cById.get(r.grow_cycle_id) ?? null : null,
        author: r.recorded_by ? uById.get(r.recorded_by) ?? null : null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, tick, sig]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh, totalCount };
}

export function useCreateGrowLog() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: {
    title?: string | null;
    content: string;
    log_type?: string;
    area_id?: string | null;
    grow_cycle_id?: string | null;
    plant_id?: string | null;
    batch_id?: string | null;
    harvest_id?: string | null;
    photo_urls?: string[];
    measurements?: any;
    tags?: string[];
  }) => {
    if (!orgId) throw new Error("No active org");
    const { data, error } = await supabase.from("grow_logs").insert({
      org_id: orgId,
      content: input.content,
      title: input.title ?? null,
      log_type: input.log_type ?? "general",
      area_id: input.area_id ?? null,
      grow_cycle_id: input.grow_cycle_id ?? null,
      plant_id: input.plant_id ?? null,
      batch_id: input.batch_id ?? null,
      harvest_id: input.harvest_id ?? null,
      photo_urls: input.photo_urls ?? null,
      measurements: input.measurements ?? null,
      tags: input.tags ?? null,
      recorded_at: new Date().toISOString(),
      recorded_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    return data;
  }, [orgId, user?.id]);
}

export function useGrowLogStats(logs: GrowLog[]) {
  return useMemo(() => {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekAgo = now - 7 * 86400000;
    const today = logs.filter((l) => l.recorded_at && new Date(l.recorded_at).getTime() >= todayStart).length;
    const thisWeek = logs.filter((l) => l.recorded_at && new Date(l.recorded_at).getTime() >= weekAgo).length;
    const byArea: Record<string, number> = {};
    logs.forEach((l) => { if (l.area?.name) byArea[l.area.name] = (byArea[l.area.name] ?? 0) + 1; });
    const mostActiveArea = Object.entries(byArea).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { total: logs.length, today, thisWeek, mostActiveArea };
  }, [logs]);
}
