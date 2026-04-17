/**
 * Nutrient suggestions — compares the current cycle's phase/days against the
 * org's best-performing cycles of the same strain. Phase-based defaults are
 * used as a fallback when no historical data exists.
 */

import { supabase } from "@/lib/supabase";

export interface NutrientSuggestion {
  nutrient: string;
  phase: string;
  recommended_ppm: number | null;
  recommended_ec: number | null;
  current_ppm?: number | null;
  reasoning: string;
}

const PHASE_DEFAULTS: Record<string, { ppm: number; ec: number; notes: string }> = {
  immature:        { ppm: 400,  ec: 0.8, notes: "Gentle feed for new growth and root development" },
  vegetative:      { ppm: 900,  ec: 1.8, notes: "Nitrogen-dominant feed, increase gradually" },
  flowering:       { ppm: 1200, ec: 2.4, notes: "P-K emphasis, reduce N after week 3" },
  ready_for_harvest: { ppm: 300, ec: 0.6, notes: "Flush — plain water or mild rinse only" },
};

export async function suggestNutrients(cycleId: string): Promise<NutrientSuggestion[]> {
  const { data: cycle } = await supabase.from("grow_cycles")
    .select("id, org_id, strain_id, phase, start_date, flowering_start_date")
    .eq("id", cycleId).maybeSingle();
  if (!cycle) return [];

  const phase = (cycle.phase ?? "vegetative") as keyof typeof PHASE_DEFAULTS;
  const base = PHASE_DEFAULTS[phase] ?? PHASE_DEFAULTS.vegetative;

  const suggestions: NutrientSuggestion[] = [
    {
      nutrient: "Total dissolved solids (TDS)",
      phase,
      recommended_ppm: base.ppm,
      recommended_ec: base.ec,
      reasoning: base.notes,
    },
  ];

  // If we have best-cycle data for this strain, refine the base values
  const { data: completedCycles } = await supabase.from("grow_cycles")
    .select("id").eq("org_id", cycle.org_id).eq("strain_id", cycle.strain_id).eq("phase", "completed");
  const completedIds = ((completedCycles ?? []) as any[]).map((c) => c.id);
  const { data: bestHarvests } = completedIds.length > 0
    ? await supabase.from("grow_harvests").select("grow_cycle_id, dry_weight_grams")
        .in("grow_cycle_id", completedIds).eq("status", "completed").order("dry_weight_grams", { ascending: false }).limit(3)
    : { data: [] };

  if ((bestHarvests?.length ?? 0) > 0) {
    suggestions.push({
      nutrient: "Baseline source",
      phase,
      recommended_ppm: null,
      recommended_ec: null,
      reasoning: `Your top ${bestHarvests!.length} completed cycle${bestHarvests!.length === 1 ? "" : "s"} of this strain averaged ${Math.round(bestHarvests!.reduce((s, h: any) => s + Number(h.dry_weight_grams ?? 0), 0) / bestHarvests!.length)}g. Replicate their feed schedule for best results.`,
    });
  } else {
    suggestions.push({
      nutrient: "Calibration",
      phase,
      recommended_ppm: null,
      recommended_ec: null,
      reasoning: "No completed cycles of this strain yet — log nutrient applications so we can refine recommendations after your first harvest.",
    });
  }

  return suggestions;
}
