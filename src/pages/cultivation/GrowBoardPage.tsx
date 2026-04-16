import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay,
  PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import {
  LayoutGrid, Plus, RefreshCw, Search, Sprout, Leaf, Flower2, Scissors,
  Package, ArrowRight, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useGrowBoard, BOARD_COLUMNS, BoardColumn, HydratedBoardCard, NEXT_COLUMN,
  useBoardCodyContext,
} from "@/hooks/useGrowBoard";
import { useSources, SourceInput } from "@/hooks/useSources";
import {
  GrowSourceCard, VegCycleCard, FlowerCycleCard, DryingCard, InventoryCard,
} from "@/components/board/BoardCards";
import BoardColumnView from "@/components/board/BoardColumn";
import SlideOverPanel from "@/components/board/SlideOverPanel";
import PhaseChangeModal from "@/components/board/PhaseChangeModal";
import HarvestModal from "@/components/board/HarvestModal";
import FinishHarvestModal from "@/components/board/FinishHarvestModal";
import PromoteToCycleModal from "@/pages/cultivation/PromoteToCycleModal";
import SourceFormModal from "@/pages/cultivation/SourceFormModal";
import { cn } from "@/lib/utils";

/** Transition modal state union — which modal is open for which card. */
type TransitionState =
  | { type: "promote"; card: HydratedBoardCard }
  | { type: "flower"; card: HydratedBoardCard }
  | { type: "harvest"; card: HydratedBoardCard }
  | { type: "finalize"; card: HydratedBoardCard }
  | null;

export default function GrowBoardPage() {
  const { data: board, loading, refresh } = useGrowBoard();
  const { createSource } = useSources();

  // Filters
  const [search, setSearch] = useState("");
  const [strainFilter, setStrainFilter] = useState<string>("");
  const [facilityFilter, setFacilityFilter] = useState<string>("");

  // DnD state
  const [activeCard, setActiveCard] = useState<HydratedBoardCard | null>(null);
  const [overColumn, setOverColumn] = useState<BoardColumn | null>(null);

  // Slide-over + modals
  const [slideOverCard, setSlideOverCard] = useState<HydratedBoardCard | null>(null);
  const [transition, setTransition] = useState<TransitionState>(null);
  const [addSourceOpen, setAddSourceOpen] = useState(false);

  // Column refs for keyboard-shortcut scroll-to-column
  const columnRefs = useRef<Record<BoardColumn, HTMLDivElement | null>>({
    grow_sources: null, vegetative: null, flowering: null, drying: null, inventory: null,
  });

  // Cody context
  const { setContext, clearContext } = useCodyContext();
  const codyPayload = useBoardCodyContext(board);
  useEffect(() => {
    setContext({ context_type: "grow_board", page_data: codyPayload });
    return () => clearContext();
  }, [setContext, clearContext, codyPayload]);

  // Derived filter option lists
  const strainOptions = useMemo(() => {
    const m = new Map<string, string>();
    Object.values(board.columns).flat().forEach((c) => {
      if (c.strain) m.set(c.strain.id, c.strain.name);
    });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [board]);
  const facilityOptions = useMemo(() => {
    const m = new Map<string, string>();
    Object.values(board.columns).flat().forEach((c) => {
      // Area's facility_id would be on the joined area if fetched; we only have area name here
      if (c.area?.id) m.set(c.area.id, c.area.name);
    });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [board]);

  // Filter cards by search/strain/area
  const filteredColumns = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filter = (card: HydratedBoardCard) => {
      if (q) {
        const hay = `${card.strain?.name ?? ""} ${card.area?.name ?? ""} ${card.entity.name ?? ""} ${card.entity.barcode ?? ""} ${card.entity.external_id ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (strainFilter && card.strain?.id !== strainFilter) return false;
      if (facilityFilter && card.area?.id !== facilityFilter) return false;
      return true;
    };
    const result: Record<BoardColumn, HydratedBoardCard[]> = {
      grow_sources: board.columns.grow_sources.filter(filter),
      vegetative: board.columns.vegetative.filter(filter),
      flowering: board.columns.flowering.filter(filter),
      drying: board.columns.drying.filter(filter),
      inventory: board.columns.inventory.filter(filter),
    };
    return result;
  }, [board, search, strainFilter, facilityFilter]);

  const totalVisibleCards = useMemo(
    () => Object.values(filteredColumns).reduce((sum, arr) => sum + arr.length, 0),
    [filteredColumns],
  );

  // ─── DnD setup ─────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    const card = e.active.data.current?.card as HydratedBoardCard | undefined;
    if (card) setActiveCard(card);
  };

  const handleDragOver = (e: DragOverEvent) => {
    const overId = e.over?.id as string | undefined;
    if (!overId) { setOverColumn(null); return; }
    // A column's droppable id is "column-<name>"; a card's id is its own UUID.
    if (overId.startsWith("column-")) {
      setOverColumn(overId.replace("column-", "") as BoardColumn);
    } else {
      // Dragging over a card — find the column it belongs to
      const overCard = e.over?.data.current?.card as HydratedBoardCard | undefined;
      if (overCard) setOverColumn(overCard.column);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const card = activeCard;
    const targetColumn = overColumn;
    setActiveCard(null);
    setOverColumn(null);
    if (!card || !targetColumn) return;

    const expectedNext = NEXT_COLUMN[card.column];
    if (targetColumn === card.column) return; // same-column reorder (not implemented)
    if (targetColumn !== expectedNext) {
      toast.error("Cards can only move forward one column at a time", {
        description: "Use the detail page to manage backward changes.",
      });
      return;
    }

    // Trigger the appropriate transition modal
    if (card.column === "grow_sources" && targetColumn === "vegetative") {
      setTransition({ type: "promote", card });
    } else if (card.column === "vegetative" && targetColumn === "flowering") {
      setTransition({ type: "flower", card });
    } else if (card.column === "flowering" && targetColumn === "drying") {
      setTransition({ type: "harvest", card });
    } else if (card.column === "drying" && targetColumn === "inventory") {
      // Block if harvest isn't cured
      if (card.entity.status !== "cured") {
        toast.error("Finish curing first", {
          description: `Harvest is currently "${card.entity.status}". Open the card to record cure weight.`,
        });
        return;
      }
      setTransition({ type: "finalize", card });
    }
  };

  // Cards the board cursor is allowed to drag depending on column — we don't
  // need to block drag at all; we validate on drop (handleDragEnd).

  const handleAdvance = (card: HydratedBoardCard) => {
    // Same path as drag-drop, but triggered by clicking a card's inline CTA
    if (card.column === "grow_sources") setTransition({ type: "promote", card });
    else if (card.column === "vegetative") setTransition({ type: "flower", card });
    else if (card.column === "flowering") setTransition({ type: "harvest", card });
    else if (card.column === "drying") {
      if (card.entity.status !== "cured") {
        toast.error("Finish curing first");
        return;
      }
      setTransition({ type: "finalize", card });
    }
  };

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  const modalOpen = !!transition || !!slideOverCard || addSourceOpen;
  useShortcut(["n"], () => setAddSourceOpen(true), { description: "Add source", scope: "Grow Board", enabled: !modalOpen });
  useShortcut(["r"], () => { refresh(); toast.success("Board refreshed"); }, { description: "Refresh board", scope: "Grow Board", enabled: !modalOpen });
  useShortcut(["/"], () => document.querySelector<HTMLInputElement>("[data-board-search]")?.focus(), { description: "Focus search", scope: "Grow Board", enabled: !modalOpen });
  useShortcut(["1"], () => columnRefs.current.grow_sources?.scrollIntoView({ behavior: "smooth", inline: "start" }), { description: "Focus Sources", scope: "Grow Board", enabled: !modalOpen });
  useShortcut(["2"], () => columnRefs.current.vegetative?.scrollIntoView({ behavior: "smooth", inline: "start" }), { description: "Focus Veg", scope: "Grow Board", enabled: !modalOpen });
  useShortcut(["3"], () => columnRefs.current.flowering?.scrollIntoView({ behavior: "smooth", inline: "start" }), { description: "Focus Flower", scope: "Grow Board", enabled: !modalOpen });
  useShortcut(["4"], () => columnRefs.current.drying?.scrollIntoView({ behavior: "smooth", inline: "start" }), { description: "Focus Drying", scope: "Grow Board", enabled: !modalOpen });
  useShortcut(["5"], () => columnRefs.current.inventory?.scrollIntoView({ behavior: "smooth", inline: "start" }), { description: "Focus Inventory", scope: "Grow Board", enabled: !modalOpen });

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleCreateSource = async (input: SourceInput) => {
    const row = await createSource(input);
    refresh();
    return row;
  };

  const handleModalSuccess = () => {
    refresh();
    setSlideOverCard(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const isEmpty = !loading && totalVisibleCards === 0 && !search && !strainFilter && !facilityFilter;

  return (
    <div className="p-6 md:p-8 max-w-[1800px] mx-auto">
      <PageHeader
        title="Grow Board"
        description="Your cultivation pipeline at a glance"
        breadcrumbs={[{ label: "Cultivation" }, { label: "Grow Board" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { refresh(); toast.success("Board refreshed"); }} className="gap-1.5" title="Refresh (R)">
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button onClick={() => setAddSourceOpen(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Source
            </Button>
          </div>
        }
      />

      {/* Toolbar — search + filters + board summary chips */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            data-board-search
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search strain, area, cycle name, barcode…"
            className="pl-9 h-9 text-[12px]"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <select value={strainFilter} onChange={(e) => setStrainFilter(e.target.value)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border" disabled={strainOptions.length === 0}>
            <option value="">All strains</option>
            {strainOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border" disabled={facilityOptions.length === 0}>
            <option value="">All areas</option>
            {facilityOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-auto">
          {board.total_plants > 0 && (
            <span className="inline-flex items-center gap-1">
              <Leaf className="w-3 h-3 text-emerald-500" />
              <span className="font-mono font-semibold text-foreground">{board.total_plants}</span> plants
            </span>
          )}
          {board.strains_active > 0 && (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="font-mono font-semibold text-foreground">{board.strains_active}</span> strains
            </span>
          )}
          {board.upcoming_harvests > 0 && (
            <span className="inline-flex items-center gap-1">
              <Scissors className="w-3 h-3 text-amber-500" />
              <span className="font-mono font-semibold text-amber-500">{board.upcoming_harvests}</span> upcoming harvests
            </span>
          )}
          {board.overdue_items > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
              <span className="font-mono font-semibold text-destructive">{board.overdue_items}</span> overdue
            </span>
          )}
        </div>
      </div>

      {isEmpty ? (
        <BoardOnboarding onAdd={() => setAddSourceOpen(true)} />
      ) : loading ? (
        <BoardSkeleton />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 min-h-[600px]">
            {BOARD_COLUMNS.map((col) => {
              const expectedNext = activeCard ? NEXT_COLUMN[activeCard.column] : null;
              const isTarget = overColumn === col && activeCard != null;
              const isValid = expectedNext === col;
              return (
                <div key={col} ref={(el) => { columnRefs.current[col] = el; }} className="min-h-[600px]">
                  <BoardColumnView
                    column={col}
                    cards={filteredColumns[col]}
                    isActiveDropTarget={isTarget}
                    isValidDropTarget={isValid}
                    onCardClick={(card) => setSlideOverCard(card)}
                    onCardAdvance={handleAdvance}
                    onAddClick={col === "grow_sources" ? () => setAddSourceOpen(true) : undefined}
                  />
                </div>
              );
            })}
          </div>

          {/* Drag overlay renders a snapshot of the card while dragging */}
          <DragOverlay>
            {activeCard ? <DragPreview card={activeCard} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Slide-over panel */}
      <SlideOverPanel
        card={slideOverCard}
        onClose={() => setSlideOverCard(null)}
        onAdvance={slideOverCard ? () => handleAdvance(slideOverCard) : undefined}
      />

      {/* Transition modals */}
      {transition?.type === "promote" && (
        <PromoteToCycleModal
          open
          onClose={() => setTransition(null)}
          source={transition.card.entity}
          onSuccess={handleModalSuccess}
        />
      )}
      {transition?.type === "flower" && (
        <PhaseChangeModal
          open
          onClose={() => setTransition(null)}
          card={transition.card}
          onSuccess={handleModalSuccess}
        />
      )}
      {transition?.type === "harvest" && (
        <HarvestModal
          open
          onClose={() => setTransition(null)}
          card={transition.card}
          onSuccess={handleModalSuccess}
        />
      )}
      {transition?.type === "finalize" && (
        <FinishHarvestModal
          open
          onClose={() => setTransition(null)}
          card={transition.card}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Add source modal */}
      <SourceFormModal
        open={addSourceOpen}
        onClose={() => setAddSourceOpen(false)}
        onSave={handleCreateSource}
      />
    </div>
  );
}

// ─── Drag preview ────────────────────────────────────────────────────────────

function DragPreview({ card }: { card: HydratedBoardCard }) {
  // A rotated + scaled snapshot of the source card for the drag overlay.
  const renderCard = () => {
    switch (card.column) {
      case "grow_sources": return <GrowSourceCard card={card} onClick={() => {}} />;
      case "vegetative":   return <VegCycleCard card={card} onClick={() => {}} />;
      case "flowering":    return <FlowerCycleCard card={card} onClick={() => {}} />;
      case "drying":       return <DryingCard card={card} onClick={() => {}} />;
      case "inventory":    return <InventoryCard card={card} onClick={() => {}} />;
    }
  };
  return (
    <div style={{ transform: "rotate(2deg) scale(1.02)", width: 260 }} className="shadow-2xl pointer-events-none">
      {renderCard()}
    </div>
  );
}

// ─── Onboarding empty state ──────────────────────────────────────────────────

function BoardOnboarding({ onAdd }: { onAdd: () => void }) {
  const columns: { col: BoardColumn; icon: React.ComponentType<{ className?: string }>; label: string; desc: string }[] = [
    { col: "grow_sources", icon: Sprout, label: "Sources", desc: "Seeds & clones" },
    { col: "vegetative", icon: Leaf, label: "Veg", desc: "Growing cycles" },
    { col: "flowering", icon: Flower2, label: "Flower", desc: "Flowering cycles" },
    { col: "drying", icon: Scissors, label: "Drying", desc: "Harvests curing" },
    { col: "inventory", icon: Package, label: "Inventory", desc: "Finished batches" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-purple-500/5 p-10 md:p-14 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mx-auto mb-5">
        <LayoutGrid className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-[22px] md:text-[26px] font-bold text-foreground mb-2 tracking-tight">Welcome to the Grow Board</h2>
      <p className="text-[13px] text-muted-foreground max-w-lg mx-auto mb-6 leading-relaxed">
        This is your cultivation command center. Everything flows left to right: seeds → veg → flower → drying → inventory.
        Drag cards forward to advance them through the pipeline. Start by adding a grow source.
      </p>

      {/* Mini visual of the 5 columns */}
      <div className="grid grid-cols-5 gap-2 max-w-3xl mx-auto mb-8">
        {columns.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={c.col}>
              <div className="rounded-lg border border-border bg-card p-3">
                <Icon className="w-5 h-5 mx-auto text-primary mb-1.5" />
                <p className="text-[11px] font-semibold text-foreground">{c.label}</p>
                <p className="text-[9px] text-muted-foreground">{c.desc}</p>
              </div>
              {i < columns.length - 1 && (
                <ArrowRight className="hidden md:block w-3 h-3 text-muted-foreground/50 mx-auto mt-1" />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button onClick={onAdd} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Seeds or Clones
        </Button>
        <Button variant="outline" disabled className="gap-1.5" title="Coming soon">
          Import existing grow data
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, col) => (
        <div key={col} className="rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="h-1 w-full bg-muted" />
          <div className="px-3 py-2.5 border-b border-border">
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          </div>
          <div className="p-2 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                <div className="h-2 w-16 bg-muted rounded animate-pulse" />
                <div className="h-1 w-full bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
