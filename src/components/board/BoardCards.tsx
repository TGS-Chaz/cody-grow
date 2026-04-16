import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import {
  Sprout, Flower, GitBranch, FlaskConical, Leaf, Flower2, Scissors,
  Package, MapPin, ArrowRight, Barcode, Sparkles, AlertTriangle,
  CheckCircle2, Gauge,
} from "lucide-react";
import {
  HydratedBoardCard, BOARD_COLUMN_COLORS, BoardColumn,
} from "@/hooks/useGrowBoard";
import {
  SOURCE_TYPE_COLORS, SourceType,
  STRAIN_TYPE_COLORS, StrainType,
} from "@/lib/schema-enums";
import { cn } from "@/lib/utils";

/**
 * Board cards are intentionally dense: users need to see strain name, age,
 * plant count, phase at a glance for 20+ cards across 5 columns.
 *
 * Each card type composes the same SortableCard wrapper so drag-drop
 * behavior (keyboard + pointer) + hover lift animations are consistent.
 */

const SOURCE_ICONS: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  seed: Flower,
  clone: GitBranch,
  tissue_culture: FlaskConical,
};

interface SortableCardProps {
  card: HydratedBoardCard;
  onClick: () => void;
  onAdvance?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function SortableCard({ card, onClick, children, disabled }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.card.id,
    data: { card },
    disabled,
  });
  const color = BOARD_COLUMN_COLORS[card.column];

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "group relative rounded-lg border border-border bg-card overflow-hidden cursor-grab active:cursor-grabbing select-none",
        "hover:shadow-lg transition-shadow",
        !isDragging && `hover:${color.glow}`,
      )}
      onClick={(e) => {
        // Don't trigger click if this was the start of a drag
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </motion.div>
  );
}

/** Column-colored top accent used on every card. */
export function ColorBar({ column }: { column: BoardColumn }) {
  return <div className={cn("h-1 w-full", BOARD_COLUMN_COLORS[column].bar)} />;
}

// ─── Grow Source Card ─────────────────────────────────────────────────────────

export function GrowSourceCard({ card, onClick, onAdvance }: { card: HydratedBoardCard; onClick: () => void; onAdvance?: () => void }) {
  const s = card.entity;
  const sourceType = s.source_type as SourceType;
  const typeColor = SOURCE_TYPE_COLORS[sourceType];
  const Icon = SOURCE_ICONS[sourceType];
  const remaining = s.current_quantity ?? 0;
  const initial = s.initial_quantity ?? 0;
  const dateField = sourceType === "clone" ? s.cut_date : s.acquired_date;
  const age = dateField ? Math.floor((Date.now() - new Date(dateField).getTime()) / 86400000) : null;
  const canPromote = s.status === "available" && remaining > 0;

  return (
    <SortableCard card={card} onClick={onClick} onAdvance={onAdvance} disabled={!canPromote}>
      <ColorBar column="grow_sources" />
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className={cn("shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", typeColor.iconBg)} style={{ color: typeColor.hex }}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[13px] font-semibold text-foreground truncate">{card.strain?.name ?? "(no strain)"}</h4>
            <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider mt-0.5", typeColor.bg, typeColor.text)}>
              {sourceType}
            </span>
          </div>
        </div>
        <div className="mb-2">
          <div className="flex items-baseline justify-between text-[11px] mb-1">
            <span className="font-mono font-semibold text-foreground"><span>{remaining}</span><span className="text-muted-foreground"> / {initial}</span></span>
            <span className="text-muted-foreground">remaining</span>
          </div>
          {initial > 0 && (
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full transition-all"
                style={{ width: `${(remaining / initial) * 100}%`, background: typeColor.hex }}
              />
            </div>
          )}
        </div>
        {card.area && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
            <MapPin className="w-3 h-3" /> {card.area.name}
          </div>
        )}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">
            {age != null ? <>{age}d old</> : "—"}
          </span>
          {canPromote && onAdvance && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdvance(); }}
              className="inline-flex items-center gap-1 text-primary font-medium hover:text-primary/80"
            >
              Promote <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </SortableCard>
  );
}

// ─── Veg / Flower Cycle Cards ─────────────────────────────────────────────────

function CycleCardBase({
  card, onClick, onAdvance, column,
}: {
  card: HydratedBoardCard;
  onClick: () => void;
  onAdvance?: () => void;
  column: "vegetative" | "flowering";
}) {
  const c = card.entity;
  const plantCount = card.extras.plant_count ?? 0;
  const strainType = card.strain?.type as StrainType | null | undefined;
  const strainColor = strainType ? STRAIN_TYPE_COLORS[strainType] : null;
  const colColor = BOARD_COLUMN_COLORS[column];

  const daysSinceStart = c.start_date ? Math.floor((Date.now() - new Date(c.start_date).getTime()) / 86400000) : null;
  const daysSincePhaseChange = c.updated_at ? Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000) : null;

  const targetHarvest = c.target_harvest_date ? new Date(c.target_harvest_date).getTime() : null;
  const now = Date.now();
  const overdue = targetHarvest != null && targetHarvest < now;
  const daysUntilHarvest = targetHarvest != null ? Math.floor((targetHarvest - now) / 86400000) : null;

  // Progress: for flower column, use days in flower vs strain's average
  const avgFlowerDays = card.strain?.average_flower_days ?? null;
  const flowerProgress = column === "flowering" && daysSincePhaseChange != null && avgFlowerDays
    ? Math.min(100, (daysSincePhaseChange / avgFlowerDays) * 100)
    : null;

  const ActionIcon = column === "vegetative" ? Flower2 : Scissors;
  const actionLabel = column === "vegetative" ? "To Flower" : "Harvest";

  return (
    <SortableCard card={card} onClick={onClick} onAdvance={onAdvance}>
      <ColorBar column={column} />
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              {strainType && strainColor && (
                <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", strainColor.bg, strainColor.text)}>
                  {strainType}
                </span>
              )}
              {overdue && (
                <span className="inline-flex items-center gap-0.5 h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-red-500/15 text-red-500">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Overdue
                </span>
              )}
            </div>
            <h4 className="text-[13px] font-semibold text-foreground truncate">{c.name ?? "Unnamed cycle"}</h4>
            {card.strain && <p className="text-[11px] text-muted-foreground truncate">{card.strain.name}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2">
          <span className="inline-flex items-center gap-1">
            <Leaf className={cn("w-3 h-3", colColor.text)} />
            <span className="font-mono font-semibold text-foreground">{plantCount}</span>
          </span>
          {card.area && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3" />
              {card.area.name}
            </span>
          )}
        </div>

        {/* Phase timeline */}
        <div className="mb-2">
          <div className="flex items-baseline justify-between text-[10px] mb-1">
            <span className="font-mono text-foreground">
              {column === "flowering" && daysSincePhaseChange != null
                ? <>Day <span className="font-semibold">{daysSincePhaseChange}</span> of flower</>
                : daysSinceStart != null
                  ? <>{daysSinceStart}d in {column === "vegetative" ? "veg" : "flower"}</>
                  : "—"}
            </span>
            {avgFlowerDays && column === "flowering" && (
              <span className="text-muted-foreground">of ~{avgFlowerDays}d avg</span>
            )}
          </div>
          {flowerProgress != null && (
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  flowerProgress > 100 ? "bg-red-500" :
                  flowerProgress > 80 ? "bg-emerald-500" :
                  "bg-amber-500",
                )}
                style={{ width: `${Math.min(100, flowerProgress)}%` }}
              />
            </div>
          )}
        </div>

        {targetHarvest != null && column === "flowering" && daysUntilHarvest != null && (
          <div className="text-[10px] text-muted-foreground mb-2">
            {overdue
              ? <span className="text-destructive font-medium">Target was {Math.abs(daysUntilHarvest)}d ago</span>
              : <>Target harvest in <span className="font-mono">{daysUntilHarvest}d</span></>}
          </div>
        )}

        <div className="flex items-center justify-between text-[10px]">
          {/* Cody indicator: overdue or harvest-ready cycles */}
          {column === "flowering" && (overdue || (flowerProgress != null && flowerProgress > 95)) ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <Sparkles className="w-3 h-3" />
              {overdue ? "Past target" : "Ready to harvest"}
            </span>
          ) : <span />}
          {onAdvance && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdvance(); }}
              className="inline-flex items-center gap-1 text-primary font-medium hover:text-primary/80"
            >
              {actionLabel} <ActionIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </SortableCard>
  );
}

export function VegCycleCard(props: { card: HydratedBoardCard; onClick: () => void; onAdvance?: () => void }) {
  return <CycleCardBase {...props} column="vegetative" />;
}

export function FlowerCycleCard(props: { card: HydratedBoardCard; onClick: () => void; onAdvance?: () => void }) {
  return <CycleCardBase {...props} column="flowering" />;
}

// ─── Drying Card ──────────────────────────────────────────────────────────────

export function DryingCard({ card, onClick, onAdvance }: { card: HydratedBoardCard; onClick: () => void; onAdvance?: () => void }) {
  const h = card.entity;
  const wet = h.wet_weight_grams != null ? Number(h.wet_weight_grams) : null;
  const dry = h.dry_weight_grams != null ? Number(h.dry_weight_grams) : null;
  const waste = h.waste_weight_grams != null ? Number(h.waste_weight_grams) : null;
  const yieldPct = wet && dry ? (dry / wet) * 100 : null;
  const daysSince = h.harvest_started_at ? Math.floor((Date.now() - new Date(h.harvest_started_at).getTime()) / 86400000) : null;
  const canAdvance = h.status === "cured";

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    drying: { bg: "bg-orange-500/15", text: "text-orange-500", label: "Drying" },
    curing: { bg: "bg-amber-500/15", text: "text-amber-500", label: "Curing" },
    cured: { bg: "bg-teal-500/15", text: "text-teal-500", label: "Cured" },
    completed: { bg: "bg-muted text-muted-foreground", text: "text-muted-foreground", label: "Completed" },
    active: { bg: "bg-blue-500/15", text: "text-blue-500", label: "Active" },
  };
  const sc = statusConfig[h.status] ?? statusConfig.drying;

  return (
    <SortableCard card={card} onClick={onClick} onAdvance={onAdvance} disabled={!canAdvance}>
      <ColorBar column="drying" />
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider mb-0.5", sc.bg, sc.text)}>
              {sc.label}
            </span>
            <h4 className="text-[13px] font-semibold text-foreground truncate">{h.name ?? "Harvest"}</h4>
            {card.strain && <p className="text-[11px] text-muted-foreground truncate">{card.strain.name}</p>}
          </div>
        </div>

        {/* Weights grid */}
        <div className="grid grid-cols-3 gap-1 text-[10px] mb-2">
          <WeightCell label="Wet" value={wet != null ? `${wet.toFixed(0)}g` : "—"} />
          <WeightCell label="Dry" value={dry != null ? `${dry.toFixed(0)}g` : "—"} />
          <WeightCell label="Waste" value={waste != null ? `${waste.toFixed(0)}g` : "—"} />
        </div>
        {yieldPct != null && (
          <div className="text-[10px] text-muted-foreground mb-2">
            Yield <span className={`font-mono font-semibold ${yieldPct > 28 ? "text-emerald-500" : yieldPct < 18 ? "text-amber-500" : "text-foreground"}`}>{yieldPct.toFixed(1)}%</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">{daysSince != null ? <>Day {daysSince} since harvest</> : "—"}</span>
          {onAdvance && canAdvance && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdvance(); }}
              className="inline-flex items-center gap-1 text-primary font-medium hover:text-primary/80"
            >
              Finalize <Package className="w-3 h-3" />
            </button>
          )}
          {!canAdvance && h.status !== "completed" && (
            <span className="text-muted-foreground">Cure before finalizing</span>
          )}
        </div>
      </div>
    </SortableCard>
  );
}

function WeightCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-muted/30 px-1.5 py-1 text-center">
      <div className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold text-[11px] text-foreground">{value}</div>
    </div>
  );
}

// ─── Inventory Batch Card ─────────────────────────────────────────────────────

export function InventoryCard({ card, onClick }: { card: HydratedBoardCard; onClick: () => void }) {
  const b = card.entity;
  const weight = b.current_weight_grams ?? b.initial_weight_grams;
  const product = card.extras.product;

  return (
    <SortableCard card={card} onClick={onClick} disabled>
      <ColorBar column="inventory" />
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="shrink-0 w-7 h-7 rounded-lg bg-teal-500/15 text-teal-500 flex items-center justify-center">
            <Package className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <Barcode className="w-3 h-3 text-muted-foreground" />
              <span className="font-mono text-[11px] font-semibold text-foreground truncate">{b.barcode ?? b.external_id?.slice(-6) ?? "—"}</span>
            </div>
            <h4 className="text-[12px] font-semibold text-foreground truncate">{product?.name ?? "(no product)"}</h4>
            {card.strain && <p className="text-[11px] text-muted-foreground truncate">{card.strain.name}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] mb-2">
          <span className="inline-flex items-center gap-1">
            <Gauge className="w-3 h-3 text-teal-500" />
            <span className={cn("font-mono font-semibold", weight > 0 ? "text-foreground" : "text-muted-foreground")}>
              {weight != null ? `${Number(weight).toFixed(0)}g` : "—"}
            </span>
            <span className="text-muted-foreground">available</span>
          </span>
          {b.is_marketplace && (
            <span className="inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold bg-teal-500/10 text-teal-500 uppercase tracking-wider">
              Marketplace
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            {b.is_available ? "Available" : "Unavailable"}
          </span>
          <span className="text-muted-foreground">Click for detail →</span>
        </div>
      </div>
    </SortableCard>
  );
}
