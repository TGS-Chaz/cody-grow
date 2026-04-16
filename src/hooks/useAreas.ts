import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { generateExternalId } from "@/lib/ccrs-id";
import type { AreaCanopyType, AreaLightType, AreaType } from "@/lib/schema-enums";

const SENSOR_FRESH_MS = 15 * 60 * 1000;

export interface Area {
  id: string;
  org_id: string;
  external_id: string;
  name: string;
  type: AreaType | null;
  canopy_type: AreaCanopyType | null;
  is_quarantine: boolean;
  is_licensed_canopy: boolean;
  canopy_sqft: number | null;
  length_ft: number | null;
  width_ft: number | null;
  height_ft: number | null;
  max_plant_capacity: number | null;
  light_wattage: number | null;
  light_type: AreaLightType | null;
  target_temp_min_f: number | null;
  target_temp_max_f: number | null;
  target_humidity_min_pct: number | null;
  target_humidity_max_pct: number | null;
  target_vpd_min: number | null;
  target_vpd_max: number | null;
  target_co2_min_ppm: number | null;
  target_co2_max_ppm: number | null;
  facility_id: string | null;
  notes: string | null;
  ccrs_notes: string | null;
  sort_order: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Joined facility name */
  facility?: { id: string; name: string } | null;
  /** Derived counts */
  active_plant_count?: number;
  active_cycle_count?: number;
  sensor_count?: number;
  sensor_online_count?: number;
  /** Latest reading for inline display on the list */
  latest_reading?: LatestReading | null;
}

export interface LatestReading {
  recorded_at: string;
  temperature_f: number | null;
  humidity_pct: number | null;
  vpd: number | null;
  co2_ppm: number | null;
}

export interface AreaInput {
  name: string;
  facility_id: string;
  canopy_type: AreaCanopyType;
  type?: AreaType | null;
  is_quarantine?: boolean;
  is_licensed_canopy?: boolean;
  canopy_sqft?: number | null;
  length_ft?: number | null;
  width_ft?: number | null;
  height_ft?: number | null;
  max_plant_capacity?: number | null;
  light_wattage?: number | null;
  light_type?: AreaLightType | null;
  target_temp_min_f?: number | null;
  target_temp_max_f?: number | null;
  target_humidity_min_pct?: number | null;
  target_humidity_max_pct?: number | null;
  target_vpd_min?: number | null;
  target_vpd_max?: number | null;
  target_co2_min_ppm?: number | null;
  target_co2_max_ppm?: number | null;
  notes?: string | null;
  ccrs_notes?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
}

/** Map a canopy_type to the best-matching grow_areas.type CHECK value. */
function derivedAreaType(ct: AreaCanopyType): AreaType {
  switch (ct) {
    case "drying": return "drying";
    case "storage": return "storage";
    case "processing": return "processing";
    case "quarantine": return "quarantine";
    default: return "grow"; // flower/veg/mother/clone
  }
}

export function useAreas() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [areaRes, facRes, plantRes, cycleRes, deviceRes] = await Promise.all([
        supabase.from("grow_areas").select("*").eq("org_id", orgId).order("sort_order", { ascending: true }).order("name"),
        supabase.from("grow_facilities").select("id, name").eq("org_id", orgId),
        supabase.from("grow_plants").select("area_id, phase").eq("org_id", orgId).not("phase", "in", "(destroyed,harvested)"),
        supabase.from("grow_cycles").select("area_id, phase").eq("org_id", orgId).not("phase", "in", "(completed,cancelled)"),
        supabase.from("grow_hardware_devices").select("assigned_to_area_id, device_type, is_active, last_ping_at").eq("org_id", orgId),
      ]);
      if (cancelled) return;
      if (areaRes.error) { setError(areaRes.error.message); setLoading(false); return; }

      const facById = new Map<string, any>();
      (facRes.data ?? []).forEach((f: any) => facById.set(f.id, f));

      const plantCount = new Map<string, number>();
      (plantRes.data ?? []).forEach((p: any) => {
        if (!p.area_id) return;
        plantCount.set(p.area_id, (plantCount.get(p.area_id) ?? 0) + 1);
      });

      const cycleCount = new Map<string, number>();
      (cycleRes.data ?? []).forEach((c: any) => {
        if (!c.area_id) return;
        cycleCount.set(c.area_id, (cycleCount.get(c.area_id) ?? 0) + 1);
      });

      const sensorTotal = new Map<string, number>();
      const sensorOnline = new Map<string, number>();
      const now = Date.now();
      (deviceRes.data ?? []).forEach((d: any) => {
        if (!d.assigned_to_area_id || d.device_type !== "environmental_sensor") return;
        sensorTotal.set(d.assigned_to_area_id, (sensorTotal.get(d.assigned_to_area_id) ?? 0) + 1);
        if (d.is_active && d.last_ping_at && (now - new Date(d.last_ping_at).getTime()) < SENSOR_FRESH_MS) {
          sensorOnline.set(d.assigned_to_area_id, (sensorOnline.get(d.assigned_to_area_id) ?? 0) + 1);
        }
      });

      // Latest environmental reading per area — one query, map newest by area
      const areaIds = (areaRes.data ?? []).map((a: any) => a.id);
      const latestByArea = new Map<string, LatestReading>();
      if (areaIds.length > 0) {
        const { data: readings } = await supabase
          .from("grow_environmental_readings")
          .select("area_id, temperature_f, humidity_pct, vpd, co2_ppm, recorded_at")
          .in("area_id", areaIds)
          .order("recorded_at", { ascending: false })
          .limit(500); // pull a window, then reduce to one per area client-side
        (readings ?? []).forEach((r: any) => {
          if (!r.area_id || latestByArea.has(r.area_id)) return;
          latestByArea.set(r.area_id, r as LatestReading);
        });
      }

      const merged = (areaRes.data ?? []).map((a: any) => ({
        ...a,
        facility: a.facility_id ? facById.get(a.facility_id) ?? null : null,
        active_plant_count: plantCount.get(a.id) ?? 0,
        active_cycle_count: cycleCount.get(a.id) ?? 0,
        sensor_count: sensorTotal.get(a.id) ?? 0,
        sensor_online_count: sensorOnline.get(a.id) ?? 0,
        latest_reading: latestByArea.get(a.id) ?? null,
      })) as Area[];

      setData(merged);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const createArea = useCallback(async (input: AreaInput) => {
    if (!orgId) throw new Error("No active org");
    const payload = {
      ...input,
      org_id: orgId,
      external_id: generateExternalId(),
      type: input.type ?? derivedAreaType(input.canopy_type),
      is_quarantine: input.canopy_type === "quarantine" ? true : !!input.is_quarantine,
      is_licensed_canopy: !!input.is_licensed_canopy,
      is_active: input.is_active ?? true,
    };
    const { data: row, error: err } = await supabase.from("grow_areas").insert(payload).select("*").single();
    if (err) throw err;
    refresh();
    return row as Area;
  }, [orgId, refresh]);

  const updateArea = useCallback(async (id: string, patch: Partial<AreaInput>) => {
    const next: any = { ...patch };
    if (patch.canopy_type && !patch.type) next.type = derivedAreaType(patch.canopy_type);
    const { data: row, error: err } = await supabase.from("grow_areas").update(next).eq("id", id).select("*").single();
    if (err) throw err;
    refresh();
    return row as Area;
  }, [refresh]);

  const archiveArea = useCallback(async (id: string) => {
    const { error: err } = await supabase.from("grow_areas").update({ is_active: false }).eq("id", id);
    if (err) throw err;
    refresh();
  }, [refresh]);

  /** Assign a set of hardware_devices to this area (replaces any existing
   * assignments). Used by the AreaFormModal sensor multi-select. */
  const assignSensors = useCallback(async (areaId: string, deviceIds: string[]) => {
    if (!orgId) throw new Error("No active org");
    // Clear sensors currently pointing at this area, then assign the new set
    await supabase
      .from("grow_hardware_devices")
      .update({ assigned_to_area_id: null })
      .eq("org_id", orgId)
      .eq("assigned_to_area_id", areaId);
    if (deviceIds.length > 0) {
      await supabase
        .from("grow_hardware_devices")
        .update({ assigned_to_area_id: areaId })
        .eq("org_id", orgId)
        .in("id", deviceIds);
    }
    refresh();
  }, [orgId, refresh]);

  return { data, loading, error, refresh, createArea, updateArea, archiveArea, assignSensors };
}

export function useAreaStats(areas: Area[]) {
  return useMemo(() => {
    const licensedCanopy = areas
      .filter((a) => a.is_licensed_canopy)
      .reduce((sum, a) => sum + (a.canopy_sqft ?? 0), 0);
    return {
      total: areas.length,
      active: areas.filter((a) => a.is_active).length,
      licensedCanopy,
      occupied: areas.filter((a) => (a.active_plant_count ?? 0) > 0).length,
      sensorsOnline: areas.reduce((sum, a) => sum + (a.sensor_online_count ?? 0), 0),
    };
  }, [areas]);
}

export function useArea(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Area | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row, error: err } = await supabase
        .from("grow_areas")
        .select("*")
        .eq("id", id)
        .eq("org_id", orgId)
        .maybeSingle();
      if (cancelled) return;
      if (err) { setError(err.message); setLoading(false); return; }
      if (!row) { setData(null); setLoading(false); return; }

      const [facRes, plantRes, cycleRes, deviceRes, readingRes] = await Promise.all([
        row.facility_id ? supabase.from("grow_facilities").select("id, name").eq("id", row.facility_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("grow_plants").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("area_id", id).not("phase", "in", "(destroyed,harvested)"),
        supabase.from("grow_cycles").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("area_id", id).not("phase", "in", "(completed,cancelled)"),
        supabase.from("grow_hardware_devices").select("id, is_active, last_ping_at, device_type").eq("org_id", orgId).eq("assigned_to_area_id", id),
        supabase.from("grow_environmental_readings").select("*").eq("area_id", id).order("recorded_at", { ascending: false }).limit(1),
      ]);
      if (cancelled) return;

      const now = Date.now();
      const sensors = (deviceRes.data ?? []).filter((d: any) => d.device_type === "environmental_sensor");
      const sensor_online_count = sensors.filter((d: any) =>
        d.is_active && d.last_ping_at && (now - new Date(d.last_ping_at).getTime()) < SENSOR_FRESH_MS,
      ).length;

      setData({
        ...(row as any),
        facility: (facRes as any).data ?? null,
        active_plant_count: plantRes.count ?? 0,
        active_cycle_count: cycleRes.count ?? 0,
        sensor_count: sensors.length,
        sensor_online_count,
        latest_reading: (readingRes.data ?? [])[0] ?? null,
      } as Area);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}

// ─── Environment time series for the detail page ─────────────────────────────

export type EnvTimeRange = "24h" | "7d" | "30d";

export interface EnvReading {
  id: string;
  area_id: string;
  temperature_f: number | null;
  humidity_pct: number | null;
  vpd: number | null;
  co2_ppm: number | null;
  light_ppfd: number | null;
  recorded_at: string;
}

const RANGE_MS: Record<EnvTimeRange, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function useAreaEnvironment(areaId: string | undefined, range: EnvTimeRange = "24h") {
  const { orgId } = useOrg();
  const [data, setData] = useState<EnvReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!orgId || !areaId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const since = new Date(Date.now() - RANGE_MS[range]).toISOString();
      const { data: rows } = await supabase
        .from("grow_environmental_readings")
        .select("*")
        .eq("area_id", areaId)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true });
      if (cancelled) return;
      setData((rows ?? []) as EnvReading[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, areaId, range, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const latest = data.length > 0 ? data[data.length - 1] : null;
  /** Simple trend: compare latest reading to the one from 15 min before. */
  const trend = useMemo(() => {
    if (data.length < 2) return { temperature: 0, humidity: 0, vpd: 0, co2: 0 };
    const fifteenAgo = Date.now() - 15 * 60 * 1000;
    const priorIdx = data.findIndex((r) => new Date(r.recorded_at).getTime() >= fifteenAgo);
    const prior = priorIdx > 0 ? data[priorIdx - 1] : data[0];
    const diff = (current: number | null, old: number | null) =>
      current == null || old == null ? 0 : current - old;
    const last = data[data.length - 1];
    return {
      temperature: diff(last.temperature_f, prior.temperature_f),
      humidity: diff(last.humidity_pct, prior.humidity_pct),
      vpd: diff(last.vpd, prior.vpd),
      co2: diff(last.co2_ppm, prior.co2_ppm),
    };
  }, [data]);

  return { data, latest, trend, loading, refresh };
}

// ─── Alerts, plants, cycles, harvests, sensors ───────────────────────────────

export interface EnvAlert {
  id: string;
  area_id: string | null;
  alert_type: string;
  severity: string;
  threshold_value: number | null;
  actual_value: number | null;
  duration_minutes: number | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export function useAreaAlerts(areaId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<EnvAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!orgId || !areaId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("grow_environmental_alerts")
        .select("*")
        .eq("org_id", orgId)
        .eq("area_id", areaId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      setData((rows ?? []) as EnvAlert[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, areaId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const resolve = useCallback(async (id: string, notes?: string) => {
    const { error: err } = await supabase
      .from("grow_environmental_alerts")
      .update({
        resolved_at: new Date().toISOString(),
        resolution_notes: notes ?? null,
      })
      .eq("id", id);
    if (err) throw err;
    refresh();
  }, [refresh]);

  return { data, loading, resolve, refresh };
}

export function useAreaPlants(areaId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !areaId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: plants } = await supabase
        .from("grow_plants")
        .select("*")
        .eq("org_id", orgId)
        .eq("area_id", areaId)
        .not("phase", "in", "(destroyed,harvested)")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const strainIds = Array.from(new Set((plants ?? []).map((p: any) => p.strain_id).filter(Boolean))) as string[];
      const strainById = new Map<string, any>();
      if (strainIds.length > 0) {
        const { data: strains } = await supabase.from("grow_strains").select("id, name, type").in("id", strainIds);
        (strains ?? []).forEach((s: any) => strainById.set(s.id, s));
      }
      setData(((plants ?? []) as any[]).map((p) => ({ ...p, strain: p.strain_id ? strainById.get(p.strain_id) ?? null : null })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, areaId]);

  return { data, loading };
}

export function useAreaCycles(areaId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !areaId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: cycles } = await supabase
        .from("grow_cycles")
        .select("*")
        .eq("org_id", orgId)
        .eq("area_id", areaId)
        .order("start_date", { ascending: false });
      if (cancelled) return;
      const strainIds = Array.from(new Set((cycles ?? []).map((c: any) => c.strain_id).filter(Boolean))) as string[];
      const strainById = new Map<string, any>();
      if (strainIds.length > 0) {
        const { data: strains } = await supabase.from("grow_strains").select("id, name, type").in("id", strainIds);
        (strains ?? []).forEach((s: any) => strainById.set(s.id, s));
      }
      setData(((cycles ?? []) as any[]).map((c) => ({ ...c, strain: c.strain_id ? strainById.get(c.strain_id) ?? null : null })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, areaId]);

  return { data, loading };
}

/** Harvests that came from cycles in this area. */
export function useAreaHarvests(areaId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !areaId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: cycles } = await supabase
        .from("grow_cycles")
        .select("id, strain_id")
        .eq("org_id", orgId)
        .eq("area_id", areaId);
      const cycleIds = (cycles ?? []).map((c: any) => c.id);
      if (cycleIds.length === 0) { if (!cancelled) { setData([]); setLoading(false); } return; }
      const strainByCycle = new Map<string, string>();
      (cycles ?? []).forEach((c: any) => { if (c.strain_id) strainByCycle.set(c.id, c.strain_id); });

      const { data: harvests } = await supabase
        .from("grow_harvests")
        .select("*")
        .eq("org_id", orgId)
        .in("cycle_id", cycleIds)
        .order("created_at", { ascending: false });
      if (cancelled) return;

      const strainIds = Array.from(new Set((harvests ?? []).map((h: any) => strainByCycle.get(h.cycle_id)).filter(Boolean))) as string[];
      const strainById = new Map<string, any>();
      if (strainIds.length > 0) {
        const { data: strains } = await supabase.from("grow_strains").select("id, name").in("id", strainIds);
        (strains ?? []).forEach((s: any) => strainById.set(s.id, s));
      }
      setData(((harvests ?? []) as any[]).map((h) => ({
        ...h,
        strain: strainById.get(strainByCycle.get(h.cycle_id) ?? "") ?? null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, areaId]);

  return { data, loading };
}

export interface AreaSensor {
  id: string;
  device_type: string | null;
  manufacturer: string | null;
  model: string | null;
  connection_type: string | null;
  is_active: boolean;
  last_ping_at: string | null;
  last_reading_at: string | null;
}

export function useAreaSensors(areaId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<AreaSensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!orgId || !areaId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("grow_hardware_devices")
        .select("id, device_type, manufacturer, model, connection_type, is_active, last_ping_at, last_reading_at")
        .eq("org_id", orgId)
        .eq("assigned_to_area_id", areaId)
        .order("last_ping_at", { ascending: false });
      if (cancelled) return;
      setData((rows ?? []) as AreaSensor[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, areaId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}
