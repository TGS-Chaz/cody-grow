import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { generateExternalId } from "@/lib/ccrs-id";
import type {
  SourceType, SourceStatus, RootingMedium, HealthRating, StrainType,
} from "@/lib/schema-enums";

export interface Source {
  id: string;
  org_id: string;
  external_id: string;
  source_type: SourceType;
  strain_id: string | null;
  area_id: string | null;
  facility_id?: string | null; // derived via area
  mother_plant_id: string | null;
  batch_id: string | null;
  phenotype_id: string | null;
  initial_quantity: number | null;
  current_quantity: number | null;
  acquired_date: string | null;
  cut_date: string | null;
  source_vendor: string | null;
  vendor_lot_number: string | null;
  cost_per_unit: number | null;
  is_feminized: boolean | null;
  is_autoflower: boolean | null;
  germination_rate_expected: number | null;
  is_rooted: boolean | null;
  root_date: string | null;
  rooting_medium: RootingMedium | null;
  rooting_hormone: string | null;
  health_rating: HealthRating | null;
  status: SourceStatus;
  notes: string | null;
  ccrs_notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Joined strain */
  strain?: { id: string; name: string; type: StrainType | null } | null;
  /** Joined area */
  area?: { id: string; name: string; facility_id: string | null } | null;
  /** Joined mother plant */
  mother_plant?: { id: string; plant_identifier: string | null } | null;
  /** Derived: count of cycles created from this source */
  promoted_cycles_count?: number;
}

export interface SourceInput {
  source_type: SourceType;
  strain_id: string;
  area_id: string;
  quantity: number;
  date: string; // acquired_date for seeds, cut_date for clones
  // Seeds
  source_vendor?: string | null;
  vendor_lot_number?: string | null;
  cost_per_unit?: number | null;
  is_feminized?: boolean | null;
  is_autoflower?: boolean | null;
  germination_rate_expected?: number | null;
  // Clones
  mother_plant_id?: string | null;
  phenotype_id?: string | null;
  is_rooted?: boolean | null;
  root_date?: string | null;
  rooting_medium?: RootingMedium | null;
  rooting_hormone?: string | null;
  health_rating?: HealthRating | null;
  // Common
  status?: SourceStatus;
  notes?: string | null;
  ccrs_notes?: string | null;
}

export function useSources() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [srcRes, strainRes, areaRes, plantRes, cycleCountRes] = await Promise.all([
        supabase.from("grow_sources").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
        supabase.from("grow_strains").select("id, name, type").eq("org_id", orgId),
        supabase.from("grow_areas").select("id, name, facility_id").eq("org_id", orgId),
        supabase.from("grow_plants").select("id, plant_identifier").eq("org_id", orgId).eq("is_mother_plant", true),
        supabase.from("grow_plants").select("source_id, grow_cycle_id").eq("org_id", orgId).not("source_id", "is", null),
      ]);
      if (cancelled) return;
      if (srcRes.error) { setError(srcRes.error.message); setLoading(false); return; }

      const strainById = new Map<string, any>();
      (strainRes.data ?? []).forEach((s: any) => strainById.set(s.id, s));
      const areaById = new Map<string, any>();
      (areaRes.data ?? []).forEach((a: any) => areaById.set(a.id, a));
      const motherById = new Map<string, any>();
      (plantRes.data ?? []).forEach((p: any) => motherById.set(p.id, p));

      // Count distinct cycles per source (from plants that reference both source + cycle)
      const cyclesBySource = new Map<string, Set<string>>();
      (cycleCountRes.data ?? []).forEach((p: any) => {
        if (!p.source_id || !p.grow_cycle_id) return;
        const set = cyclesBySource.get(p.source_id) ?? new Set<string>();
        set.add(p.grow_cycle_id);
        cyclesBySource.set(p.source_id, set);
      });

      const merged = (srcRes.data ?? []).map((s: any) => ({
        ...s,
        strain: s.strain_id ? strainById.get(s.strain_id) ?? null : null,
        area: s.area_id ? areaById.get(s.area_id) ?? null : null,
        mother_plant: s.mother_plant_id ? motherById.get(s.mother_plant_id) ?? null : null,
        promoted_cycles_count: cyclesBySource.get(s.id)?.size ?? 0,
      })) as Source[];

      setData(merged);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const createSource = useCallback(async (input: SourceInput): Promise<Source> => {
    if (!orgId) throw new Error("No active org");
    const isClone = input.source_type === "clone";
    const payload: any = {
      org_id: orgId,
      external_id: generateExternalId(),
      source_type: input.source_type,
      strain_id: input.strain_id,
      area_id: input.area_id,
      initial_quantity: input.quantity,
      current_quantity: input.quantity,
      acquired_date: isClone ? null : input.date,
      cut_date: isClone ? input.date : null,
      status: input.status ?? "available",
      source_vendor: input.source_vendor ?? null,
      vendor_lot_number: input.vendor_lot_number ?? null,
      cost_per_unit: input.cost_per_unit ?? null,
      is_feminized: input.is_feminized ?? null,
      is_autoflower: input.is_autoflower ?? null,
      germination_rate_expected: input.germination_rate_expected ?? null,
      mother_plant_id: input.mother_plant_id ?? null,
      phenotype_id: input.phenotype_id ?? null,
      is_rooted: input.is_rooted ?? (isClone ? false : null),
      root_date: input.root_date ?? null,
      rooting_medium: input.rooting_medium ?? null,
      rooting_hormone: input.rooting_hormone ?? null,
      health_rating: input.health_rating ?? null,
      notes: input.notes ?? null,
      ccrs_notes: input.ccrs_notes ?? null,
      is_active: true,
    };
    const { data: row, error: err } = await supabase.from("grow_sources").insert(payload).select("*").single();
    if (err) throw err;
    // Create a corresponding grow_board_cards row so the source appears on
    // the Grow Board immediately. Upsert (vs insert) handles the rare case
    // where a card already exists for this entity.
    await supabase.from("grow_board_cards").upsert({
      org_id: orgId,
      column_name: "grow_sources",
      entity_type: "grow_source",
      entity_id: row.id,
      sort_order: 0,
    }, { onConflict: "column_name,entity_type,entity_id" });
    refresh();
    return row as Source;
  }, [orgId, refresh]);

  const updateSource = useCallback(async (id: string, patch: Partial<Source>) => {
    const { data: row, error: err } = await supabase.from("grow_sources").update(patch).eq("id", id).select("*").single();
    if (err) throw err;
    refresh();
    return row as Source;
  }, [refresh]);

  const archiveSource = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from("grow_sources")
      .update({ is_active: false, status: "destroyed" })
      .eq("id", id);
    if (err) throw err;
    refresh();
  }, [refresh]);

  /** Split a source into two: leaves `keepQuantity` on the original, moves
   * the remaining into a new source row with the same metadata. Useful when
   * a grower wants to quarantine a subset of a clone batch without losing
   * lineage to the original. */
  const splitSource = useCallback(async (sourceId: string, splitQuantity: number): Promise<Source> => {
    const { data: source } = await supabase.from("grow_sources").select("*").eq("id", sourceId).maybeSingle();
    if (!source) throw new Error("Source not found");
    const remaining = (source.current_quantity ?? 0) - splitQuantity;
    if (splitQuantity <= 0 || remaining < 0) throw new Error("Invalid split quantity");

    // New source inherits everything except id + quantities
    const { id: _id, external_id: _e, created_at: _c, updated_at: _u, ...rest } = source as any;
    const { data: newRow, error: err1 } = await supabase
      .from("grow_sources")
      .insert({
        ...rest,
        external_id: generateExternalId(),
        initial_quantity: splitQuantity,
        current_quantity: splitQuantity,
      })
      .select("*")
      .single();
    if (err1) throw err1;

    const { error: err2 } = await supabase
      .from("grow_sources")
      .update({ current_quantity: remaining })
      .eq("id", sourceId);
    if (err2) throw err2;

    refresh();
    return newRow as Source;
  }, [refresh]);

  /** Record a loss (destruction/quarantine) without creating a cycle. */
  const recordLoss = useCallback(async (sourceId: string, quantity: number, reason?: string) => {
    const { data: source } = await supabase.from("grow_sources").select("current_quantity, notes").eq("id", sourceId).maybeSingle();
    if (!source) throw new Error("Source not found");
    const remaining = Math.max(0, (source.current_quantity ?? 0) - quantity);
    const lossNote = `[${new Date().toISOString().slice(0, 10)}] Lost ${quantity} units${reason ? `: ${reason}` : ""}`;
    const combinedNotes = source.notes ? `${source.notes}\n${lossNote}` : lossNote;
    const { error: err } = await supabase
      .from("grow_sources")
      .update({
        current_quantity: remaining,
        status: remaining === 0 ? "depleted" : undefined,
        notes: combinedNotes,
      })
      .eq("id", sourceId);
    if (err) throw err;
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh, createSource, updateSource, archiveSource, splitSource, recordLoss };
}

export function useSourceStats(sources: Source[]) {
  return useMemo(() => ({
    total: sources.length,
    seeds: sources.filter((s) => s.source_type === "seed").length,
    clones: sources.filter((s) => s.source_type === "clone").length,
    tissueCulture: sources.filter((s) => s.source_type === "tissue_culture").length,
    available: sources.filter((s) => s.status === "available" && (s.current_quantity ?? 0) > 0).length,
    readyToPromote: sources.filter((s) => s.status === "available" && (s.current_quantity ?? 0) > 0).length,
  }), [sources]);
}

export function useSource(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row, error: err } = await supabase
        .from("grow_sources")
        .select("*")
        .eq("id", id)
        .eq("org_id", orgId)
        .maybeSingle();
      if (cancelled) return;
      if (err) { setError(err.message); setLoading(false); return; }
      if (!row) { setData(null); setLoading(false); return; }

      const [strainRes, areaRes, motherRes, cycleRes] = await Promise.all([
        row.strain_id ? supabase.from("grow_strains").select("id, name, type").eq("id", row.strain_id).maybeSingle() : Promise.resolve({ data: null }),
        row.area_id ? supabase.from("grow_areas").select("id, name, facility_id").eq("id", row.area_id).maybeSingle() : Promise.resolve({ data: null }),
        row.mother_plant_id ? supabase.from("grow_plants").select("id, plant_identifier").eq("id", row.mother_plant_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("grow_plants").select("grow_cycle_id").eq("org_id", orgId).eq("source_id", id),
      ]);
      if (cancelled) return;
      const cycles = new Set<string>();
      (cycleRes.data ?? []).forEach((p: any) => { if (p.grow_cycle_id) cycles.add(p.grow_cycle_id); });

      setData({
        ...(row as any),
        strain: (strainRes as any).data ?? null,
        area: (areaRes as any).data ?? null,
        mother_plant: (motherRes as any).data ?? null,
        promoted_cycles_count: cycles.size,
      } as Source);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}

// ─── Promotion flow ──────────────────────────────────────────────────────────

export interface PromoteInput {
  source_id: string;
  quantity: number;
  mode: "new_cycle" | "existing_cycle";
  /** For mode=new_cycle */
  cycle_name?: string;
  target_area_id?: string;
  target_harvest_date?: string | null;
  /** For mode=existing_cycle */
  existing_cycle_id?: string;
  /** "individual" creates one grow_plants row per unit; "bulk" updates only the batch. */
  plant_mode: "individual" | "bulk";
}

export interface PromoteResult {
  cycle_id: string;
  cycle_name: string;
  plant_ids: string[];
  source_id: string;
  plants_created: number;
  board_card_created: boolean;
}

/** Build a 3-letter abbreviation from a strain name. "Blue Dream" → "BDR".
 * Used to generate plant_identifier values like "BDR-001", "BDR-002". */
function strainAbbrev(name: string | null | undefined): string {
  if (!name) return "PLT";
  const cleaned = name.replace(/[^A-Za-z\s]/g, "").trim();
  if (!cleaned) return "PLT";
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1].slice(0, 2)).toUpperCase();
  return cleaned.slice(0, 3).toUpperCase();
}

/**
 * Promote units from a grow_source into a grow_cycle. Single-use hook —
 * callers should invoke `promote` once per promotion event. The flow:
 *   1. Decrement the source's current_quantity; flip to "in_cycle" or
 *      "depleted" as appropriate.
 *   2. Create a new grow_cycles row (or reuse an existing one).
 *   3. If plant_mode="individual", insert N grow_plants rows with a
 *      sequential plant_identifier, phase="vegetative", and source_id
 *      pointing back for CCRS traceability.
 *   4. Upsert a grow_board_cards row so the cycle appears on the Grow Board.
 *
 * Supabase JS has no transaction API, so each step is sequential. If any
 * step fails we throw and leave the caller to inspect partial state.
 */
export function usePromoteSource() {
  const { orgId } = useOrg();
  const { user } = useAuth();

  return useCallback(async (input: PromoteInput): Promise<PromoteResult> => {
    if (!orgId) throw new Error("No active org");

    // 1. Read the source + strain info
    const { data: source, error: srcErr } = await supabase
      .from("grow_sources").select("*").eq("id", input.source_id).maybeSingle();
    if (srcErr) throw srcErr;
    if (!source) throw new Error("Source not found");
    if (input.quantity <= 0) throw new Error("Quantity must be > 0");
    const remaining = (source.current_quantity ?? 0) - input.quantity;
    if (remaining < 0) throw new Error(`Only ${source.current_quantity} available`);

    let strain: any = null;
    if (source.strain_id) {
      const { data: s } = await supabase.from("grow_strains").select("id, name").eq("id", source.strain_id).maybeSingle();
      strain = s;
    }

    // 2. Create or reuse the cycle
    let cycleId: string;
    let cycleName: string;
    if (input.mode === "existing_cycle" && input.existing_cycle_id) {
      const { data: existing, error: cErr } = await supabase
        .from("grow_cycles").select("id, name").eq("id", input.existing_cycle_id).maybeSingle();
      if (cErr) throw cErr;
      if (!existing) throw new Error("Selected cycle not found");
      cycleId = existing.id;
      cycleName = existing.name;
    } else {
      if (!input.target_area_id) throw new Error("Target area is required for a new cycle");
      const name = input.cycle_name?.trim() || `${strain?.name ?? "Cycle"} - ${new Date().toISOString().slice(0, 10)}`;
      const { data: cycle, error: cErr } = await supabase
        .from("grow_cycles")
        .insert({
          org_id: orgId,
          name,
          strain_id: source.strain_id,
          area_id: input.target_area_id,
          phase: "vegetative",
          start_date: new Date().toISOString().slice(0, 10),
          target_harvest_date: input.target_harvest_date ?? null,
          plant_count: input.plant_mode === "individual" ? input.quantity : 0,
          created_by: user?.id ?? null,
        })
        .select("id, name").single();
      if (cErr) throw cErr;
      cycleId = cycle!.id;
      cycleName = cycle!.name;
    }

    // 3. Create plants if individual mode
    const plantIds: string[] = [];
    if (input.plant_mode === "individual") {
      // Find the next plant_identifier sequence for this strain
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

      const plantRows = Array.from({ length: input.quantity }).map((_, i) => ({
        org_id: orgId,
        external_id: generateExternalId(),
        plant_identifier: `${abbrev}-${String(maxSeq + i + 1).padStart(3, "0")}`,
        strain_id: source.strain_id,
        area_id: input.mode === "new_cycle" ? input.target_area_id : source.area_id,
        grow_cycle_id: cycleId,
        mother_plant_id: source.mother_plant_id,
        source_id: source.id,
        source_type: source.source_type,
        phase: "vegetative",
        phase_changed_at: new Date().toISOString(),
        ccrs_plant_state: "Growing",
        ccrs_growth_stage: "Vegetative",
        is_mother: false,
        is_mother_plant: false,
        created_by: user?.id ?? null,
      }));

      const { data: insertedPlants, error: pErr } = await supabase
        .from("grow_plants").insert(plantRows).select("id");
      if (pErr) throw pErr;
      (insertedPlants ?? []).forEach((p: any) => plantIds.push(p.id));
    } else {
      // Bulk mode: bump the cycle's plant_count
      await supabase
        .from("grow_cycles")
        .update({ plant_count: (await getCyclePlantCount(cycleId)) + input.quantity })
        .eq("id", cycleId);
    }

    // 4. Upsert a board card for the cycle
    const { error: bcErr } = await supabase
      .from("grow_board_cards")
      .upsert({
        org_id: orgId,
        column_name: "vegetative",
        entity_type: "grow_cycle",
        entity_id: cycleId,
        sort_order: 0,
      }, { onConflict: "column_name,entity_type,entity_id" });
    const boardCardCreated = !bcErr;

    // 5. Update the source's status + quantity
    const newStatus: SourceStatus = remaining === 0 ? "depleted" : "in_cycle";
    const { error: uErr } = await supabase
      .from("grow_sources")
      .update({ current_quantity: remaining, status: newStatus })
      .eq("id", source.id);
    if (uErr) throw uErr;

    // If the source is fully promoted (depleted), remove its Grow Sources
    // board card so it disappears from column 1. Partial promotions keep
    // the source card visible since the remaining units are still available.
    if (newStatus === "depleted") {
      await supabase
        .from("grow_board_cards")
        .delete()
        .eq("org_id", orgId)
        .eq("column_name", "grow_sources")
        .eq("entity_type", "grow_source")
        .eq("entity_id", source.id);
    }

    return {
      cycle_id: cycleId,
      cycle_name: cycleName,
      plant_ids: plantIds,
      source_id: source.id,
      plants_created: plantIds.length,
      board_card_created: boardCardCreated,
    };
  }, [orgId, user?.id]);
}

async function getCyclePlantCount(cycleId: string): Promise<number> {
  const { data } = await supabase.from("grow_cycles").select("plant_count").eq("id", cycleId).maybeSingle();
  return (data?.plant_count ?? 0) as number;
}

/** List the cycles a source has been promoted to. */
export function useSourcePromotionHistory(sourceId: string | undefined) {
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!orgId || !sourceId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      // Plants promoted from this source, grouped by cycle
      const { data: plants } = await supabase
        .from("grow_plants")
        .select("id, grow_cycle_id, area_id, phase, created_at")
        .eq("org_id", orgId)
        .eq("source_id", sourceId);
      const byCycle = new Map<string, { count: number; earliest: string; area_id: string | null; phases: Set<string> }>();
      (plants ?? []).forEach((p: any) => {
        if (!p.grow_cycle_id) return;
        const entry = byCycle.get(p.grow_cycle_id) ?? { count: 0, earliest: p.created_at, area_id: p.area_id ?? null, phases: new Set<string>() };
        entry.count += 1;
        if (new Date(p.created_at) < new Date(entry.earliest)) entry.earliest = p.created_at;
        entry.phases.add(p.phase);
        byCycle.set(p.grow_cycle_id, entry);
      });

      const cycleIds = Array.from(byCycle.keys());
      const cycleById = new Map<string, any>();
      if (cycleIds.length > 0) {
        const { data: cycles } = await supabase
          .from("grow_cycles").select("id, name, phase, start_date")
          .in("id", cycleIds);
        (cycles ?? []).forEach((c: any) => cycleById.set(c.id, c));
      }
      const areaIds = Array.from(new Set(Array.from(byCycle.values()).map((v) => v.area_id).filter(Boolean))) as string[];
      const areaById = new Map<string, any>();
      if (areaIds.length > 0) {
        const { data: areas } = await supabase.from("grow_areas").select("id, name").in("id", areaIds);
        (areas ?? []).forEach((a: any) => areaById.set(a.id, a));
      }

      if (cancelled) return;
      setData(cycleIds.map((cid) => {
        const entry = byCycle.get(cid)!;
        const cycle = cycleById.get(cid);
        return {
          cycle_id: cid,
          cycle_name: cycle?.name,
          cycle_phase: cycle?.phase,
          promoted_at: entry.earliest,
          quantity_promoted: entry.count,
          area: entry.area_id ? areaById.get(entry.area_id) ?? null : null,
        };
      }).sort((a, b) => new Date(b.promoted_at).getTime() - new Date(a.promoted_at).getTime()));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, sourceId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}
