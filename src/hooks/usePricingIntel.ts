import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useProductAccess } from "@/hooks/useProductAccess";

export interface PricingIntel {
  /** Average market price in USD per unit-of-measure for the category */
  avgPrice: number;
  priceRange: { min: number; max: number };
  /** Caller-supplied own price so we can surface percentile */
  yourPrice: number | null;
  /** 0-100 — where your price sits vs. the sampled distribution */
  percentile: number | null;
  /** "up" | "down" | "flat" — 30-day trend */
  trend: "up" | "down" | "flat";
  sampleSize: number;
  /** When false, Cody Intel is not subscribed; values are synthesized from
   * the org's own data + national averages. Use to render a promo card. */
  connected: boolean;
  loading: boolean;
}

// Category-level fallback baselines ($ per g for flower-like categories,
// $ per unit for packaged goods). Used when Intel is not connected.
const CATEGORY_BASELINES: Record<string, { avg: number; min: number; max: number }> = {
  "Flower Lot": { avg: 3.45, min: 1.80, max: 6.00 },
  "Flower": { avg: 4.20, min: 2.50, max: 8.00 },
  "Concentrate": { avg: 18.00, min: 8.00, max: 35.00 },
  "Concentrate for Inhalation": { avg: 20.00, min: 10.00, max: 40.00 },
  "Infused Edible": { avg: 15.00, min: 8.00, max: 28.00 },
  "Liquid Edible": { avg: 12.00, min: 6.00, max: 22.00 },
  "Pre-Roll": { avg: 5.50, min: 3.00, max: 12.00 },
  "Topical": { avg: 25.00, min: 12.00, max: 55.00 },
  "Tincture": { avg: 22.00, min: 10.00, max: 48.00 },
  "Capsule": { avg: 24.00, min: 10.00, max: 45.00 },
  "Sample": { avg: 0, min: 0, max: 0 },
};

function computePercentile(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  const clamped = Math.max(min, Math.min(max, value));
  return Math.round(((clamped - min) / (max - min)) * 100);
}

/**
 * Returns market-price intelligence for a product category + optional strain.
 * When Cody Intel is connected, we query the shared `intel_market_prices` view
 * (produced by the Intel ingestion pipeline). When not, we fall back to
 * category baselines and flag connected=false so the UI can show a promo.
 */
export function useMarketPrice(
  productCategory: string | null | undefined,
  strainName: string | null | undefined,
  yourPrice: number | null = null,
): PricingIntel {
  const { user } = useAuth();
  const intel = useProductAccess("intel");
  const [state, setState] = useState<PricingIntel>({
    avgPrice: 0, priceRange: { min: 0, max: 0 }, yourPrice, percentile: null,
    trend: "flat", sampleSize: 0, connected: false, loading: true,
  });

  useEffect(() => {
    if (intel.loading) return;
    if (!user || !productCategory) {
      setState({ avgPrice: 0, priceRange: { min: 0, max: 0 }, yourPrice, percentile: null, trend: "flat", sampleSize: 0, connected: intel.hasAccess, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      if (intel.hasAccess) {
        // Query shared pricing view produced by the Intel pipeline
        try {
          const { data } = await supabase
            .from("intel_market_prices" as any)
            .select("avg_price, min_price, max_price, sample_size, trend_30d")
            .eq("category", productCategory)
            .eq("strain_name", strainName ?? "")
            .maybeSingle();
          if (cancelled) return;
          if (data) {
            const d = data as any;
            const pct = yourPrice != null ? computePercentile(yourPrice, d.min_price, d.max_price) : null;
            setState({
              avgPrice: Number(d.avg_price ?? 0),
              priceRange: { min: Number(d.min_price ?? 0), max: Number(d.max_price ?? 0) },
              yourPrice,
              percentile: pct,
              trend: d.trend_30d ?? "flat",
              sampleSize: Number(d.sample_size ?? 0),
              connected: true,
              loading: false,
            });
            return;
          }
          // fall through to baseline
        } catch { /* fall through */ }
      }
      // Fallback — baseline averages, zero sample size, flag not connected
      const baseline = CATEGORY_BASELINES[productCategory] ?? { avg: 0, min: 0, max: 0 };
      const pct = yourPrice != null && baseline.max > 0 ? computePercentile(yourPrice, baseline.min, baseline.max) : null;
      setState({
        avgPrice: baseline.avg,
        priceRange: { min: baseline.min, max: baseline.max },
        yourPrice,
        percentile: pct,
        trend: "flat",
        sampleSize: 0,
        connected: intel.hasAccess,
        loading: false,
      });
    })();
    return () => { cancelled = true; };
  }, [user?.id, intel.hasAccess, intel.loading, productCategory, strainName, yourPrice]);

  return state;
}
