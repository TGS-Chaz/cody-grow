import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { generateExternalId } from "@/lib/ccrs-id";
import type { StrainType } from "@/lib/schema-enums";

/**
 * The Grow Board reads from grow_board_cards and hydrates each card with
 * its underlying entity data. The 5 columns correspond to entity types:
 *
 *   grow_sources  → grow_source    (not yet promoted to a cycle)
 *   vegetative    → grow_cycle     (phase=vegetative)
 *   flowering     → grow_cycle     (phase=flowering)
 *   drying        → harvest        (status=drying/curing/cured)
 *   inventory     → batch          (post-harvest inventory)
 *
 * Column transitions are one-way forward. The unique constraint on
 * (column_name, entity_type, entity_id) means we can safely upsert cards.
 */

export const BOARD_COLUMNS = ["grow_sources", "vegetative", "flowering", "drying", "inventory"] as const;
export type BoardColumn = typeof BOARD_COLUMNS[number];

export const BOARD_COLUMN_LABELS: Record<BoardColumn, string> = {
  grow_sources: "Grow Sources",
  vegetative: "Vegetative",
  flowering: "Flowering",
  drying: "Drying / Curing",
  inventory: "Inventory",
};

export const BOARD_COLUMN_COLORS: Record<BoardColumn, { bar: string; ring: string; text: string; glow: string; hex: string }> = {
  grow_sources: { bar: "bg-blue-500",    ring: "ring-blue-500/40",    text: "text-blue-500",    glow: "shadow-blue-500/20",    hex: "#3B82F6" },
  vegetative:   { bar: "bg-emerald-500", ring: "ring-emerald-500/40", text: "text-emerald-500", glow: "shadow-emerald-500/20", hex: "#10B981" },
  flowering:    { bar: "bg-purple-500",  ring: "ring-purple-500/40",  text: "text-purple-500",  glow: "shadow-purple-500/20",  hex: "#A855F7" },
  drying:       { bar: "bg-orange-500",  ring: "ring-orange-500/40",  text: "text-orange-500",  glow: "shadow-orange-500/20",  hex: "#F97316" },
  inventory:    { bar: "bg-teal-500",    ring: "ring-teal-500/40",    text: "text-teal-500",    glow: "shadow-teal-500/20",    hex: "#14B8A6" },
};

/** Maps a source column to the next valid column. */
export const NEXT_COLUMN: Record<BoardColumn, BoardColumn | null> = {
  grow_sources: "vegetative",
  vegetative: "flowering",
  flowering: "drying",
  drying: "inventory",
  inventory: null,
};

/** Human-readable action label for each forward transition. */
export const TRANSITION_ACTION: Record<BoardColumn, string> = {
  grow_sources: "Promote",
  vegetative: "Move to Flower",
  flowering: "Harvest",
  drying: "Finalize to Inventory",
  inventory: "",
};

export interface BoardCardRow {
  id: string;
  column_name: BoardColumn;
  entity_type: "grow_source" | "grow_cycle" | "harvest" | "batch";
  entity_id: string;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StrainInfo { id: string; name: string; type: StrainType | null; average_flower_days: number | null }
export interface AreaInfo { id: string; name: string }
export interface ProductInfo { id: string; name: string; ccrs_inventory_category: string | null }

export interface HydratedBoardCard {
  card: BoardCardRow;
  column: BoardColumn;
  entityId: string;
  entityType: BoardCardRow["entity_type"];
  /** The underlying entity record (source/cycle/harvest/batch). Specific per column. */
  entity: any;
  /** Joined strain (if relevant) */
  strain: StrainInfo | null;
  /** Joined area (if relevant) */
  area: AreaInfo | null;
  /** Additional derived fields specific to the column */
  extras: {
    /** For cycles: plant count */
    plant_count?: number;
    /** Product ref for inventory batches */
    product?: ProductInfo | null;
    /** Latest QA lot status for batches */
    qa_status?: string | null;
  };
}

export interface BoardData {
  columns: Record<BoardColumn, HydratedBoardCard[]>;
  totals: Record<BoardColumn, number>;
  total_plants: number;
  strains_active: number;
  upcoming_harvests: number;
  overdue_items: number;
}

const EMPTY_BOARD: BoardData = {
  columns: {
    grow_sources: [], vegetative: [], flowering: [], drying: [], inventory: [],
  },
  totals: { grow_sources: 0, vegetative: 0, flowering: 0, drying: 0, inventory: 0 },
  total_plants: 0,
  strains_active: 0,
  upcoming_harvests: 0,
  overdue_items: 0,
};

export function useGrowBoard() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<BoardData>(EMPTY_BOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData(EMPTY_BOARD); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: cards, error: cErr } = await supabase
        .from("grow_board_cards")
        .select("*")
        .eq("org_id", orgId)
        .order("column_name")
        .order("sort_order");
      if (cancelled) return;
      if (cErr) { setError(cErr.message); setLoading(false); return; }

      // Partition by entity_type so we can fetch each set of entities in a single query
      const cardsByType: Record<string, BoardCardRow[]> = { grow_source: [], grow_cycle: [], harvest: [], batch: [] };
      (cards ?? []).forEach((c: any) => {
        if (cardsByType[c.entity_type]) cardsByType[c.entity_type].push(c as BoardCardRow);
      });

      const sourceIds = cardsByType.grow_source.map((c) => c.entity_id);
      const cycleIds = cardsByType.grow_cycle.map((c) => c.entity_id);
      const harvestIds = cardsByType.harvest.map((c) => c.entity_id);
      const batchIds = cardsByType.batch.map((c) => c.entity_id);

      const [sourceRes, cycleRes, harvestRes, batchRes, plantRes] = await Promise.all([
        sourceIds.length > 0
          ? supabase.from("grow_sources").select("*").in("id", sourceIds)
          : Promise.resolve({ data: [] }),
        cycleIds.length > 0
          ? supabase.from("grow_cycles").select("*").in("id", cycleIds)
          : Promise.resolve({ data: [] }),
        harvestIds.length > 0
          ? supabase.from("grow_harvests").select("*").in("id", harvestIds)
          : Promise.resolve({ data: [] }),
        batchIds.length > 0
          ? supabase.from("grow_batches").select("*").in("id", batchIds)
          : Promise.resolve({ data: [] }),
        cycleIds.length > 0
          ? supabase.from("grow_plants").select("grow_cycle_id, phase").in("grow_cycle_id", cycleIds).not("phase", "in", "(destroyed,harvested)")
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;

      // Collect strain + area IDs referenced by any entity
      const strainIds = new Set<string>();
      const areaIds = new Set<string>();
      const productIds = new Set<string>();
      (sourceRes.data ?? []).forEach((s: any) => { if (s.strain_id) strainIds.add(s.strain_id); if (s.area_id) areaIds.add(s.area_id); });
      (cycleRes.data ?? []).forEach((c: any) => { if (c.strain_id) strainIds.add(c.strain_id); if (c.area_id) areaIds.add(c.area_id); });
      (harvestRes.data ?? []).forEach((h: any) => { if (h.strain_id) strainIds.add(h.strain_id); if (h.area_id) areaIds.add(h.area_id); });
      (batchRes.data ?? []).forEach((b: any) => { if (b.strain_id) strainIds.add(b.strain_id); if (b.area_id) areaIds.add(b.area_id); if (b.product_id) productIds.add(b.product_id); });

      const [strainRes, areaRes, productRes] = await Promise.all([
        strainIds.size > 0 ? supabase.from("grow_strains").select("id, name, type, average_flower_days").in("id", Array.from(strainIds)) : Promise.resolve({ data: [] }),
        areaIds.size > 0 ? supabase.from("grow_areas").select("id, name").in("id", Array.from(areaIds)) : Promise.resolve({ data: [] }),
        productIds.size > 0 ? supabase.from("grow_products").select("id, name, ccrs_inventory_category").in("id", Array.from(productIds)) : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;

      const strainById = new Map<string, StrainInfo>();
      (strainRes.data ?? []).forEach((s: any) => strainById.set(s.id, s));
      const areaById = new Map<string, AreaInfo>();
      (areaRes.data ?? []).forEach((a: any) => areaById.set(a.id, a));
      const productById = new Map<string, ProductInfo>();
      (productRes.data ?? []).forEach((p: any) => productById.set(p.id, p));

      const plantCountByCycle = new Map<string, number>();
      (plantRes.data ?? []).forEach((p: any) => {
        if (!p.grow_cycle_id) return;
        plantCountByCycle.set(p.grow_cycle_id, (plantCountByCycle.get(p.grow_cycle_id) ?? 0) + 1);
      });

      const sourceById = new Map<string, any>();
      (sourceRes.data ?? []).forEach((s: any) => sourceById.set(s.id, s));
      const cycleById = new Map<string, any>();
      (cycleRes.data ?? []).forEach((c: any) => cycleById.set(c.id, c));
      const harvestById = new Map<string, any>();
      (harvestRes.data ?? []).forEach((h: any) => harvestById.set(h.id, h));
      const batchById = new Map<string, any>();
      (batchRes.data ?? []).forEach((b: any) => batchById.set(b.id, b));

      // Hydrate each card
      const columns: Record<BoardColumn, HydratedBoardCard[]> = {
        grow_sources: [], vegetative: [], flowering: [], drying: [], inventory: [],
      };

      (cards ?? []).forEach((card: any) => {
        let entity: any = null;
        let strain: StrainInfo | null = null;
        let area: AreaInfo | null = null;
        const extras: HydratedBoardCard["extras"] = {};

        if (card.entity_type === "grow_source") {
          entity = sourceById.get(card.entity_id);
        } else if (card.entity_type === "grow_cycle") {
          entity = cycleById.get(card.entity_id);
          extras.plant_count = entity?.id ? plantCountByCycle.get(entity.id) ?? 0 : 0;
        } else if (card.entity_type === "harvest") {
          entity = harvestById.get(card.entity_id);
        } else if (card.entity_type === "batch") {
          entity = batchById.get(card.entity_id);
          extras.product = entity?.product_id ? productById.get(entity.product_id) ?? null : null;
        }

        // If the underlying entity was deleted, skip the card rather than crashing
        if (!entity) return;

        if (entity.strain_id) strain = strainById.get(entity.strain_id) ?? null;
        if (entity.area_id) area = areaById.get(entity.area_id) ?? null;

        const hydrated: HydratedBoardCard = {
          card: card as BoardCardRow,
          column: card.column_name as BoardColumn,
          entityId: card.entity_id,
          entityType: card.entity_type,
          entity,
          strain,
          area,
          extras,
        };
        const col = card.column_name as BoardColumn;
        if (columns[col]) columns[col].push(hydrated);
      });

      // Derive summary counts
      const totals: Record<BoardColumn, number> = {
        grow_sources: columns.grow_sources.length,
        vegetative: columns.vegetative.length,
        flowering: columns.flowering.length,
        drying: columns.drying.length,
        inventory: columns.inventory.length,
      };
      const totalPlants =
        [...columns.vegetative, ...columns.flowering].reduce((sum, c) => sum + (c.extras.plant_count ?? 0), 0);
      const activeStrains = new Set<string>();
      [...columns.vegetative, ...columns.flowering].forEach((c) => { if (c.strain?.id) activeStrains.add(c.strain.id); });

      // Upcoming: cycles in flowering with target_harvest_date within 7 days
      const now = Date.now();
      const in7 = now + 7 * 24 * 60 * 60 * 1000;
      const upcoming = columns.flowering.filter((c) => {
        const d = c.entity.target_harvest_date ? new Date(c.entity.target_harvest_date).getTime() : null;
        return d != null && d >= now && d <= in7;
      }).length;
      // Overdue: flowering cycles past target_harvest_date
      const overdue = columns.flowering.filter((c) => {
        const d = c.entity.target_harvest_date ? new Date(c.entity.target_harvest_date).getTime() : null;
        return d != null && d < now;
      }).length;

      setData({
        columns, totals,
        total_plants: totalPlants,
        strains_active: activeStrains.size,
        upcoming_harvests: upcoming,
        overdue_items: overdue,
      });
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}

// ─── Transition helpers ──────────────────────────────────────────────────────

/** Move a vegetative cycle to flowering: flip the cycle's phase, update all
 * active plants' CCRS growth stage, and move the board card. */
export function useMoveCycleToFlowering() {
  const { orgId } = useOrg();
  return useCallback(async (cycleId: string, cardId: string, opts?: { targetHarvestDate?: string | null }) => {
    if (!orgId) throw new Error("No active org");
    const { error: cErr } = await supabase
      .from("grow_cycles")
      .update({
        phase: "flowering",
        target_harvest_date: opts?.targetHarvestDate ?? undefined,
      })
      .eq("id", cycleId);
    if (cErr) throw cErr;

    const { error: pErr } = await supabase
      .from("grow_plants")
      .update({ phase: "flowering", phase_changed_at: new Date().toISOString(), ccrs_growth_stage: "Flowering" })
      .eq("grow_cycle_id", cycleId)
      .not("phase", "in", "(destroyed,harvested)");
    if (pErr) throw pErr;

    const { error: bErr } = await supabase
      .from("grow_board_cards")
      .update({ column_name: "flowering" })
      .eq("id", cardId);
    if (bErr) throw bErr;
  }, [orgId]);
}

/** Harvest a flowering cycle: create a grow_harvests row, flip plants to
 * harvested state, swap the board card from the cycle entity to the harvest
 * entity (still in drying column). */
export function useHarvestCycle() {
  const { orgId } = useOrg();
  return useCallback(async (
    cycleId: string,
    cardId: string,
    opts: { name: string; harvest_date: string; wet_weight_grams?: number | null; notes?: string | null },
  ) => {
    if (!orgId) throw new Error("No active org");
    const { data: cycle, error: cErr } = await supabase
      .from("grow_cycles").select("id, strain_id, area_id").eq("id", cycleId).maybeSingle();
    if (cErr) throw cErr;
    if (!cycle) throw new Error("Cycle not found");

    const { data: harvest, error: hErr } = await supabase
      .from("grow_harvests")
      .insert({
        org_id: orgId,
        name: opts.name,
        strain_id: cycle.strain_id,
        grow_cycle_id: cycle.id,
        area_id: cycle.area_id,
        harvest_type: "standard",
        status: "drying",
        harvest_started_at: new Date(opts.harvest_date).toISOString(),
        wet_weight_grams: opts.wet_weight_grams ?? null,
        notes: opts.notes ?? null,
      })
      .select("id").single();
    if (hErr) throw hErr;

    // Flip plants to harvested state
    await supabase
      .from("grow_plants")
      .update({
        phase: "harvested",
        phase_changed_at: new Date().toISOString(),
        ccrs_plant_state: "Harvested",
        harvest_date: opts.harvest_date,
      })
      .eq("grow_cycle_id", cycleId)
      .not("phase", "in", "(destroyed,harvested)");

    // Mark the cycle as harvesting (not completed — that happens on Finish)
    await supabase.from("grow_cycles").update({ phase: "harvesting", actual_harvest_date: opts.harvest_date }).eq("id", cycleId);

    // Swap the board card to point at the harvest entity, move to drying column
    const { error: bErr } = await supabase
      .from("grow_board_cards")
      .update({ column_name: "drying", entity_type: "harvest", entity_id: harvest!.id })
      .eq("id", cardId);
    if (bErr) throw bErr;

    return { harvest_id: harvest!.id };
  }, [orgId]);
}

/** Finish a harvest: record final weights, create a grow_batches row, flip
 * the harvest to completed, swap the board card to the batch entity. */
export function useFinishHarvest() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (
    harvestId: string,
    cardId: string,
    opts: {
      dry_weight_grams: number;
      waste_weight_grams?: number | null;
      product_id: string;
      area_id?: string | null;
      barcode?: string | null;
      notes?: string | null;
    },
  ) => {
    if (!orgId) throw new Error("No active org");
    const { data: harvest, error: hErr } = await supabase
      .from("grow_harvests").select("id, name, strain_id, grow_cycle_id, area_id").eq("id", harvestId).maybeSingle();
    if (hErr) throw hErr;
    if (!harvest) throw new Error("Harvest not found");

    // Finalize the harvest record
    const { error: uErr } = await supabase
      .from("grow_harvests")
      .update({
        dry_weight_grams: opts.dry_weight_grams,
        waste_weight_grams: opts.waste_weight_grams ?? null,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", harvestId);
    if (uErr) throw uErr;

    // Mark the originating cycle as completed
    if (harvest.grow_cycle_id) {
      await supabase.from("grow_cycles").update({ phase: "completed" }).eq("id", harvest.grow_cycle_id);
    }

    // Create the batch
    const barcode = opts.barcode?.trim() || `B-${Date.now()}`;
    const { data: batch, error: bErr } = await supabase
      .from("grow_batches")
      .insert({
        org_id: orgId,
        external_id: generateExternalId(),
        barcode,
        product_id: opts.product_id,
        strain_id: harvest.strain_id,
        area_id: opts.area_id ?? harvest.area_id,
        harvest_id: harvest.id,
        source_type: "harvest",
        initial_weight_grams: opts.dry_weight_grams,
        current_weight_grams: opts.dry_weight_grams,
        initial_quantity: opts.dry_weight_grams,
        current_quantity: opts.dry_weight_grams,
        is_available: true,
        notes: opts.notes ?? null,
        created_by: user?.id ?? null,
      })
      .select("id").single();
    if (bErr) throw bErr;

    // Move the board card: swap entity_type + entity_id to the new batch,
    // and column_name to inventory.
    const { error: cErr } = await supabase
      .from("grow_board_cards")
      .update({ column_name: "inventory", entity_type: "batch", entity_id: batch!.id })
      .eq("id", cardId);
    if (cErr) throw cErr;

    return { batch_id: batch!.id, barcode };
  }, [orgId, user?.id]);
}

/** Update sort_order within a column when reordering cards. */
export function useUpdateCardSort() {
  return useCallback(async (updates: Array<{ id: string; sort_order: number }>) => {
    await Promise.all(
      updates.map((u) => supabase.from("grow_board_cards").update({ sort_order: u.sort_order }).eq("id", u.id)),
    );
  }, []);
}

/** Cody context summary derived from board data. */
export function useBoardCodyContext(data: BoardData) {
  return useMemo(() => ({
    columns: data.totals,
    total_plants: data.total_plants,
    strains_active: data.strains_active,
    upcoming_harvests: data.upcoming_harvests,
    overdue_items: data.overdue_items,
  }), [data]);
}
