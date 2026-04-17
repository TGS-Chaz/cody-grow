/**
 * Environmental anomaly detection — flags sustained out-of-range readings (not
 * momentary spikes) using rolling averages and standard deviations.
 */

import { supabase } from "@/lib/supabase";
import { mean, stdDev } from "./stats";

export type EnvMetric = "temperature_f" | "humidity_pct" | "vpd" | "co2_ppm";

export interface EnvAnomaly {
  metric: EnvMetric;
  severity: "info" | "warning" | "critical";
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  avg_value: number;
  expected_range: { min: number; max: number };
  potential_impact: string;
}

const STRAIN_OPTIMAL = {
  vegetative: { temp: [70, 80], humidity: [50, 70], vpd: [0.8, 1.2], co2: [800, 1200] },
  flowering:  { temp: [68, 78], humidity: [40, 55], vpd: [1.0, 1.5], co2: [1000, 1500] },
  default:    { temp: [68, 82], humidity: [40, 65], vpd: [0.8, 1.5], co2: [800, 1500] },
} as const;

const METRIC_LABEL: Record<EnvMetric, string> = {
  temperature_f: "Temperature", humidity_pct: "Humidity", vpd: "VPD", co2_ppm: "CO2",
};

const METRIC_IMPACT: Record<EnvMetric, { low: string; high: string }> = {
  temperature_f: { low: "Slowed growth and reduced terpene expression", high: "Heat stress, reduced potency, increased transpiration" },
  humidity_pct:  { low: "Plant dehydration and over-transpiration", high: "Bud rot and powdery mildew risk" },
  vpd:           { low: "Slow water uptake and nutrient transport", high: "Over-transpiration and plant stress" },
  co2_ppm:       { low: "Reduced photosynthesis and growth rate", high: "Diminishing returns; wasted gas cost" },
};

export async function detectAnomalies(
  areaId: string,
  timeRangeHours: number = 24,
  cyclePhase: "vegetative" | "flowering" | null = null,
): Promise<EnvAnomaly[]> {
  const since = new Date(Date.now() - timeRangeHours * 3600000).toISOString();
  const { data: readings } = await supabase.from("grow_environmental_readings")
    .select("*").eq("area_id", areaId).gte("recorded_at", since)
    .order("recorded_at", { ascending: true });
  const rows = (readings ?? []) as any[];
  if (rows.length < 10) return [];

  const optimal = cyclePhase === "vegetative" ? STRAIN_OPTIMAL.vegetative
    : cyclePhase === "flowering" ? STRAIN_OPTIMAL.flowering
    : STRAIN_OPTIMAL.default;

  const METRIC_RANGE: Record<EnvMetric, readonly [number, number]> = {
    temperature_f: optimal.temp, humidity_pct: optimal.humidity, vpd: optimal.vpd, co2_ppm: optimal.co2,
  };

  const anomalies: EnvAnomaly[] = [];

  for (const metric of ["temperature_f", "humidity_pct", "vpd", "co2_ppm"] as EnvMetric[]) {
    const values = rows.map((r) => r[metric]).filter((v) => v != null).map(Number);
    if (values.length < 10) continue;
    const m = mean(values);
    const sd = stdDev(values);
    const [minRange, maxRange] = METRIC_RANGE[metric];

    // Detect sustained out-of-range windows (≥30 min = ~2 readings at typical cadence of 15min)
    let runStart: Date | null = null;
    let runValues: number[] = [];
    let runDirection: "low" | "high" | null = null;

    const finalizeRun = (endedAt: Date | null) => {
      if (!runStart || runValues.length < 2) { runStart = null; runValues = []; runDirection = null; return; }
      const avg = mean(runValues);
      const duration = endedAt
        ? Math.floor((endedAt.getTime() - runStart.getTime()) / 60000)
        : Math.floor((new Date().getTime() - runStart.getTime()) / 60000);
      if (duration < 30) { runStart = null; runValues = []; runDirection = null; return; }
      // Flag if >2 SD from rolling mean OR outside optimal range
      const stdDeviation = Math.abs(avg - m) / (sd || 1);
      const severity: "info" | "warning" | "critical" = stdDeviation > 3 ? "critical"
        : stdDeviation > 2 ? "warning"
        : "info";
      anomalies.push({
        metric,
        severity,
        started_at: runStart.toISOString(),
        ended_at: endedAt?.toISOString() ?? null,
        duration_minutes: duration,
        avg_value: Math.round(avg * 100) / 100,
        expected_range: { min: minRange, max: maxRange },
        potential_impact: `${METRIC_LABEL[metric]} ${runDirection === "low" ? "below" : "above"} optimal — ${runDirection === "low" ? METRIC_IMPACT[metric].low : METRIC_IMPACT[metric].high}`,
      });
      runStart = null; runValues = []; runDirection = null;
    };

    for (const r of rows) {
      const v = Number(r[metric] ?? 0);
      const recordedAt = new Date(r.recorded_at);
      const outOfRange = v < minRange || v > maxRange;
      const direction: "low" | "high" | null = outOfRange ? (v < minRange ? "low" : "high") : null;
      if (outOfRange) {
        if (!runStart) { runStart = recordedAt; runValues = [v]; runDirection = direction; }
        else if (direction === runDirection) { runValues.push(v); }
        else { finalizeRun(recordedAt); runStart = recordedAt; runValues = [v]; runDirection = direction; }
      } else if (runStart) {
        finalizeRun(recordedAt);
      }
    }
    finalizeRun(null);
  }

  return anomalies.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
}
