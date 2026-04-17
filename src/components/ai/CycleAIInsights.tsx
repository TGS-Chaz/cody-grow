import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, CalendarClock, Beaker, Loader2 } from "lucide-react";
import { predictYield, YieldPrediction } from "@/lib/ai/yieldPrediction";
import { recommendHarvestTiming, HarvestTimingRecommendation } from "@/lib/ai/harvestTiming";
import { suggestNutrients, NutrientSuggestion } from "@/lib/ai/nutrientOptimization";
import DateTime from "@/components/shared/DateTime";
import { cn } from "@/lib/utils";

export default function CycleAIInsights({ cycleId, phase }: { cycleId: string; phase: string | null }) {
  const [yieldPred, setYieldPred] = useState<YieldPrediction | null>(null);
  const [harvestRec, setHarvestRec] = useState<HarvestTimingRecommendation | null>(null);
  const [nutrients, setNutrients] = useState<NutrientSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cycleId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const isFlowering = phase === "flowering" || phase === "ready_for_harvest";
      const [y, h, n] = await Promise.all([
        predictYield(cycleId),
        isFlowering ? recommendHarvestTiming(cycleId) : Promise.resolve(null),
        suggestNutrients(cycleId),
      ]);
      if (cancelled) return;
      setYieldPred(y); setHarvestRec(h); setNutrients(n);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [cycleId, phase]);

  if (loading) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-[12px] text-muted-foreground">Analyzing cycle data…</span>
      </div>
    );
  }

  const confidenceBadge = (c: "low" | "medium" | "high") => (
    <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wider",
      c === "high" ? "bg-emerald-500/15 text-emerald-500" :
      c === "medium" ? "bg-amber-500/15 text-amber-500" :
      "bg-muted text-muted-foreground",
    )}>{c} confidence</span>
  );

  return (
    <div className="space-y-4">
      {/* Yield forecast */}
      {yieldPred && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-[13px] font-semibold">Cody's Yield Forecast</h3>
            </div>
            {confidenceBadge(yieldPred.confidence)}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Predicted</div>
              <div className="text-[24px] font-bold font-mono tabular-nums">{yieldPred.predicted_yield_grams}<span className="text-[11px] text-muted-foreground ml-1">g</span></div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Range</div>
              <div className="text-[13px] font-semibold font-mono">{yieldPred.range.min}–{yieldPred.range.max}g</div>
            </div>
            {yieldPred.predicted_grams_per_sqft != null && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Per sqft</div>
                <div className="text-[13px] font-semibold font-mono">{yieldPred.predicted_grams_per_sqft}g</div>
              </div>
            )}
          </div>
          <ul className="text-[11px] space-y-1 pl-4 list-disc">
            {yieldPred.factors.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
          {yieldPred.comparison_to_best && <p className="text-[11px] text-muted-foreground mt-2 italic">{yieldPred.comparison_to_best}</p>}
        </div>
      )}

      {/* Harvest timing */}
      {harvestRec && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-500" />
              <h3 className="text-[13px] font-semibold">Cody's Harvest Timing</h3>
            </div>
            {confidenceBadge(harvestRec.confidence)}
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Earliest</div>
              <DateTime value={harvestRec.recommended_harvest_window.earliest} format="date-only" className="text-[13px] font-semibold font-mono" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Optimal</div>
              <DateTime value={harvestRec.recommended_harvest_window.optimal} format="date-only" className="text-[13px] font-semibold font-mono text-amber-500" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Latest</div>
              <DateTime value={harvestRec.recommended_harvest_window.latest} format="date-only" className="text-[13px] font-semibold font-mono" />
            </div>
          </div>
          <div className="text-[12px] mb-2">~<span className="font-semibold">{harvestRec.days_remaining} days</span> to optimal harvest</div>
          <ul className="text-[11px] space-y-1 pl-4 list-disc">
            {harvestRec.reasoning.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {/* Nutrient suggestions */}
      {nutrients.length > 0 && (
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Beaker className="w-4 h-4 text-teal-500" />
            <h3 className="text-[13px] font-semibold">Nutrient Suggestions</h3>
          </div>
          <ul className="space-y-2">
            {nutrients.map((n, i) => (
              <li key={i} className="border-l-2 border-teal-500/40 pl-3 text-[12px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{n.nutrient}</span>
                  {n.recommended_ppm != null && <span className="font-mono text-muted-foreground">{n.recommended_ppm} ppm</span>}
                  {n.recommended_ec != null && <span className="font-mono text-muted-foreground">· EC {n.recommended_ec}</span>}
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">· {n.phase}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{n.reasoning}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <span className="hidden"><TrendingUp /></span>
    </div>
  );
}
