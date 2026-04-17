import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, TrendingUp, TrendingDown, Minus, Loader2, ArrowRight } from "lucide-react";
import { useOrg } from "@/lib/org";
import { forecastDemand, SalesForecast } from "@/lib/ai/salesForecast";
import { cn } from "@/lib/utils";

export default function DemandForecastCard({ daysAhead = 30 }: { daysAhead?: number }) {
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [forecast, setForecast] = useState<SalesForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    forecastDemand(orgId, daysAhead).then((f) => { if (!cancelled) { setForecast(f); setLoading(false); } });
    return () => { cancelled = true; };
  }, [orgId, daysAhead]);

  if (loading) {
    return <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /><span className="text-[11px] text-muted-foreground">Building demand forecast…</span></div>;
  }
  if (!forecast || forecast.forecasts.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Demand Forecast</h3>
        </div>
        <p className="text-[12px] text-muted-foreground italic">Not enough order history yet — forecast appears after a few completed orders.</p>
      </div>
    );
  }

  const lowCoverage = forecast.forecasts.filter((f) => f.coverage_pct < 80 && f.projected_demand_grams > 0).slice(0, 3);
  const topThree = forecast.forecasts.slice(0, 3);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-[13px] font-semibold">Demand Forecast · {forecast.days_ahead}d</h3>
        </div>
        <div className="text-[10px] text-muted-foreground">Projected revenue: <span className="font-mono font-semibold text-foreground">${forecast.total_projected_revenue.toLocaleString()}</span></div>
      </div>

      {lowCoverage.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-amber-500">Inventory gaps</div>
          {lowCoverage.map((f) => (
            <div key={f.product_id} className="flex items-center justify-between text-[12px]">
              <span className="truncate flex-1">{f.product_name}</span>
              <span className="font-mono text-[11px] text-amber-500 ml-2">{f.coverage_pct}% covered · need {(-f.surplus_or_deficit).toFixed(0)}g more</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[12px] text-emerald-500">All projected demand covered by current inventory.</div>
      )}

      <div className="space-y-1 pt-2 border-t border-border/50">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Top products</div>
        {topThree.map((f) => {
          const TrendIcon = f.trend === "up" ? TrendingUp : f.trend === "down" ? TrendingDown : Minus;
          return (
            <div key={f.product_id} className="flex items-center justify-between text-[11px] gap-2">
              <span className="truncate flex-1">{f.product_name}</span>
              <span className="font-mono text-muted-foreground">{f.projected_demand_grams}g</span>
              <TrendIcon className={cn("w-3 h-3 shrink-0", f.trend === "up" ? "text-emerald-500" : f.trend === "down" ? "text-destructive" : "text-muted-foreground")} />
            </div>
          );
        })}
      </div>

      <button onClick={() => navigate("/inventory/batches")} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
        View inventory <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
