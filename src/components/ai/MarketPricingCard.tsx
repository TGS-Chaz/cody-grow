import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus, Sparkles, ArrowUpRight } from "lucide-react";
import { PricingIntel } from "@/hooks/usePricingIntel";

interface Props {
  data: PricingIntel;
  categoryLabel?: string;
  strainName?: string | null;
}

export default function MarketPricingCard({ data, categoryLabel, strainName }: Props) {
  if (data.loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="h-20 animate-pulse rounded bg-muted/50" />
      </div>
    );
  }

  // Intel not subscribed + no baseline available — promo card
  if (!data.connected && data.avgPrice === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-[13px] font-semibold">Market pricing intelligence</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">
          Connect Cody Intel to see how your pricing compares to similar cannabis products across Washington State.
        </p>
        <Link to="/settings/integrations" className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1">
          Enable Cody Intel <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  const trendIcon = data.trend === "up" ? TrendingUp : data.trend === "down" ? TrendingDown : Minus;
  const TrendIcon = trendIcon;
  const trendColor = data.trend === "up" ? "text-emerald-500" : data.trend === "down" ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-[13px] font-semibold">Market intelligence</h3>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${trendColor}`}>
          <TrendIcon className="w-3 h-3" /> {data.trend}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {strainName ? <><span className="font-medium text-foreground">{strainName}</span> · </> : null}
        {categoryLabel ?? "this category"} averages <span className="font-mono font-semibold text-foreground">${data.avgPrice.toFixed(2)}</span> (range ${data.priceRange.min.toFixed(2)} – ${data.priceRange.max.toFixed(2)}){data.sampleSize > 0 ? ` across ${data.sampleSize} samples` : ""}.
      </p>
      {data.yourPrice != null && data.percentile != null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Your price ${data.yourPrice.toFixed(2)}</span>
            <span className="font-mono font-semibold text-foreground">{data.percentile}th percentile</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${data.percentile}%` }} />
          </div>
        </div>
      )}
      {!data.connected && (
        <p className="text-[10px] text-muted-foreground italic">
          Baseline estimate — <Link to="/settings/integrations" className="text-primary hover:underline">connect Cody Intel</Link> for live WA market data.
        </p>
      )}
    </div>
  );
}
