/** Tiny stats helpers shared across AI modules. All client-side, no deps. */

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const sq = arr.map((v) => (v - m) ** 2);
  return Math.sqrt(mean(sq));
}

export function confidenceFromSampleSize(n: number): "low" | "medium" | "high" {
  if (n < 3) return "low";
  if (n < 10) return "medium";
  return "high";
}

/** Simple linear trend: slope from first to last period. +0.05 = increasing 5%/period. */
export function trend(values: number[]): { slope: number; direction: "up" | "down" | "flat" } {
  if (values.length < 2) return { slope: 0, direction: "flat" };
  const first = values[0];
  const last = values[values.length - 1];
  if (first === 0) return { slope: 0, direction: "flat" };
  const slope = (last - first) / first / Math.max(1, values.length - 1);
  return {
    slope,
    direction: slope > 0.03 ? "up" : slope < -0.03 ? "down" : "flat",
  };
}

export function daysBetween(a: Date | string, b: Date | string): number {
  const d1 = typeof a === "string" ? new Date(a) : a;
  const d2 = typeof b === "string" ? new Date(b) : b;
  return Math.floor((d2.getTime() - d1.getTime()) / 86400000);
}
