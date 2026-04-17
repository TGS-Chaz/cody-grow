/**
 * Harvest timing recommendation — uses actual historical flowering duration
 * from this org's completed cycles, adjusted by current environmental trends.
 */

import { supabase } from "@/lib/supabase";
import { mean, confidenceFromSampleSize, daysBetween } from "./stats";

export interface HarvestTimingRecommendation {
  recommended_harvest_window: { earliest: string; optimal: string; latest: string };
  days_remaining: number;
  confidence: "low" | "medium" | "high";
  reasoning: string[];
  sample_size: number;
}

export async function recommendHarvestTiming(cycleId: string): Promise<HarvestTimingRecommendation | null> {
  const { data: cycle } = await supabase.from("grow_cycles")
    .select("id, org_id, strain_id, area_id, phase, flowering_start_date, start_date")
    .eq("id", cycleId).maybeSingle();
  if (!cycle) return null;

  // Historical completed cycles of this strain
  const { data: completed } = await supabase.from("grow_cycles")
    .select("id, flowering_start_date, actual_harvest_date, start_date")
    .eq("org_id", cycle.org_id).eq("strain_id", cycle.strain_id)
    .eq("phase", "completed").not("actual_harvest_date", "is", null);

  const flowerDays = ((completed ?? []) as any[])
    .map((c) => {
      const start = c.flowering_start_date ?? c.start_date;
      if (!start || !c.actual_harvest_date) return 0;
      return daysBetween(start, c.actual_harvest_date);
    })
    .filter((d) => d > 0);

  // Fall back to strain default if no history
  let avgDays: number;
  let fallback = false;
  if (flowerDays.length > 0) {
    avgDays = mean(flowerDays);
  } else {
    const { data: strain } = await supabase.from("grow_strains").select("average_flower_days").eq("id", cycle.strain_id).maybeSingle();
    avgDays = Number((strain as any)?.average_flower_days ?? 63);
    fallback = true;
  }

  const confidence = fallback ? "low" : confidenceFromSampleSize(flowerDays.length);

  const flowerStart = cycle.flowering_start_date ?? cycle.start_date;
  const daysInFlower = flowerStart ? daysBetween(flowerStart, new Date()) : 0;
  let daysRemaining = Math.max(0, avgDays - daysInFlower);

  const reasoning: string[] = [];
  reasoning.push(fallback
    ? `No completed cycles of this strain yet — using strain default of ${avgDays.toFixed(0)}-day flower window.`
    : `Based on ${flowerDays.length} completed cycle${flowerDays.length === 1 ? "" : "s"} — average flowering duration ${avgDays.toFixed(0)} days.`);

  // Adjust based on environmental trends over the last 7 days
  if (cycle.area_id) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: readings } = await supabase.from("grow_environmental_readings")
      .select("temperature_f, vpd").eq("area_id", cycle.area_id)
      .gte("recorded_at", sevenDaysAgo);
    if ((readings?.length ?? 0) > 10) {
      const temps = (readings ?? []).map((r: any) => Number(r.temperature_f ?? 0)).filter((v) => v > 0);
      const vpds = (readings ?? []).map((r: any) => Number(r.vpd ?? 0)).filter((v) => v > 0);
      const avgTemp = mean(temps);
      const avgVpd = mean(vpds);
      if (avgVpd > 1.5) {
        daysRemaining = Math.max(0, Math.floor(daysRemaining * 0.92));
        reasoning.push(`High VPD (${avgVpd.toFixed(2)}kPa) — plants may finish ~8% faster.`);
      } else if (avgVpd < 0.8 && avgVpd > 0) {
        daysRemaining = Math.floor(daysRemaining * 1.07);
        reasoning.push(`Low VPD (${avgVpd.toFixed(2)}kPa) — plants may need ~7% longer to finish.`);
      }
      if (avgTemp < 68 && avgTemp > 0) {
        daysRemaining = Math.floor(daysRemaining * 1.05);
        reasoning.push(`Low temps (${avgTemp.toFixed(0)}°F) — add ~5% to finish window.`);
      }
    }
  }

  const optimal = new Date(Date.now() + daysRemaining * 86400000);
  const earliest = new Date(Date.now() + Math.max(0, daysRemaining - 5) * 86400000);
  const latest = new Date(Date.now() + (daysRemaining + 5) * 86400000);

  return {
    recommended_harvest_window: {
      earliest: earliest.toISOString(),
      optimal: optimal.toISOString(),
      latest: latest.toISOString(),
    },
    days_remaining: daysRemaining,
    confidence,
    reasoning,
    sample_size: flowerDays.length,
  };
}
