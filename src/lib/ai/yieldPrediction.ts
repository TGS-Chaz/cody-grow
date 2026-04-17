/**
 * Yield prediction — compares the current cycle against this org's historical
 * cycles of the same strain, then adjusts for current environmental conditions
 * vs the best-performing cycle's conditions.
 */

import { supabase } from "@/lib/supabase";
import { mean, stdDev, confidenceFromSampleSize } from "./stats";

export interface YieldPrediction {
  predicted_yield_grams: number;
  predicted_grams_per_sqft: number | null;
  confidence: "low" | "medium" | "high";
  range: { min: number; max: number };
  factors: string[];
  comparison_to_best: string | null;
  sample_size: number;
}

export async function predictYield(cycleId: string): Promise<YieldPrediction | null> {
  const { data: cycle } = await supabase.from("grow_cycles")
    .select("id, org_id, strain_id, area_id, plant_count, start_date, phase")
    .eq("id", cycleId).maybeSingle();
  if (!cycle) return null;

  // Completed cycles of the same strain in this org
  const { data: historical } = await supabase.from("grow_cycles")
    .select("id, area_id, plant_count, start_date, actual_harvest_date")
    .eq("org_id", cycle.org_id).eq("strain_id", cycle.strain_id)
    .eq("phase", "completed").not("actual_harvest_date", "is", null);

  const completedIds = ((historical ?? []) as any[]).map((h) => h.id);
  const { data: harvests } = completedIds.length > 0
    ? await supabase.from("grow_harvests").select("grow_cycle_id, dry_weight_grams, area_id")
      .in("grow_cycle_id", completedIds).eq("status", "completed")
    : { data: [] };

  const yields = ((harvests ?? []) as any[])
    .map((h) => Number(h.dry_weight_grams ?? 0))
    .filter((v) => v > 0);

  const factors: string[] = [];
  let comparisonToBest: string | null = null;

  if (yields.length === 0) {
    return {
      predicted_yield_grams: 0,
      predicted_grams_per_sqft: null,
      confidence: "low",
      range: { min: 0, max: 0 },
      factors: ["No completed harvests of this strain yet — prediction unavailable until your first harvest."],
      comparison_to_best: null,
      sample_size: 0,
    };
  }

  const avgYield = mean(yields);
  const sigma = stdDev(yields);
  const confidence = confidenceFromSampleSize(yields.length);

  // Per-plant baseline
  const historicalPlantCounts = ((historical ?? []) as any[]).map((h) => Number(h.plant_count ?? 0)).filter((n) => n > 0);
  const avgPlantCount = mean(historicalPlantCounts) || Number(cycle.plant_count ?? 0) || 1;
  const perPlant = avgYield / avgPlantCount;
  const currentPlantCount = Number(cycle.plant_count ?? 0) || avgPlantCount;
  let predicted = perPlant * currentPlantCount;

  // Area sqft for per-sqft
  const { data: area } = cycle.area_id
    ? await supabase.from("grow_areas").select("square_feet, canopy_sqft").eq("id", cycle.area_id).maybeSingle()
    : { data: null };
  const sqft = Number((area as any)?.canopy_sqft ?? (area as any)?.square_feet ?? 0);
  const perSqft = sqft > 0 ? predicted / sqft : null;

  factors.push(`Based on ${yields.length} completed harvest${yields.length === 1 ? "" : "s"} of this strain`);
  factors.push(`Historical average: ${avgYield.toFixed(0)}g per cycle · ${perPlant.toFixed(1)}g per plant`);

  // Environmental adjustment: compare current area conditions to best cycle's conditions
  const bestIdx = yields.indexOf(Math.max(...yields));
  const bestHarvest = ((harvests ?? []) as any[])[bestIdx];
  if (bestHarvest && cycle.area_id) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const { data: currentReadings } = await supabase.from("grow_environmental_readings")
      .select("temperature_f, humidity_pct, vpd").eq("area_id", cycle.area_id)
      .gte("recorded_at", sevenDaysAgo);
    if ((currentReadings?.length ?? 0) > 10) {
      const curTemp = mean((currentReadings ?? []).map((r: any) => Number(r.temperature_f ?? 0)).filter((v) => v > 0));
      const curHum = mean((currentReadings ?? []).map((r: any) => Number(r.humidity_pct ?? 0)).filter((v) => v > 0));
      const curVpd = mean((currentReadings ?? []).map((r: any) => Number(r.vpd ?? 0)).filter((v) => v > 0));
      const tempOpt = curTemp >= 72 && curTemp <= 80;
      const humOpt = curHum >= 45 && curHum <= 60;
      const vpdOpt = curVpd >= 0.8 && curVpd <= 1.5;
      if (tempOpt && humOpt && vpdOpt) {
        predicted *= 1.05;
        factors.push("Current environmental conditions are within optimal range (+5%)");
      } else {
        const issues: string[] = [];
        if (!tempOpt) issues.push(`temp ${curTemp.toFixed(1)}°F`);
        if (!humOpt) issues.push(`humidity ${curHum.toFixed(0)}%`);
        if (!vpdOpt) issues.push(`VPD ${curVpd.toFixed(2)}kPa`);
        predicted *= 0.92;
        factors.push(`Current environment outside optimal range (${issues.join(", ")}) — adjusted -8%`);
      }
      comparisonToBest = `Best cycle yielded ${Math.max(...yields).toFixed(0)}g. Current conditions ${tempOpt && humOpt && vpdOpt ? "match" : "differ from"} those conditions.`;
    }
  }

  const marginFactor = confidence === "low" ? 0.4 : confidence === "medium" ? 0.25 : 0.15;
  const margin = Math.max(sigma, predicted * marginFactor);

  return {
    predicted_yield_grams: Math.round(predicted),
    predicted_grams_per_sqft: perSqft != null ? Math.round(perSqft * 100) / 100 : null,
    confidence,
    range: { min: Math.max(0, Math.round(predicted - margin)), max: Math.round(predicted + margin) },
    factors,
    comparison_to_best: comparisonToBest,
    sample_size: yields.length,
  };
}
