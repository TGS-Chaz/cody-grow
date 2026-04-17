import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface DashboardStats {
  activePlants: number;
  inFlower: number;
  upcomingHarvests: number;
  availableWeightGrams: number;
  openOrders: number;
  ccrsPendingCategories: number;
}

export function useDashboardStats() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<DashboardStats>({
    activePlants: 0, inFlower: 0, upcomingHarvests: 0,
    availableWeightGrams: 0, openOrders: 0, ccrsPendingCategories: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !orgId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();
      const [plantsRes, flowerRes, harvestsRes, batchesRes, ordersRes] = await Promise.all([
        supabase.from("grow_plants").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("phase", "in", "(destroyed,harvested)"),
        supabase.from("grow_plants").select("*", { count: "exact", head: true }).eq("org_id", orgId).in("phase", ["flowering", "ready_for_harvest"]),
        supabase.from("grow_cycles").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("phase", "flowering").lte("expected_harvest_date", sevenDaysFromNow),
        supabase.from("grow_batches").select("current_weight_grams").eq("org_id", orgId).eq("is_available", true).gt("current_quantity", 0),
        supabase.from("grow_orders").select("*", { count: "exact", head: true }).eq("org_id", orgId).not("status", "in", "(completed,cancelled)"),
      ]);
      const weight = ((batchesRes.data ?? []) as any[]).reduce((s, b) => s + Number(b.current_weight_grams ?? 0), 0);
      const { data: submissions } = await supabase.from("grow_ccrs_submission_files").select("file_category, uploaded_at").eq("org_id", orgId);
      const latestByCategory = new Map<string, string>();
      (submissions ?? []).forEach((s: any) => {
        const existing = latestByCategory.get(s.file_category);
        if (!existing || (s.uploaded_at && s.uploaded_at > existing)) latestByCategory.set(s.file_category, s.uploaded_at);
      });
      let ccrsPending = 0;
      const categories = ["strain", "area", "product", "inventory", "plant", "sale", "harvest"];
      for (const cat of categories) {
        const since = latestByCategory.get(cat) ?? "1970-01-01";
        const table = cat === "strain" ? "grow_strains" : cat === "area" ? "grow_areas" : cat === "product" ? "grow_products" : cat === "inventory" ? "grow_batches" : cat === "plant" ? "grow_plants" : cat === "sale" ? "grow_orders" : "grow_harvests";
        const { count } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("org_id", orgId).gt("updated_at", since);
        if ((count ?? 0) > 0) ccrsPending++;
      }
      if (cancelled) return;
      setData({
        activePlants: plantsRes.count ?? 0,
        inFlower: flowerRes.count ?? 0,
        upcomingHarvests: harvestsRes.count ?? 0,
        availableWeightGrams: weight,
        openOrders: ordersRes.count ?? 0,
        ccrsPendingCategories: ccrsPending,
      });
      setLoading(false);
      void sevenDaysAgo;
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId]);

  return { data, loading };
}

export function useUpcomingHarvests(days: number = 7) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const cutoff = new Date(Date.now() + days * 86400000).toISOString();
      const { data: rows } = await supabase.from("grow_cycles")
        .select("*").eq("org_id", orgId).in("phase", ["flowering", "ready_for_harvest"])
        .lte("expected_harvest_date", cutoff).order("expected_harvest_date", { ascending: true }).limit(10);
      const strainIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.strain_id).filter(Boolean)));
      const areaIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.area_id).filter(Boolean)));
      const [sRes, aRes] = await Promise.all([
        strainIds.length > 0 ? supabase.from("grow_strains").select("id, name, type").in("id", strainIds) : Promise.resolve({ data: [] }),
        areaIds.length > 0 ? supabase.from("grow_areas").select("id, name").in("id", areaIds) : Promise.resolve({ data: [] }),
      ]);
      const sById = new Map<string, any>((sRes.data ?? []).map((s: any) => [s.id, s]));
      const aById = new Map<string, any>((aRes.data ?? []).map((a: any) => [a.id, a]));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({
        ...r,
        strain: r.strain_id ? sById.get(r.strain_id) ?? null : null,
        area: r.area_id ? aById.get(r.area_id) ?? null : null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, days]);

  return { data, loading };
}

export function useTodaysTasks() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const { data: rows } = await supabase.from("grow_tasks")
        .select("*").eq("org_id", orgId)
        .or(`assigned_to_user_id.eq.${user.id}`)
        .not("status", "in", "(completed,cancelled)")
        .lte("scheduled_end", endOfToday.toISOString())
        .order("scheduled_start", { ascending: true, nullsFirst: false }).limit(10);
      if (cancelled) return;
      setData((rows ?? []) as any[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = () => setTick((t) => t + 1);
  return { data, loading, refresh };
}

export function useRecentActivity(limit: number = 10) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Prefer the pre-joined materialized view (enriched with user name + avatar,
      // already filtered to the last 30 days and capped at 1000 rows). Falls back
      // to the raw audit log if the view doesn't exist yet (older environments).
      const matview = await supabase.from("grow_recent_activity" as any)
        .select("*").eq("org_id", orgId)
        .order("created_at", { ascending: false }).limit(limit);
      if (cancelled) return;
      if (matview.error) {
        const { data: rows } = await supabase.from("grow_audit_log").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(limit);
        if (cancelled) return;
        setData((rows ?? []) as any[]);
      } else {
        setData((matview.data ?? []) as any[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, limit]);

  return { data, loading };
}

export function useEnvironmentalAlerts(limit: number = 5) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_environmental_alerts")
        .select("*").eq("org_id", orgId).is("resolved_at", null)
        .order("created_at", { ascending: false }).limit(limit);
      const areaIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.area_id).filter(Boolean)));
      const { data: areas } = areaIds.length > 0
        ? await supabase.from("grow_areas").select("id, name").in("id", areaIds)
        : { data: [] };
      const aById = new Map<string, any>((areas ?? []).map((a: any) => [a.id, a]));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({ ...r, area: r.area_id ? aById.get(r.area_id) ?? null : null })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, limit]);

  return useMemo(() => ({ data, loading }), [data, loading]);
}
