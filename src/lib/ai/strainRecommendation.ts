/**
 * Strain recommendation — ranks strains by their performance in this org's
 * facility conditions. "Avoid" list surfaces strains with historically poor
 * or highly variable yields.
 */

import { supabase } from "@/lib/supabase";
import { mean, stdDev } from "./stats";

export interface StrainRec {
  strain_id: string;
  strain_name: string;
  score: number;
  avg_yield_g: number;
  cycle_count: number;
  reason: string;
}

export interface StrainRecommendations {
  recommended: StrainRec[];
  avoid: StrainRec[];
  notes: string[];
}

export async function recommendStrains(orgId: string): Promise<StrainRecommendations> {
  // All strains this org has grown
  const { data: strains } = await supabase.from("grow_strains")
    .select("id, name").eq("org_id", orgId);

  // All completed cycles
  const { data: cycles } = await supabase.from("grow_cycles")
    .select("id, strain_id, plant_count").eq("org_id", orgId).eq("phase", "completed");
  const cycleIds = ((cycles ?? []) as any[]).map((c) => c.id);
  const { data: harvests } = cycleIds.length > 0
    ? await supabase.from("grow_harvests").select("grow_cycle_id, dry_weight_grams")
        .in("grow_cycle_id", cycleIds).eq("status", "completed")
    : { data: [] };

  const yieldsByStrain = new Map<string, number[]>();
  const cycleToStrain = new Map<string, string>();
  ((cycles ?? []) as any[]).forEach((c) => { if (c.strain_id) cycleToStrain.set(c.id, c.strain_id); });
  ((harvests ?? []) as any[]).forEach((h) => {
    const strainId = cycleToStrain.get(h.grow_cycle_id);
    if (!strainId) return;
    const arr = yieldsByStrain.get(strainId) ?? [];
    if (h.dry_weight_grams > 0) arr.push(Number(h.dry_weight_grams));
    yieldsByStrain.set(strainId, arr);
  });

  const all: StrainRec[] = [];
  for (const s of (strains ?? []) as any[]) {
    const yields = yieldsByStrain.get(s.id) ?? [];
    if (yields.length === 0) continue;
    const avg = mean(yields);
    const cv = yields.length > 1 ? (stdDev(yields) / avg) : 0; // coefficient of variation
    // Score: reward high yield, penalize variability
    const score = avg * (1 - Math.min(cv, 0.5));
    const reason = yields.length >= 3
      ? `Avg ${avg.toFixed(0)}g over ${yields.length} cycles · ${cv < 0.15 ? "consistent" : cv < 0.3 ? "moderately consistent" : "variable"}`
      : `Only ${yields.length} cycle${yields.length === 1 ? "" : "s"} so far (${avg.toFixed(0)}g avg)`;
    all.push({ strain_id: s.id, strain_name: s.name, score, avg_yield_g: avg, cycle_count: yields.length, reason });
  }

  all.sort((a, b) => b.score - a.score);
  const recommended = all.slice(0, 5);
  const avoid = all.slice(-3).reverse().filter((s) => s.cycle_count >= 2 && s.avg_yield_g < (mean(all.map((a) => a.avg_yield_g)) * 0.6));

  return {
    recommended,
    avoid,
    notes: all.length === 0
      ? ["Not enough harvest history yet — recommendations will appear after 1-2 completed cycles."]
      : [`Analyzing ${all.length} strain${all.length === 1 ? "" : "s"} with yield data across your facility.`],
  };
}
