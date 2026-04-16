import { motion, AnimatePresence } from "framer-motion";
import { Info, Lightbulb, AlertTriangle, AlertOctagon, X, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useCodyInsights, CodyInsight } from "@/hooks/useCodyInsights";
import codyIcon from "@/assets/cody-icon.svg";

const SEVERITY_CONFIG = {
  info: { icon: Info, color: "text-info", bg: "bg-info/10", border: "border-info/30" },
  suggestion: { icon: Lightbulb, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" },
  warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
  critical: { icon: AlertOctagon, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
} as const;

function InsightCard({ insight, onDismiss }: { insight: CodyInsight; onDismiss: (id: string) => void }) {
  const cfg = SEVERITY_CONFIG[insight.severity ?? "info"];
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className={`group relative rounded-lg border ${cfg.border} ${cfg.bg} p-4 pr-10`}
    >
      <button
        onClick={() => onDismiss(insight.id)}
        className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 ${cfg.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[13px] font-semibold text-foreground mb-0.5">{insight.title}</h4>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{insight.content}</p>
          {insight.action_url && (
            <Link
              to={insight.action_url}
              className={`inline-flex items-center gap-1 mt-2 text-[11px] font-medium ${cfg.color} hover:underline`}
            >
              Take action <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface CodyInsightsPanelProps {
  entity_type?: string;
  entity_id?: string;
  limit?: number;
  /** When true, hides the heading — useful when nesting into another header. */
  compact?: boolean;
}

export default function CodyInsightsPanel(props: CodyInsightsPanelProps) {
  const { insights, loading, dismiss } = useCodyInsights(props);

  if (loading) return null;

  return (
    <div>
      {!props.compact && (
        <div className="flex items-center gap-2 mb-3">
          <img src={codyIcon} alt="" className="w-4 h-4" />
          <h3 className="text-[13px] font-semibold text-foreground">Cody Insights</h3>
          <Sparkles className="w-3 h-3 text-primary/60" />
        </div>
      )}
      {insights.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-5 text-center">
          <img src={codyIcon} alt="" className="w-6 h-6 mx-auto mb-2 opacity-40" />
          <p className="text-[12px] text-muted-foreground">
            No insights yet. Cody will surface trends, anomalies, and suggestions here as your operation grows.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} onDismiss={dismiss} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
