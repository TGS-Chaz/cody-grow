/**
 * Route optimization — simple ZIP-code-proximity sort.
 *
 * Future upgrade path: swap this for a Google Maps Directions API call once
 * credentials are provisioned.
 */

export interface DeliveryStop<T = any> {
  id: string;
  zip: string | null;
  label: string;
  /** Original data attached for the caller to use after ordering. */
  data?: T;
}

/**
 * Sort stops in a naive "travelling-clerk" order: start at the stop with the
 * lowest ZIP (typically the western/southern edge of the delivery area), then
 * greedily choose the nearest-ZIP next stop.
 *
 * This is O(n²) but fine for typical manifest sizes (<50 stops).
 */
export function optimizeByZip<T>(stops: DeliveryStop<T>[]): DeliveryStop<T>[] {
  const withZip = stops.filter((s) => s.zip);
  const withoutZip = stops.filter((s) => !s.zip);
  if (withZip.length === 0) return stops;

  // Start at the stop with the lowest zip
  const sorted = [...withZip].sort((a, b) => Number(a.zip ?? 0) - Number(b.zip ?? 0));
  const ordered: DeliveryStop<T>[] = [sorted[0]];
  const remaining = new Set(sorted.slice(1));

  while (remaining.size > 0) {
    const last = ordered[ordered.length - 1];
    const lastZip = Number(last.zip ?? 0);
    let best: DeliveryStop<T> | null = null;
    let bestDiff = Infinity;
    for (const candidate of remaining) {
      const diff = Math.abs(Number(candidate.zip ?? 0) - lastZip);
      if (diff < bestDiff) { bestDiff = diff; best = candidate; }
    }
    if (best) { ordered.push(best); remaining.delete(best); }
    else break;
  }

  return [...ordered, ...withoutZip];
}
