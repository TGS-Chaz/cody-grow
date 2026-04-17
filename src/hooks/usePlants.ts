import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { generateExternalId } from "@/lib/ccrs-id";
import type {
  CcrsGrowthStage, CcrsPlantState, PlantPhase, PlantSourceType, StrainType,
  CcrsDestructionReason, CcrsDestructionMethod, DisposalDestructionMethod,
} from "@/lib/schema-enums";

export interface Plant {
  id: string;
  org_id: string;
  external_id: string;
  plant_identifier: string | null;
  strain_id: string | null;
  area_id: string | null;
  grow_cycle_id: string | null;
  mother_plant_id: string | null;
  source_id: string | null;
  phenotype_id: string | null;
  source_type: PlantSourceType | null;
  phase: PlantPhase | null;
  phase_changed_at: string | null;
  harvest_date: string | null;
  destroyed_at: string | null;
  destruction_reason: string | null;
  waste_grams: number | null;
  is_mother: boolean | null;
  is_mother_plant: boolean | null;
  harvest_cycle_months: number | null;
  ccrs_plant_state: CcrsPlantState | null;
  ccrs_growth_stage: CcrsGrowthStage | null;
  ccrs_created_by_username: string | null;
  ccrs_updated_by_username: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Joined strain */
  strain?: { id: string; name: string; type: StrainType | null } | null;
  /** Joined area */
  area?: { id: string; name: string } | null;
  /** Joined cycle */
  cycle?: { id: string; name: string | null; phase: string | null } | null;
  /** Joined source */
  source?: { id: string; source_type: string; external_id: string } | null;
  /** Joined phenotype */
  phenotype?: { id: string; pheno_number: string; pheno_name: string | null } | null;
}

export interface PlantInput {
  plant_identifier?: string | null;
  strain_id: string;
  area_id: string;
  ccrs_growth_stage: CcrsGrowthStage;
  source_type: PlantSourceType;
  ccrs_plant_state?: CcrsPlantState;
  phase?: PlantPhase;
  grow_cycle_id?: string | null;
  mother_plant_id?: string | null;
  source_id?: string | null;
  phenotype_id?: string | null;
  harvest_cycle_months?: number | null;
  harvest_date?: string | null;
  is_mother_plant?: boolean;
  notes?: string | null;
  ccrs_created_by_username?: string | null;
}

export interface PlantFilters {
  growth_stage?: CcrsGrowthStage;
  plant_state?: CcrsPlantState;
  strain_id?: string;
  area_id?: string;
  cycle_id?: string;
  is_mother?: boolean;
  source_type?: PlantSourceType;
  /** 1-indexed page number for server-side pagination. When omitted the hook
   * fetches all matching rows (prior behavior). */
  page?: number;
  pageSize?: number;
}

/** Build a 3-letter strain abbreviation (BDR, OGK, etc.) for plant IDs. */
function strainAbbrev(name: string | null | undefined): string {
  if (!name) return "PLT";
  const cleaned = name.replace(/[^A-Za-z\s]/g, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1].slice(0, 2)).toUpperCase();
  return (cleaned || "PLT").slice(0, 3).toUpperCase();
}

export function usePlants(filters?: PlantFilters) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Plant[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Snapshot filter primitives so the effect only re-runs when a filter
  // actually changes (not on every object identity change).
  const sig = useMemo(() =>
    filters ? `${filters.growth_stage ?? ""}:${filters.plant_state ?? ""}:${filters.strain_id ?? ""}:${filters.area_id ?? ""}:${filters.cycle_id ?? ""}:${filters.is_mother ?? ""}:${filters.source_type ?? ""}:${filters.page ?? ""}:${filters.pageSize ?? ""}` : "",
  [filters]);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setTotalCount(0); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const paginated = filters?.page != null && filters?.pageSize != null;
      let q = paginated
        ? supabase.from("grow_plants").select("*", { count: "exact" }).eq("org_id", orgId)
        : supabase.from("grow_plants").select("*").eq("org_id", orgId);
      if (filters?.growth_stage) q = q.eq("ccrs_growth_stage", filters.growth_stage);
      if (filters?.plant_state) q = q.eq("ccrs_plant_state", filters.plant_state);
      if (filters?.strain_id) q = q.eq("strain_id", filters.strain_id);
      if (filters?.area_id) q = q.eq("area_id", filters.area_id);
      if (filters?.cycle_id) q = q.eq("grow_cycle_id", filters.cycle_id);
      if (filters?.is_mother !== undefined) q = q.eq("is_mother_plant", filters.is_mother);
      if (filters?.source_type) q = q.eq("source_type", filters.source_type);
      q = q.order("created_at", { ascending: false });
      if (paginated) {
        const from = (filters!.page! - 1) * filters!.pageSize!;
        q = q.range(from, from + filters!.pageSize! - 1);
      }
      const { data: plants, error: err, count } = await q;
      if (cancelled) return;
      if (err) { setError(err.message); setLoading(false); return; }
      if (paginated) setTotalCount(count ?? 0);

      // Batch lookups for strains, areas, cycles, sources, phenotypes
      const strainIds = new Set<string>();
      const areaIds = new Set<string>();
      const cycleIds = new Set<string>();
      const sourceIds = new Set<string>();
      const phenoIds = new Set<string>();
      (plants ?? []).forEach((p: any) => {
        if (p.strain_id) strainIds.add(p.strain_id);
        if (p.area_id) areaIds.add(p.area_id);
        if (p.grow_cycle_id) cycleIds.add(p.grow_cycle_id);
        if (p.source_id) sourceIds.add(p.source_id);
        if (p.phenotype_id) phenoIds.add(p.phenotype_id);
      });

      const [strainRes, areaRes, cycleRes, sourceRes, phenoRes] = await Promise.all([
        strainIds.size > 0 ? supabase.from("grow_strains").select("id, name, type").in("id", Array.from(strainIds)) : Promise.resolve({ data: [] }),
        areaIds.size > 0 ? supabase.from("grow_areas").select("id, name").in("id", Array.from(areaIds)) : Promise.resolve({ data: [] }),
        cycleIds.size > 0 ? supabase.from("grow_cycles").select("id, name, phase").in("id", Array.from(cycleIds)) : Promise.resolve({ data: [] }),
        sourceIds.size > 0 ? supabase.from("grow_sources").select("id, source_type, external_id").in("id", Array.from(sourceIds)) : Promise.resolve({ data: [] }),
        phenoIds.size > 0 ? supabase.from("grow_phenotypes").select("id, pheno_number, pheno_name").in("id", Array.from(phenoIds)) : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;

      const strainById = new Map<string, any>(); (strainRes.data ?? []).forEach((s: any) => strainById.set(s.id, s));
      const areaById = new Map<string, any>(); (areaRes.data ?? []).forEach((a: any) => areaById.set(a.id, a));
      const cycleById = new Map<string, any>(); (cycleRes.data ?? []).forEach((c: any) => cycleById.set(c.id, c));
      const sourceById = new Map<string, any>(); (sourceRes.data ?? []).forEach((s: any) => sourceById.set(s.id, s));
      const phenoById = new Map<string, any>(); (phenoRes.data ?? []).forEach((p: any) => phenoById.set(p.id, p));

      const merged = (plants ?? []).map((p: any) => ({
        ...p,
        strain: p.strain_id ? strainById.get(p.strain_id) ?? null : null,
        area: p.area_id ? areaById.get(p.area_id) ?? null : null,
        cycle: p.grow_cycle_id ? cycleById.get(p.grow_cycle_id) ?? null : null,
        source: p.source_id ? sourceById.get(p.source_id) ?? null : null,
        phenotype: p.phenotype_id ? phenoById.get(p.phenotype_id) ?? null : null,
      })) as Plant[];

      setData(merged);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, tick, sig]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Expose totalCount via the returned object below (shape preserved — new field only).

  /** Create a plant with auto-generated plant_identifier if blank. */
  const createPlant = useCallback(async (input: PlantInput): Promise<Plant> => {
    if (!orgId) throw new Error("No active org");

    let plant_identifier = input.plant_identifier?.trim();
    if (!plant_identifier && input.strain_id) {
      // Look up strain name for the abbreviation
      const { data: strain } = await supabase.from("grow_strains").select("name").eq("id", input.strain_id).maybeSingle();
      const abbrev = strainAbbrev(strain?.name);
      const { data: existing } = await supabase
        .from("grow_plants")
        .select("plant_identifier")
        .eq("org_id", orgId)
        .like("plant_identifier", `${abbrev}-%`);
      const maxSeq = (existing ?? []).reduce((max: number, row: any) => {
        const m = /(\d+)$/.exec(row.plant_identifier ?? "");
        return m ? Math.max(max, Number(m[1])) : max;
      }, 0);
      plant_identifier = `${abbrev}-${String(maxSeq + 1).padStart(4, "0")}`;
    }

    const payload = {
      org_id: orgId,
      external_id: generateExternalId(),
      plant_identifier: plant_identifier ?? null,
      strain_id: input.strain_id,
      area_id: input.area_id,
      grow_cycle_id: input.grow_cycle_id ?? null,
      mother_plant_id: input.mother_plant_id ?? null,
      source_id: input.source_id ?? null,
      phenotype_id: input.phenotype_id ?? null,
      source_type: input.source_type,
      ccrs_growth_stage: input.ccrs_growth_stage,
      ccrs_plant_state: input.ccrs_plant_state ?? "Growing",
      phase: input.phase ?? (input.ccrs_growth_stage === "Flowering" ? "flowering" : input.ccrs_growth_stage === "Vegetative" ? "vegetative" : "immature"),
      phase_changed_at: new Date().toISOString(),
      harvest_cycle_months: input.harvest_cycle_months ?? null,
      harvest_date: input.harvest_date ?? null,
      is_mother_plant: input.is_mother_plant ?? false,
      is_mother: input.is_mother_plant ?? false,
      notes: input.notes ?? null,
      ccrs_created_by_username: input.ccrs_created_by_username ?? null,
    };
    const { data: row, error: err } = await supabase.from("grow_plants").insert(payload).select("*").single();
    if (err) throw err;
    refresh();
    return row as Plant;
  }, [orgId, refresh]);

  const updatePlant = useCallback(async (id: string, patch: Partial<PlantInput>) => {
    const { data: row, error: err } = await supabase.from("grow_plants").update(patch).eq("id", id).select("*").single();
    if (err) throw err;
    refresh();
    return row as Plant;
  }, [refresh]);

  return { data, loading, error, refresh, createPlant, updatePlant, totalCount };
}

export function usePlantStats(plants: Plant[]) {
  return useMemo(() => ({
    total: plants.length,
    immature: plants.filter((p) => p.ccrs_growth_stage === "Immature").length,
    vegetative: plants.filter((p) => p.ccrs_growth_stage === "Vegetative").length,
    flowering: plants.filter((p) => p.ccrs_growth_stage === "Flowering").length,
    harvested: plants.filter((p) => p.ccrs_plant_state === "Harvested").length,
    destroyed: plants.filter((p) => p.ccrs_plant_state === "Destroyed").length,
    motherPlants: plants.filter((p) => p.is_mother_plant).length,
    quarantined: plants.filter((p) => p.ccrs_plant_state === "Quarantined").length,
  }), [plants]);
}

export function usePlant(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Plant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row, error: err } = await supabase
        .from("grow_plants").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (cancelled) return;
      if (err) { setError(err.message); setLoading(false); return; }
      if (!row) { setData(null); setLoading(false); return; }

      const [strainRes, areaRes, cycleRes, sourceRes, phenoRes, motherRes] = await Promise.all([
        row.strain_id ? supabase.from("grow_strains").select("id, name, type").eq("id", row.strain_id).maybeSingle() : Promise.resolve({ data: null }),
        row.area_id ? supabase.from("grow_areas").select("id, name").eq("id", row.area_id).maybeSingle() : Promise.resolve({ data: null }),
        row.grow_cycle_id ? supabase.from("grow_cycles").select("id, name, phase").eq("id", row.grow_cycle_id).maybeSingle() : Promise.resolve({ data: null }),
        row.source_id ? supabase.from("grow_sources").select("id, source_type, external_id").eq("id", row.source_id).maybeSingle() : Promise.resolve({ data: null }),
        row.phenotype_id ? supabase.from("grow_phenotypes").select("id, pheno_number, pheno_name").eq("id", row.phenotype_id).maybeSingle() : Promise.resolve({ data: null }),
        row.mother_plant_id ? supabase.from("grow_plants").select("id, plant_identifier").eq("id", row.mother_plant_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;

      setData({
        ...(row as any),
        strain: (strainRes as any).data ?? null,
        area: (areaRes as any).data ?? null,
        cycle: (cycleRes as any).data ?? null,
        source: (sourceRes as any).data ?? null,
        phenotype: (phenoRes as any).data ?? null,
        mother_plant: (motherRes as any).data ?? null,
      } as any);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}

// ─── Phase change (single + bulk) ────────────────────────────────────────────

export interface PhaseChangeInput {
  growth_stage: CcrsGrowthStage;
  plant_state?: CcrsPlantState;
  phase_changed_at?: string;
  notes?: string;
}

/** Map CCRS growth stage → internal phase (grow_plants.phase CHECK constraint). */
function phaseForStage(stage: CcrsGrowthStage): PlantPhase {
  if (stage === "Flowering") return "flowering";
  if (stage === "Vegetative") return "vegetative";
  return "immature";
}

export function usePhaseChange() {
  return useCallback(async (plantIds: string[], input: PhaseChangeInput) => {
    if (plantIds.length === 0) throw new Error("No plants selected");

    const patch: any = {
      ccrs_growth_stage: input.growth_stage,
      ccrs_plant_state: input.plant_state ?? "Growing",
      phase: phaseForStage(input.growth_stage),
      phase_changed_at: input.phase_changed_at ?? new Date().toISOString(),
    };

    const { error: pErr } = await supabase
      .from("grow_plants")
      .update(patch)
      .in("id", plantIds);
    if (pErr) throw pErr;

    // Append an audit note if provided (we don't have an audit table yet, so
    // append to the plant's notes field for now)
    if (input.notes?.trim()) {
      const { data: plants } = await supabase.from("grow_plants").select("id, notes").in("id", plantIds);
      await Promise.all((plants ?? []).map(async (p: any) => {
        const stamp = new Date().toISOString().slice(0, 10);
        const line = `[${stamp}] Phase change to ${input.growth_stage}: ${input.notes}`;
        const combined = p.notes ? `${p.notes}\n${line}` : line;
        await supabase.from("grow_plants").update({ notes: combined }).eq("id", p.id);
      }));
    }

    // Sync grow_board_cards for any cycle whose plants ALL moved to the new
    // growth stage (so if a cycle's last veg plants move to flower, the
    // cycle's board card follows).
    const { data: updatedPlants } = await supabase
      .from("grow_plants").select("grow_cycle_id").in("id", plantIds).not("grow_cycle_id", "is", null);
    const cycleIds = Array.from(new Set((updatedPlants ?? []).map((p: any) => p.grow_cycle_id))).filter(Boolean) as string[];
    for (const cycleId of cycleIds) {
      const { data: allPlants } = await supabase
        .from("grow_plants").select("ccrs_growth_stage").eq("grow_cycle_id", cycleId).not("phase", "in", "(destroyed,harvested)");
      const stages = new Set((allPlants ?? []).map((p: any) => p.ccrs_growth_stage));
      if (stages.size === 1 && stages.has(input.growth_stage)) {
        const newCol = input.growth_stage === "Flowering" ? "flowering" : "vegetative";
        await supabase
          .from("grow_cycles").update({ phase: newCol }).eq("id", cycleId);
        await supabase
          .from("grow_board_cards")
          .update({ column_name: newCol })
          .eq("entity_type", "grow_cycle").eq("entity_id", cycleId);
      }
    }
  }, []);
}

// ─── Destroy plant (CCRS disposal) ───────────────────────────────────────────

export interface DestroyInput {
  reason: CcrsDestructionReason;
  method: CcrsDestructionMethod;
  destruction_method_internal?: DisposalDestructionMethod;
  destroyed_at?: string;
  pre_disposal_weight_grams?: number | null;
  notes?: string | null;
}

/** CCRS-exact destruction methods map to internal disposal method values.
 * CCRS only accepts Compost/Grind/Other; internal tracks more detail. */
const CCRS_TO_INTERNAL_METHOD: Record<CcrsDestructionMethod, DisposalDestructionMethod> = {
  Compost: "composting",
  Grind: "grinding_mixing",
  Other: "other",
};

export function useDestroyPlant() {
  const { user } = useAuth();
  const { orgId } = useOrg();

  return useCallback(async (plantIds: string[], input: DestroyInput) => {
    if (!orgId) throw new Error("No active org");
    if (plantIds.length === 0) throw new Error("No plants selected");

    // 1. Create the grow_disposals record (one for the batch of plants).
    // grow_disposals.quarantine_started_at + quarantine_ends_at are NOT NULL —
    // for immediate destruction we set both to destroyed_at (zero-length
    // quarantine window). Users who want a real hold period can edit the row
    // from the Compliance page later.
    const destroyedAt = input.destroyed_at ?? new Date().toISOString();
    const { error: dErr } = await supabase
      .from("grow_disposals")
      .insert({
        org_id: orgId,
        external_id: generateExternalId(),
        disposal_type: "plant",
        plant_ids: plantIds,
        destruction_method: input.destruction_method_internal ?? CCRS_TO_INTERNAL_METHOD[input.method],
        ccrs_destruction_method: input.method,
        ccrs_destruction_reason: input.reason,
        quarantine_started_at: destroyedAt,
        quarantine_ends_at: destroyedAt,
        destroyed_at: destroyedAt,
        pre_disposal_weight_grams: input.pre_disposal_weight_grams ?? null,
        reason: input.notes?.trim() || input.reason,
        status: "destroyed",
        notes: input.notes ?? null,
        created_by: user?.id ?? null,
      });
    if (dErr) throw dErr;

    // 2. Flip the plants to Destroyed state
    const { error: pErr } = await supabase
      .from("grow_plants")
      .update({
        ccrs_plant_state: "Destroyed",
        phase: "destroyed",
        destroyed_at: input.destroyed_at ?? new Date().toISOString(),
        destruction_reason: input.reason,
        waste_grams: input.pre_disposal_weight_grams ?? null,
      })
      .in("id", plantIds);
    if (pErr) throw pErr;
  }, [orgId, user?.id]);
}

// ─── Mother designation + bulk area move ─────────────────────────────────────

export function useDesignateMother() {
  return useCallback(async (plantId: string, isMother: boolean) => {
    const { error: err } = await supabase
      .from("grow_plants")
      .update({ is_mother_plant: isMother, is_mother: isMother })
      .eq("id", plantId);
    if (err) throw err;
  }, []);
}

export function useMovePlantArea() {
  return useCallback(async (plantIds: string[], newAreaId: string) => {
    if (plantIds.length === 0) throw new Error("No plants selected");
    const { error: err } = await supabase
      .from("grow_plants").update({ area_id: newAreaId }).in("id", plantIds);
    if (err) throw err;
  }, []);
}

// ─── Related-record hooks ────────────────────────────────────────────────────

export function usePlantChildren(motherPlantId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !motherPlantId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: children } = await supabase
        .from("grow_plants").select("*").eq("org_id", orgId).eq("mother_plant_id", motherPlantId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setData((children ?? []) as Plant[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, motherPlantId]);

  return { data, loading };
}

export function usePlantGrowLogs(plantId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !plantId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: logs } = await supabase
        .from("grow_logs").select("*").eq("org_id", orgId).eq("plant_id", plantId)
        .order("recorded_at", { ascending: false });
      if (cancelled) return;
      setData(logs ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, plantId]);

  return { data, loading };
}

export function usePlantTasks(plantId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !plantId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      // grow_tasks may reference plants via plant_id if that column exists —
      // if not, silently fall through with an empty list.
      const { data: tasks, error } = await supabase
        .from("grow_tasks").select("*").eq("org_id", orgId).eq("plant_id", plantId)
        .order("due_date", { ascending: true });
      if (cancelled) return;
      if (error) { setData([]); setLoading(false); return; }
      setData(tasks ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, plantId]);

  return { data, loading };
}

/** Plant measurements live in grow_logs with log_type='measurement' and the
 * measurements JSONB column. This hook fetches and reshapes them so the
 * detail page can render a table + growth chart without understanding the
 * grow_logs polymorphism. */
export function usePlantMeasurements(plantId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!orgId || !plantId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data: logs } = await supabase
        .from("grow_logs")
        .select("*")
        .eq("org_id", orgId)
        .eq("plant_id", plantId)
        .eq("log_type", "measurement")
        .order("recorded_at", { ascending: false });
      if (cancelled) return;
      // Flatten the measurements JSONB → one row per key:value pair so the
      // table can show Date / Type / Value / Unit / Notes cleanly.
      const rows: any[] = [];
      (logs ?? []).forEach((l: any) => {
        const m = l.measurements ?? {};
        const recorded_by = l.recorded_by;
        Object.entries(m).forEach(([key, v]: [string, any]) => {
          if (v && typeof v === "object") {
            rows.push({
              id: `${l.id}-${key}`,
              log_id: l.id,
              recorded_at: l.recorded_at,
              recorded_by,
              type: key,
              value: v.value ?? null,
              unit: v.unit ?? null,
              notes: l.content ?? null,
            });
          } else {
            rows.push({
              id: `${l.id}-${key}`,
              log_id: l.id,
              recorded_at: l.recorded_at,
              recorded_by,
              type: key,
              value: v,
              unit: null,
              notes: l.content ?? null,
            });
          }
        });
      });
      setData(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, plantId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

// ─── Grow log + measurement creation ─────────────────────────────────────────

export interface GrowLogInput {
  plant_id?: string | null;
  grow_cycle_id?: string | null;
  area_id?: string | null;
  harvest_id?: string | null;
  batch_id?: string | null;
  log_type: "observation" | "measurement" | "technique" | "issue" | "intervention" | "milestone" | "note";
  title?: string | null;
  content?: string | null;
  measurements?: Record<string, any> | null;
  photo_urls?: string[] | null;
  tags?: string[] | null;
  recorded_at?: string;
}

export function useCreateGrowLog() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: GrowLogInput) => {
    if (!orgId) throw new Error("No active org");
    const payload = {
      org_id: orgId,
      plant_id: input.plant_id ?? null,
      grow_cycle_id: input.grow_cycle_id ?? null,
      area_id: input.area_id ?? null,
      harvest_id: input.harvest_id ?? null,
      batch_id: input.batch_id ?? null,
      log_type: input.log_type,
      title: input.title ?? null,
      content: input.content ?? null,
      measurements: input.measurements ?? null,
      photo_urls: input.photo_urls ?? null,
      tags: input.tags ?? null,
      recorded_by: user?.id ?? null,
      recorded_at: input.recorded_at ?? new Date().toISOString(),
    };
    const { data: row, error: err } = await supabase.from("grow_logs").insert(payload).select("*").single();
    if (err) throw err;
    return row;
  }, [orgId, user?.id]);
}

export interface MeasurementInput {
  plant_id: string;
  type: string;   // height, width, canopy_spread, stem_diameter, internodal_distance, other
  value: number;
  unit?: string | null;
  notes?: string | null;
  recorded_at?: string;
}

export function useCreateMeasurement() {
  const createLog = useCreateGrowLog();
  return useCallback(async (input: MeasurementInput) => {
    return createLog({
      plant_id: input.plant_id,
      log_type: "measurement",
      title: `${input.type.replace(/_/g, " ")} measurement`,
      content: input.notes ?? null,
      measurements: { [input.type]: { value: input.value, unit: input.unit ?? null } },
      recorded_at: input.recorded_at,
    });
  }, [createLog]);
}

export const MEASUREMENT_TYPES = [
  "height", "width", "canopy_spread", "stem_diameter", "internodal_distance", "other",
] as const;
export const MEASUREMENT_TYPE_LABELS: Record<typeof MEASUREMENT_TYPES[number], string> = {
  height: "Height",
  width: "Width",
  canopy_spread: "Canopy spread",
  stem_diameter: "Stem diameter",
  internodal_distance: "Internodal distance",
  other: "Other",
};
export const MEASUREMENT_UNITS = ["in", "cm", "mm"] as const;

export const GROW_LOG_TYPES = [
  "observation", "measurement", "technique", "issue", "intervention", "milestone", "note",
] as const;
export const GROW_LOG_TYPE_LABELS: Record<typeof GROW_LOG_TYPES[number], string> = {
  observation: "Observation",
  measurement: "Measurement",
  technique: "Technique",
  issue: "Issue",
  intervention: "Intervention",
  milestone: "Milestone",
  note: "Note",
};
