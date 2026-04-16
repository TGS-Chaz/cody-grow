import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { MoreVertical, Plus, Sprout, Leaf, Flower2, Scissors, Package } from "lucide-react";
import {
  BOARD_COLUMN_COLORS, BOARD_COLUMN_LABELS, BoardColumn as BoardColumnName,
  HydratedBoardCard, NEXT_COLUMN,
} from "@/hooks/useGrowBoard";
import {
  GrowSourceCard, VegCycleCard, FlowerCycleCard, DryingCard, InventoryCard,
} from "./BoardCards";
import { cn } from "@/lib/utils";

const COLUMN_ICONS: Record<BoardColumnName, React.ComponentType<{ className?: string }>> = {
  grow_sources: Sprout,
  vegetative: Leaf,
  flowering: Flower2,
  drying: Scissors,
  inventory: Package,
};

interface Props {
  column: BoardColumnName;
  cards: HydratedBoardCard[];
  /** Whether a drag is currently in progress over this column (highlight). */
  isActiveDropTarget?: boolean;
  /** Whether the dragged card is coming from the previous column. */
  isValidDropTarget?: boolean;
  onCardClick: (card: HydratedBoardCard) => void;
  onCardAdvance: (card: HydratedBoardCard) => void;
  onAddClick?: () => void;
}

export default function BoardColumn({
  column, cards, isActiveDropTarget, isValidDropTarget,
  onCardClick, onCardAdvance, onAddClick,
}: Props) {
  const color = BOARD_COLUMN_COLORS[column];
  const Icon = COLUMN_ICONS[column];
  const canAddFirstColumn = column === "grow_sources";
  const nextColumn = NEXT_COLUMN[column];

  // Droppable zone — only the grow_sources column accepts "new" drops (not
  // from drag-drop; drag-drop targets the NEXT column). For the other columns
  // the droppable registers so drag events know where the dragged card can land.
  const { setNodeRef } = useDroppable({
    id: `column-${column}`,
    data: { column },
  });

  return (
    <div className="flex flex-col min-w-0 flex-1 rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Column header */}
      <div
        className={cn("h-1 w-full shrink-0", color.bar)}
      />
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn("w-3.5 h-3.5 shrink-0", color.text)} />
          <h3 className="text-[12px] font-semibold text-foreground truncate">{BOARD_COLUMN_LABELS[column]}</h3>
          <span className={cn("inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-semibold bg-muted", color.text)}>
            {cards.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {canAddFirstColumn && onAddClick && (
            <button
              onClick={onAddClick}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              title="Add source"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            disabled
            className="p-1 rounded text-muted-foreground/40 cursor-not-allowed"
            title="Column actions — coming soon"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto p-2 space-y-2 transition-colors relative",
          isActiveDropTarget && isValidDropTarget && "bg-primary/5",
          isActiveDropTarget && !isValidDropTarget && "bg-destructive/5",
        )}
      >
        <SortableContext items={cards.map((c) => c.card.id)} strategy={verticalListSortingStrategy}>
          {cards.length === 0 ? (
            <EmptyColumn column={column} onAddClick={canAddFirstColumn ? onAddClick : undefined} />
          ) : (
            cards.map((card) => (
              <BoardCard
                key={card.card.id}
                card={card}
                onClick={() => onCardClick(card)}
                onAdvance={nextColumn ? () => onCardAdvance(card) : undefined}
              />
            ))
          )}
        </SortableContext>

        {/* Drop overlay indicator — rendered when this column is a valid target */}
        {isActiveDropTarget && isValidDropTarget && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "pointer-events-none absolute inset-2 rounded-lg border-2 border-dashed flex items-center justify-center",
              color.text, "border-current",
            )}
          >
            <div className="text-center">
              <p className={cn("text-[11px] font-semibold uppercase tracking-wider", color.text)}>
                Drop to {column === "vegetative" ? "promote" : column === "flowering" ? "move to flower" : column === "drying" ? "harvest" : "finalize"}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/** Renders the correct card component based on the column. */
function BoardCard({ card, onClick, onAdvance }: { card: HydratedBoardCard; onClick: () => void; onAdvance?: () => void }) {
  switch (card.column) {
    case "grow_sources": return <GrowSourceCard card={card} onClick={onClick} onAdvance={onAdvance} />;
    case "vegetative":   return <VegCycleCard card={card} onClick={onClick} onAdvance={onAdvance} />;
    case "flowering":    return <FlowerCycleCard card={card} onClick={onClick} onAdvance={onAdvance} />;
    case "drying":       return <DryingCard card={card} onClick={onClick} onAdvance={onAdvance} />;
    case "inventory":    return <InventoryCard card={card} onClick={onClick} />;
  }
}

function EmptyColumn({ column, onAddClick }: { column: BoardColumnName; onAddClick?: () => void }) {
  const hint: Record<BoardColumnName, string> = {
    grow_sources: "Add seeds or clones to start",
    vegetative: "Promote a source to create a veg cycle",
    flowering: "Move a veg cycle here when ready",
    drying: "Harvest a flowering cycle to add here",
    inventory: "Finalize dried harvests to create batches",
  };
  return (
    <div className="h-full min-h-[200px] flex items-center justify-center text-center p-4">
      <div>
        <p className="text-[11px] text-muted-foreground/70 mb-2">{hint[column]}</p>
        {onAddClick && (
          <button
            onClick={onAddClick}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80"
          >
            <Plus className="w-3 h-3" /> Add source
          </button>
        )}
      </div>
    </div>
  );
}
