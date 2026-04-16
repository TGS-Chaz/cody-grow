import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowUpRight, Sprout, Flower2, Scissors, Package, Leaf,
  Building2, MapPin, Calendar, Gauge,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/shared/StatusPill";
import DateTime from "@/components/shared/DateTime";
import CopyableId from "@/components/shared/CopyableId";
import {
  HydratedBoardCard, BOARD_COLUMN_COLORS, BOARD_COLUMN_LABELS,
} from "@/hooks/useGrowBoard";
import { STRAIN_TYPE_COLORS, StrainType } from "@/lib/schema-enums";
import { cn } from "@/lib/utils";

interface Props {
  card: HydratedBoardCard | null;
  onClose: () => void;
  /** Fires the transition modal for this card's column. */
  onAdvance?: () => void;
}

const COLUMN_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  grow_sources: Sprout,
  vegetative: Leaf,
  flowering: Flower2,
  drying: Scissors,
  inventory: Package,
};

/**
 * Right-side slide-over that shows a summary of the card's underlying entity
 * without navigating away from the board. Click "Open Full Detail →" to
 * navigate to the entity's full page.
 */
export default function SlideOverPanel({ card, onClose, onAdvance }: Props) {
  // Close on Escape
  useEffect(() => {
    if (!card) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [card, onClose]);

  return (
    <AnimatePresence>
      {card && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[2px]"
          />
          {/* Panel */}
          <motion.aside
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="fixed top-0 right-0 bottom-0 w-[400px] max-w-[90vw] z-[71] bg-card border-l border-border shadow-2xl overflow-y-auto"
          >
            <PanelContents card={card} onClose={onClose} onAdvance={onAdvance} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function PanelContents({ card, onClose, onAdvance }: { card: HydratedBoardCard; onClose: () => void; onAdvance?: () => void }) {
  const navigate = useNavigate();
  const column = card.column;
  const color = BOARD_COLUMN_COLORS[column];
  const Icon = COLUMN_ICON[column] ?? Sprout;

  const entity = card.entity;
  const strainType = card.strain?.type as StrainType | null | undefined;
  const strainColor = strainType ? STRAIN_TYPE_COLORS[strainType] : null;

  const fullDetailUrl = (() => {
    if (card.entityType === "grow_source") return `/cultivation/sources/${card.entityId}`;
    if (card.entityType === "grow_cycle") return `/cultivation/grow-cycles/${card.entityId}`;
    if (card.entityType === "harvest") return `/cultivation/harvests/${card.entityId}`;
    if (card.entityType === "batch") return `/inventory/batches/${card.entityId}`;
    return "/cultivation/board";
  })();

  return (
    <div>
      {/* Header with color bar */}
      <div className={cn("h-1 w-full", color.bar)} />
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className={cn("w-3.5 h-3.5", color.text)} />
            <span className={cn("text-[10px] uppercase tracking-wider font-semibold", color.text)}>
              {BOARD_COLUMN_LABELS[column]}
            </span>
          </div>
          <h2 className="text-[17px] font-bold text-foreground leading-tight">
            {entityTitle(card)}
          </h2>
          {card.strain && (
            <div className="flex items-center gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => navigate(`/cultivation/strains/${card.strain!.id}`)}
                className="text-[12px] text-muted-foreground hover:text-primary"
              >
                {card.strain.name}
              </button>
              {strainColor && strainType && (
                <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", strainColor.bg, strainColor.text)}>
                  {strainType}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Column-specific content */}
      <div className="p-5 space-y-4">
        {column === "grow_sources" && <SourcePanel card={card} />}
        {(column === "vegetative" || column === "flowering") && <CyclePanel card={card} />}
        {column === "drying" && <HarvestPanel card={card} />}
        {column === "inventory" && <BatchPanel card={card} />}
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-border space-y-2 sticky bottom-0 bg-card">
        {onAdvance && column !== "inventory" && (
          <Button onClick={onAdvance} className="w-full gap-1.5">
            {column === "grow_sources" && "Promote to Cycle"}
            {column === "vegetative" && "Move to Flowering"}
            {column === "flowering" && "Harvest"}
            {column === "drying" && "Finalize to Inventory"}
          </Button>
        )}
        <Button variant="outline" onClick={() => navigate(fullDetailUrl)} className="w-full gap-1.5">
          Open Full Detail <ArrowUpRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function entityTitle(card: HydratedBoardCard): string {
  const e = card.entity;
  if (card.entityType === "grow_source") {
    return `${card.strain?.name ?? "Source"} · ${card.entityType === "grow_source" && e.source_type === "clone" ? "clones" : "seeds"}`;
  }
  if (card.entityType === "grow_cycle") return e.name ?? "Cycle";
  if (card.entityType === "harvest") return e.name ?? "Harvest";
  if (card.entityType === "batch") return e.barcode ?? e.external_id ?? "Batch";
  return "—";
}

// ─── Per-column panel bodies ─────────────────────────────────────────────────

function SourcePanel({ card }: { card: HydratedBoardCard }) {
  const s = card.entity;
  const remaining = s.current_quantity ?? 0;
  const initial = s.initial_quantity ?? 0;
  const dateField = s.source_type === "clone" ? s.cut_date : s.acquired_date;
  const age = dateField ? Math.floor((Date.now() - new Date(dateField).getTime()) / 86400000) : null;
  return (
    <>
      <InfoRow label="Type" value={<span className="capitalize">{s.source_type?.replace("_", " ")}</span>} />
      <InfoRow label="Quantity" value={<span className="font-mono"><span className="font-semibold">{remaining}</span> / {initial}</span>} />
      <InfoRow label="Status" value={<span className="capitalize">{s.status?.replace("_", " ")}</span>} />
      {s.source_vendor && <InfoRow label="Vendor" value={s.source_vendor} />}
      {age != null && <InfoRow icon={Calendar} label="Age" value={<span className="font-mono">{age}d</span>} />}
      {card.area && <InfoRow icon={MapPin} label="Area" value={card.area.name} />}
      <InfoRow label="External ID" value={<CopyableId value={s.external_id} />} />
    </>
  );
}

function CyclePanel({ card }: { card: HydratedBoardCard }) {
  const c = card.entity;
  const daysSinceStart = c.start_date ? Math.floor((Date.now() - new Date(c.start_date).getTime()) / 86400000) : null;
  const targetDays = card.strain?.average_flower_days;
  return (
    <>
      <InfoRow icon={Leaf} label="Plants" value={<span className="font-mono font-semibold">{card.extras.plant_count ?? 0}</span>} />
      <InfoRow label="Phase" value={<span className="capitalize font-medium">{c.phase?.replaceAll("_", " ")}</span>} />
      {c.start_date && <InfoRow icon={Calendar} label="Started" value={<DateTime value={c.start_date} format="date-only" />} />}
      {daysSinceStart != null && <InfoRow label="Age" value={<span className="font-mono">{daysSinceStart}d</span>} />}
      {targetDays && <InfoRow label="Avg Flower" value={<span className="font-mono text-muted-foreground">{targetDays}d</span>} />}
      {c.target_harvest_date && <InfoRow icon={Calendar} label="Target Harvest" value={<DateTime value={c.target_harvest_date} format="date-only" />} />}
      {card.area && <InfoRow icon={MapPin} label="Area" value={card.area.name} />}
    </>
  );
}

function HarvestPanel({ card }: { card: HydratedBoardCard }) {
  const h = card.entity;
  const wet = h.wet_weight_grams != null ? Number(h.wet_weight_grams) : null;
  const dry = h.dry_weight_grams != null ? Number(h.dry_weight_grams) : null;
  const waste = h.waste_weight_grams != null ? Number(h.waste_weight_grams) : null;
  const yieldPct = wet && dry ? (dry / wet) * 100 : null;
  const daysSinceHarvest = h.harvest_started_at ? Math.floor((Date.now() - new Date(h.harvest_started_at).getTime()) / 86400000) : null;
  return (
    <>
      <InfoRow label="Status" value={<StatusBadge status={h.status} />} />
      {h.harvest_started_at && <InfoRow icon={Calendar} label="Harvested" value={<DateTime value={h.harvest_started_at} format="date-only" />} />}
      {daysSinceHarvest != null && <InfoRow label="Days" value={<span className="font-mono">{daysSinceHarvest}d</span>} />}
      {wet != null && <InfoRow icon={Gauge} label="Wet Weight" value={<span className="font-mono">{wet.toFixed(0)}g</span>} />}
      {dry != null && <InfoRow icon={Gauge} label="Dry Weight" value={<span className="font-mono">{dry.toFixed(0)}g</span>} />}
      {waste != null && <InfoRow label="Waste" value={<span className="font-mono">{waste.toFixed(0)}g</span>} />}
      {yieldPct != null && <InfoRow label="Yield" value={<span className={`font-mono font-semibold ${yieldPct > 28 ? "text-emerald-500" : yieldPct < 18 ? "text-amber-500" : "text-foreground"}`}>{yieldPct.toFixed(1)}%</span>} />}
      {card.area && <InfoRow icon={MapPin} label="Area" value={card.area.name} />}
    </>
  );
}

function BatchPanel({ card }: { card: HydratedBoardCard }) {
  const b = card.entity;
  const weight = b.current_weight_grams ?? b.initial_weight_grams;
  return (
    <>
      {b.barcode && <InfoRow label="Barcode" value={<CopyableId value={b.barcode} />} />}
      {card.extras.product && <InfoRow icon={Package} label="Product" value={card.extras.product.name} />}
      <InfoRow label="Weight" value={weight != null ? <span className="font-mono font-semibold">{Number(weight).toFixed(0)}g</span> : "—"} />
      {b.is_marketplace && <InfoRow label="Marketplace" value={<span className="inline-flex h-5 px-2 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-500 uppercase tracking-wider">Listed</span>} />}
      {b.is_available != null && <InfoRow label="Available" value={b.is_available ? "Yes" : "No"} />}
      {card.area && <InfoRow icon={MapPin} label="Storage" value={card.area.name} />}
      {b.external_id && <InfoRow label="External ID" value={<CopyableId value={b.external_id} />} />}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 items-center py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className="text-[12px] text-foreground">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, any> = {
    drying: { v: "warning", l: "Drying" },
    curing: { v: "warning", l: "Curing" },
    cured: { v: "success", l: "Cured" },
    completed: { v: "muted", l: "Completed" },
    active: { v: "info", l: "Active" },
  };
  const m = map[status] ?? { v: "muted", l: status };
  return <StatusPill label={m.l} variant={m.v} />;
}

void Building2;
