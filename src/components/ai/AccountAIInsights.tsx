import { useEffect, useState } from "react";
import { Sparkles, Clock, TrendingDown, TrendingUp, Activity, Loader2 } from "lucide-react";
import { generateAccountInsights, AccountInsights } from "@/lib/ai/accountInsights";
import { cn } from "@/lib/utils";

export default function AccountAIInsights({ accountId }: { accountId: string }) {
  const [insights, setInsights] = useState<AccountInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    setLoading(true);
    generateAccountInsights(accountId).then((r) => { if (!cancelled) { setInsights(r); setLoading(false); } });
    return () => { cancelled = true; };
  }, [accountId]);

  if (loading) return <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /><span className="text-[11px] text-muted-foreground">Analyzing account…</span></div>;
  if (!insights) return null;

  const riskStyle = insights.risk === "at_risk" ? "border-destructive/30 bg-destructive/5 text-destructive"
    : insights.risk === "declining" ? "border-amber-500/30 bg-amber-500/5 text-amber-500"
    : "border-emerald-500/30 bg-emerald-500/5 text-emerald-500";
  const RiskIcon = insights.risk === "at_risk" ? TrendingDown : insights.risk === "declining" ? TrendingDown : TrendingUp;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-[13px] font-semibold">Cody Account Intelligence</h3>
      </div>

      {/* Reorder prediction */}
      {insights.reorder_prediction.days_until_likely_order != null && (
        <div className="rounded-lg border border-border bg-background/60 p-3 flex items-center gap-3">
          <Clock className="w-4 h-4 text-amber-500" />
          <div className="flex-1">
            <div className="text-[12px] font-semibold">
              {insights.reorder_prediction.days_until_likely_order === 0
                ? "Due to reorder any day now"
                : `Likely to reorder in ~${insights.reorder_prediction.days_until_likely_order} day${insights.reorder_prediction.days_until_likely_order === 1 ? "" : "s"}`}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{insights.reorder_prediction.confidence} confidence</div>
          </div>
        </div>
      )}

      {/* Risk */}
      <div className={cn("rounded-lg border p-3 flex items-start gap-2", riskStyle)}>
        <RiskIcon className="w-4 h-4 mt-0.5" />
        <div className="flex-1">
          <div className="text-[12px] font-semibold capitalize">{insights.risk.replace(/_/g, " ")}</div>
          <div className="text-[11px] mt-0.5 text-foreground/80">{insights.risk_reason}</div>
        </div>
      </div>

      {/* Preferences */}
      {insights.preferences.top_products.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1"><Activity className="w-3 h-3" /> Top products</h4>
          <ul className="space-y-1">
            {insights.preferences.top_products.slice(0, 3).map((p) => (
              <li key={p.name} className="flex items-center justify-between text-[11px]">
                <span className="truncate flex-1">{p.name}</span>
                <span className="font-mono text-muted-foreground ml-2">{p.count}× · {p.total_grams}g</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upsell */}
      {insights.upsell_opportunities.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Upsell opportunities</h4>
          <ul className="space-y-1.5">
            {insights.upsell_opportunities.map((u) => (
              <li key={u.product_id} className="border-l-2 border-primary/40 pl-2 text-[11px]">
                <div className="font-medium">{u.product_name}</div>
                <div className="text-muted-foreground text-[10px]">{u.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats footer */}
      <div className="pt-2 border-t border-border/50 grid grid-cols-3 gap-2 text-center">
        <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Orders</div><div className="text-[13px] font-bold font-mono">{insights.stats.total_orders}</div></div>
        <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Revenue</div><div className="text-[13px] font-bold font-mono">${(insights.stats.total_revenue / 1000).toFixed(1)}k</div></div>
        <div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Avg Order</div><div className="text-[13px] font-bold font-mono">${insights.stats.avg_order_value.toFixed(0)}</div></div>
      </div>
    </div>
  );
}
