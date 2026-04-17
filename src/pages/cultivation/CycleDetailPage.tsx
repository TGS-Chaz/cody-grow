import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarDays, Edit, Archive, Loader2, ArrowUpDown, Scissors, Plus,
  Leaf, Flower2, CheckCircle2, Activity, ScrollText, Ruler, MapPin,
  Building2, Clock, Sparkles, BarChart3, AlertTriangle, Gauge,
  Thermometer, Droplets, Wind, TrendingUp,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import PhaseColorBadge from "@/components/shared/PhaseColorBadge";
import StatCard from "@/components/shared/StatCard";
import DataTable from "@/components/shared/DataTable";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import EnvironmentChart from "@/components/shared/EnvironmentChart";
import CodyInsightsPanel from "@/components/cody/CodyInsightsPanel";
import CycleAIInsights from "@/components/ai/CycleAIInsights";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useCycle, useCycles, useCyclePlants, useCycleHarvests, useCycleEnvironment,
  useCycleYield, usePhaseChangeCycle, Cycle,
} from "@/hooks/useCycles";
import { usePlantStats } from "@/hooks/usePlants";
import { supabase } from "@/lib/supabase";
import {
  CYCLE_PHASES, CyclePhase,
  STRAIN_TYPE_COLORS, StrainType,
  HARVEST_STATUS_LABELS, HarvestStatus,
} from "@/lib/schema-enums";
import CycleFormModal from "./CycleFormModal";
import InlineAIEdit from "@/components/ai/InlineAIEdit";
import HarvestModal from "@/components/board/HarvestModal";
import { cn } from "@/lib/utils";

const PHASE_LABELS: Record<CyclePhase, string> = {
  immature: "Immature",
  vegetative: "Vegetative",
  flowering: "Flowering",
  ready_for_harvest: "Ready for Harvest",
  harvesting: "Harvesting",
  completed: "Completed",
};

export default function CycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const setActiveTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const { data: cycle, loading, refresh } = useCycle(id);
  const { updateCycle, archiveCycle } = useCycles({ status: "all" });
  const phaseChange = usePhaseChangeCycle();
  const { data: plants } = useCyclePlants(id);
  const { data: harvests } = useCycleHarvests(id);
  const { data: envReadings } = useCycleEnvironment(cycle);
  const yieldMetrics = useCycleYield(cycle, harvests);

  const [editOpen, setEditOpen] = useState(false);
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const [harvestOpen, setHarvestOpen] = useState(false);
  const [phasePickerOpen, setPhasePickerOpen] = useState(false);

  const modalOpen = editOpen || harvestOpen || phasePickerOpen;

  // Cody context
  const { setContext, clearContext } = useCodyContext();
  const sig = cycle ? `${cycle.id}:${cycle.updated_at}:${plants.length}:${harvests.length}` : "";
  const codyPayload = useMemo(() => {
    if (!cycle) return null;
    return {
      cycle: {
        name: cycle.name,
        strain: cycle.strain?.name,
        area: cycle.area?.name,
        phase: cycle.phase,
        start: cycle.start_date,
        target: cycle.target_harvest_date,
        actual: cycle.actual_harvest_date,
        active_plants: plants.filter((p) => !["destroyed", "harvested"].includes(p.phase)).length,
        harvests: harvests.length,
      },
      yield: yieldMetrics,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (!cycle || !codyPayload) return;
    setContext({ context_type: "cycle_detail", context_id: cycle.id, page_data: codyPayload });
    return () => clearContext();
  }, [setContext, clearContext, codyPayload, cycle?.id]);

  useShortcut(["e"], () => setEditOpen(true), { description: "Edit cycle", scope: "Cycle Detail", enabled: !!cycle && !modalOpen });
  useShortcut(["p"], () => setPhasePickerOpen(true), { description: "Change phase", scope: "Cycle Detail", enabled: !!cycle && !modalOpen });
  useShortcut(["h"], () => setHarvestOpen(true), { description: "Harvest this cycle", scope: "Cycle Detail", enabled: !!cycle && cycle.phase === "flowering" && !modalOpen });

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!cycle) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState
          icon={CalendarDays}
          title="Cycle not found"
          description="This cycle may have been archived or doesn't exist."
          primaryAction={<Button onClick={() => navigate("/cultivation/cycles")}>← Back to cycles</Button>}
        />
      </div>
    );
  }

  const strainType = cycle.strain?.type as StrainType | null;
  const strainColor = strainType ? STRAIN_TYPE_COLORS[strainType] : null;
  const ageDays = cycle.start_date ? Math.floor((Date.now() - new Date(cycle.start_date).getTime()) / 86400000) : 0;

  const canAdvanceTo: CyclePhase[] = (() => {
    if (cycle.phase === "immature") return ["vegetative"];
    if (cycle.phase === "vegetative") return ["flowering"];
    if (cycle.phase === "flowering") return ["harvesting"];
    if (cycle.phase === "harvesting") return ["completed"];
    return [];
  })();

  const handlePhaseChange = async (newPhase: CyclePhase) => {
    try {
      await phaseChange(cycle.id, newPhase);
      toast.success(`Cycle moved to ${PHASE_LABELS[newPhase]}`, {
        description: `All active plants + Grow Board card updated`,
      });
      refresh();
      setPhasePickerOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Phase change failed");
    }
  };

  const handleArchive = async () => {
    if (!confirm(`Archive "${cycle.name}"? It'll be marked completed and removed from the Grow Board.`)) return;
    try {
      await archiveCycle(cycle.id);
      toast.success("Cycle archived");
      navigate("/cultivation/cycles");
    } catch (e: any) { toast.error(e?.message ?? "Archive failed"); }
  };

  // Board-card wrapping for the Harvest modal
  const boardCardProxy = useMemo(() => {
    if (!cycle) return null;
    // HarvestModal expects a HydratedBoardCard. We synthesize one here so the
    // modal works even when the cycle isn't currently visible on the Grow Board.
    return {
      card: { id: "cycle-harvest-synth", column_name: "flowering" as const, entity_type: "grow_cycle" as const, entity_id: cycle.id, sort_order: 0, notes: null, created_at: "", updated_at: "" },
      column: "flowering" as const,
      entityId: cycle.id,
      entityType: "grow_cycle" as const,
      entity: cycle,
      strain: cycle.strain as any,
      area: cycle.area as any,
      extras: { plant_count: plants.filter((p) => !["destroyed", "harvested"].includes(p.phase)).length },
    };
  }, [cycle, plants]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={cycle.name}
        breadcrumbs={[
          { label: "Cultivation" },
          { label: "Grow Cycles", to: "/cultivation/cycles" },
          { label: cycle.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PhaseColorBadge phase={cycle.phase ?? "default"} label={cycle.phase ? PHASE_LABELS[cycle.phase as CyclePhase] : undefined} />
            {canAdvanceTo.length > 0 && (
              <DropdownMenu open={phasePickerOpen} onOpenChange={setPhasePickerOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1.5" title="Phase change (P)">
                    <ArrowUpDown className="w-3.5 h-3.5" /> Phase Change
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canAdvanceTo.map((p) => (
                    <DropdownMenuItem key={p} onClick={() => handlePhaseChange(p)}>
                      → {PHASE_LABELS[p]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {cycle.phase === "flowering" && (
              <Button variant="outline" onClick={() => setHarvestOpen(true)} className="gap-1.5" title="Harvest (H)">
                <Scissors className="w-3.5 h-3.5" /> Harvest
              </Button>
            )}
            <Button variant="outline" disabled className="gap-1.5" title="Coming soon">
              <Plus className="w-3.5 h-3.5" /> Add Plants
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5" title="Edit (E)">
              <Edit className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button variant="outline" onClick={() => setAiEditOpen(true)} className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Edit with Cody
            </Button>
            <Button variant="outline" onClick={handleArchive} className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10">
              <Archive className="w-3.5 h-3.5" /> Archive
            </Button>
          </div>
        }
      />

      {/* Hero subtitle: strain + area + age */}
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-6 -mt-4 flex-wrap">
        {cycle.strain && (
          <button onClick={() => navigate(`/cultivation/strains/${cycle.strain!.id}`)} className="inline-flex items-center gap-1.5 text-primary hover:underline">
            <Leaf className="w-3.5 h-3.5" />
            {cycle.strain.name}
            {strainType && strainColor && (
              <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", strainColor.bg, strainColor.text)}>
                {strainType}
              </span>
            )}
          </button>
        )}
        {cycle.area && (
          <>
            <span>·</span>
            <button onClick={() => navigate(`/cultivation/areas/${cycle.area!.id}`)} className="inline-flex items-center gap-1 text-primary hover:underline">
              <MapPin className="w-3.5 h-3.5" /> {cycle.area.name}
            </button>
          </>
        )}
        <span>·</span>
        <span className="font-bold text-foreground text-[14px] tabular-nums">Day {ageDays}</span>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <InfoCard icon={Sparkles} label="Phase">
          <PhaseColorBadge phase={cycle.phase ?? "default"} label={cycle.phase ? PHASE_LABELS[cycle.phase as CyclePhase] : undefined} />
          {cycle.start_date && <p className="text-[11px] text-muted-foreground mt-1">Started <DateTime value={cycle.start_date} format="date-only" /></p>}
        </InfoCard>
        <InfoCard icon={Building2} label="Area / Facility">
          {cycle.area ? (
            <button onClick={() => navigate(`/cultivation/areas/${cycle.area!.id}`)} className="text-[13px] font-medium text-primary hover:underline text-left">{cycle.area.name}</button>
          ) : <div className="text-[13px] text-muted-foreground">—</div>}
          {cycle.area?.canopy_sqft != null && <p className="text-[11px] text-muted-foreground">{cycle.area.canopy_sqft} sqft canopy</p>}
        </InfoCard>
        <InfoCard icon={Leaf} label="Plants">
          <button
            onClick={() => navigate(`/cultivation/plants?cycle=${cycle.id}`)}
            className="text-[22px] font-bold font-mono tabular-nums text-foreground hover:text-primary"
          >
            {cycle.active_plant_count ?? 0}
          </button>
          <p className="text-[11px] text-muted-foreground">{cycle.plant_count ?? 0} planned</p>
        </InfoCard>
        <InfoCard icon={Clock} label={cycle.actual_harvest_date ? "Harvested" : "Days to Harvest"}>
          <HarvestCountdown cycle={cycle} />
        </InfoCard>
        <InfoCard icon={TrendingUp} label="Projected Yield">
          {yieldMetrics.g_per_sqft != null ? (
            <>
              <div className="text-[18px] font-bold font-mono tabular-nums text-emerald-500">{yieldMetrics.g_per_sqft.toFixed(1)}</div>
              <p className="text-[11px] text-muted-foreground">g/sqft</p>
            </>
          ) : (
            <>
              <div className="text-[14px] text-muted-foreground">—</div>
              <p className="text-[11px] text-muted-foreground italic">awaits harvest data</p>
            </>
          )}
        </InfoCard>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plants">Plants ({plants.length})</TabsTrigger>
          <TabsTrigger value="environmental">Environmental</TabsTrigger>
          <TabsTrigger value="harvests">Harvests ({harvests.length})</TabsTrigger>
          <TabsTrigger value="yield">Yield Analytics</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><OverviewPanel cycle={cycle} plants={plants} yieldMetrics={yieldMetrics} /></div>
            <div><CycleAIInsights cycleId={cycle.id} phase={cycle.phase} /></div>
          </div>
        </TabsContent>
        <TabsContent value="plants"><PlantsPanel cycleId={cycle.id} plants={plants} /></TabsContent>
        <TabsContent value="environmental"><EnvironmentalPanel cycle={cycle} readings={envReadings} /></TabsContent>
        <TabsContent value="harvests"><HarvestsPanel cycle={cycle} harvests={harvests} onHarvest={() => setHarvestOpen(true)} /></TabsContent>
        <TabsContent value="yield"><YieldAnalyticsPanel cycle={cycle} harvests={harvests} yieldMetrics={yieldMetrics} /></TabsContent>
        <TabsContent value="activity">
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[14px] font-semibold text-foreground mb-1">Activity tracking will populate as changes are made</p>
            <p className="text-[12px] text-muted-foreground">Phase changes, plant additions, and harvests will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CycleFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editing={cycle}
        onSave={async (input) => { const row = await updateCycle(cycle.id, input); refresh(); return row; }}
      />
      <InlineAIEdit
        open={aiEditOpen}
        onClose={() => setAiEditOpen(false)}
        entityType="cycle"
        entity={cycle as unknown as Record<string, unknown>}
        editableFields={["name", "notes", "target_harvest_date", "phase"]}
        onApply={async (_m, patch) => { await updateCycle(cycle.id, patch as any); refresh(); }}
      />
      {harvestOpen && boardCardProxy && (
        <HarvestModal
          open={harvestOpen}
          onClose={() => setHarvestOpen(false)}
          card={boardCardProxy}
          onSuccess={() => { refresh(); navigate("/cultivation/harvests"); }}
        />
      )}
    </div>
  );
}

// ─── Harvest countdown ───────────────────────────────────────────────────────

function HarvestCountdown({ cycle }: { cycle: Cycle }) {
  if (cycle.actual_harvest_date) {
    return (
      <>
        <div className="text-[13px] font-semibold text-emerald-500"><DateTime value={cycle.actual_harvest_date} format="date-only" /></div>
        <p className="text-[11px] text-muted-foreground">actual</p>
      </>
    );
  }
  if (!cycle.target_harvest_date) {
    return <div className="text-[13px] text-muted-foreground">—</div>;
  }
  const target = new Date(cycle.target_harvest_date).getTime();
  const days = Math.round((target - Date.now()) / 86400000);
  const overdue = days < 0;
  return (
    <>
      <div className={cn("text-[18px] font-bold font-mono tabular-nums", overdue ? "text-destructive" : "text-foreground")}>
        {overdue ? `+${Math.abs(days)}` : days}
      </div>
      <p className={cn("text-[11px]", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
        {overdue ? "days overdue" : "days away"}
      </p>
    </>
  );
}

// ─── Overview panel ──────────────────────────────────────────────────────────

function OverviewPanel({ cycle, plants, yieldMetrics }: { cycle: Cycle; plants: any[]; yieldMetrics: ReturnType<typeof useCycleYield> }) {
  const plantStats = usePlantStats(plants);

  // Cycle timeline: horizontal bar with veg / flower / harvest segments
  const start = cycle.start_date ? new Date(cycle.start_date) : null;
  const target = cycle.target_harvest_date ? new Date(cycle.target_harvest_date) : null;
  const actual = cycle.actual_harvest_date ? new Date(cycle.actual_harvest_date) : null;
  const now = new Date();

  // Assume 30d veg baseline — could come from strain in the future
  const vegEnd = start ? new Date(start.getTime() + 30 * 86400000) : null;
  const totalDays = start && (target || actual) ? Math.max(1, Math.round(((actual ?? target)!.getTime() - start.getTime()) / 86400000)) : null;
  const elapsedDays = start ? Math.round((now.getTime() - start.getTime()) / 86400000) : 0;
  const progressPct = totalDays ? Math.min(100, (elapsedDays / totalDays) * 100) : 0;

  // Losses: plants destroyed + harvested vs starting plant_count
  const startCount = cycle.plant_count ?? plants.length;
  const lost = plants.filter((p) => p.ccrs_plant_state === "Destroyed").length;
  const harvestedCount = plants.filter((p) => p.ccrs_plant_state === "Harvested").length;
  const lossPct = startCount > 0 ? (lost / startCount) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Timeline bar */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold text-foreground">Cycle Timeline</h3>
            {totalDays != null && (
              <span className="text-[11px] text-muted-foreground">Day {elapsedDays} of {totalDays}</span>
            )}
          </div>
          <div className="relative h-8 rounded-full bg-muted overflow-hidden">
            {/* Veg segment (emerald) */}
            <div className="absolute inset-y-0 left-0 bg-emerald-500/30 border-r border-background" style={{ width: `${totalDays && vegEnd ? Math.min(100, (30 / totalDays) * 100) : 33}%` }} />
            {/* Flower segment (purple) — after veg */}
            <div className="absolute inset-y-0 bg-purple-500/30" style={{ left: `${totalDays && vegEnd ? Math.min(100, (30 / totalDays) * 100) : 33}%`, right: 0 }} />
            {/* Actual progress bar overlay */}
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/70 to-primary" style={{ width: `${progressPct}%` }} />
            {/* "Today" marker */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-foreground" style={{ left: `${progressPct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
            <span className="font-mono">{start ? start.toLocaleDateString() : "—"}</span>
            <span className="font-mono text-emerald-500">veg</span>
            <span className="font-mono text-purple-500">flower</span>
            <span className="font-mono">{(actual ?? target)?.toLocaleDateString() ?? "—"}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/20">
            <h3 className="text-[13px] font-semibold text-foreground">Cycle Stats</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
            <Stat label="Days total" value={totalDays != null ? `${totalDays}d` : "—"} />
            <Stat label="Days in flower" value={cycle.phase === "flowering" || cycle.phase === "harvesting" || cycle.phase === "completed" ? `${Math.max(0, elapsedDays - 30)}d` : "—"} />
            <Stat label="Plants started" value={String(startCount)} />
            <Stat label="Active plants" value={String(plantStats.total - plantStats.destroyed - plantStats.harvested)} />
            <Stat label="Harvested" value={String(harvestedCount)} />
            <Stat label="Lost" value={`${lost} (${lossPct.toFixed(0)}%)`} highlight={lost > 0 ? "text-destructive" : undefined} />
            <Stat label="Projected g/sqft" value={yieldMetrics.g_per_sqft != null ? yieldMetrics.g_per_sqft.toFixed(1) : "—"} />
            <Stat label="Total dry weight" value={yieldMetrics.total_dry_g != null ? `${yieldMetrics.total_dry_g.toFixed(0)}g` : "—"} />
          </div>
        </div>

        {cycle.notes && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-[13px] font-semibold text-foreground mb-2">Notes</h3>
            <p className="text-[12px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{cycle.notes}</p>
          </div>
        )}
      </div>

      <div className="lg:col-span-1 space-y-4">
        <CodyInsightsPanel />
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <h4 className="text-[12px] font-semibold text-foreground">Ask Cody</h4>
          </div>
          <div className="space-y-1.5">
            {[
              `How is ${cycle.name} tracking vs the strain's historical average?`,
              "Any environmental issues during this cycle so far?",
              "What's the projected final yield?",
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  window.dispatchEvent(new Event("open-cody-chat"));
                  window.dispatchEvent(new CustomEvent("cody-prefill", { detail: q }));
                }}
                className="w-full text-left text-[11px] text-muted-foreground hover:text-primary hover:bg-accent/50 rounded p-2 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="bg-card p-4">
      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-[18px] font-bold font-mono tabular-nums mt-0.5", highlight ?? "text-foreground")}>{value}</p>
    </div>
  );
}

// ─── Plants panel ────────────────────────────────────────────────────────────

function PlantsPanel({ cycleId, plants }: { cycleId: string; plants: any[] }) {
  const navigate = useNavigate();

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "plant_identifier",
      header: "Plant ID",
      cell: ({ row }) => (
        <button onClick={() => navigate(`/cultivation/plants/${row.original.id}`)} className="font-mono text-[12px] text-primary hover:underline">
          {row.original.plant_identifier ?? row.original.id.slice(0, 8)}
        </button>
      ),
    },
    {
      id: "phase", header: "Phase",
      cell: ({ row }) => <PhaseColorBadge phase={row.original.phase ?? "default"} />,
    },
    {
      id: "age", header: "Age",
      cell: ({ row }) => {
        const d = Math.floor((Date.now() - new Date(row.original.created_at).getTime()) / 86400000);
        return <span className="font-mono text-[12px]">{d}d</span>;
      },
    },
    {
      id: "pheno", header: "Phenotype",
      cell: ({ row }) => row.original.phenotype
        ? <span className="font-mono text-[11px]">{row.original.phenotype.pheno_number}</span>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "mother", header: "Mother",
      cell: ({ row }) => row.original.mother_plant
        ? <button onClick={() => navigate(`/cultivation/plants/${row.original.mother_plant.id}`)} className="font-mono text-[11px] text-primary hover:underline">{row.original.mother_plant.plant_identifier ?? row.original.mother_plant.id.slice(0, 8)}</button>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
  ];

  if (plants.length === 0) {
    return (
      <EmptyState
        icon={Leaf}
        title="No plants in this cycle yet"
        description="Plants get attached to a cycle when you promote sources on the Grow Board, or edit a plant and assign it here."
        primaryAction={<Button variant="outline" onClick={() => navigate(`/cultivation/plants?cycle=${cycleId}`)}>Go to filtered Plants →</Button>}
      />
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">
          <span className="font-semibold text-foreground">{plants.length}</span> plants in this cycle —
          bulk operations available from the <button onClick={() => navigate(`/cultivation/plants?cycle=${cycleId}`)} className="text-primary hover:underline">Plants page</button>
        </p>
      </div>
      <DataTable columns={columns} data={plants} />
    </div>
  );
}

// ─── Environmental correlation panel ─────────────────────────────────────────

function EnvironmentalPanel({ cycle, readings }: { cycle: Cycle; readings: any[] }) {
  const navigate = useNavigate();

  const startDate = cycle.start_date ? new Date(cycle.start_date) : null;
  const endDate = cycle.actual_harvest_date ? new Date(cycle.actual_harvest_date) : new Date();

  // Compute averages during the cycle window
  const averages = useMemo(() => {
    if (readings.length === 0) return null;
    const agg = { temp: 0, hum: 0, vpd: 0, co2: 0, counts: { temp: 0, hum: 0, vpd: 0, co2: 0 } };
    readings.forEach((r) => {
      if (r.temperature_f != null) { agg.temp += Number(r.temperature_f); agg.counts.temp++; }
      if (r.humidity_pct != null) { agg.hum += Number(r.humidity_pct); agg.counts.hum++; }
      if (r.vpd != null) { agg.vpd += Number(r.vpd); agg.counts.vpd++; }
      if (r.co2_ppm != null) { agg.co2 += Number(r.co2_ppm); agg.counts.co2++; }
    });
    return {
      temp: agg.counts.temp > 0 ? agg.temp / agg.counts.temp : null,
      hum: agg.counts.hum > 0 ? agg.hum / agg.counts.hum : null,
      vpd: agg.counts.vpd > 0 ? agg.vpd / agg.counts.vpd : null,
      co2: agg.counts.co2 > 0 ? agg.co2 / agg.counts.co2 : null,
    };
  }, [readings]);

  if (!cycle.area_id) {
    return (
      <EmptyState
        icon={MapPin}
        title="No area assigned"
        description="Environmental data is tracked per area. Edit this cycle to assign it to an area."
      />
    );
  }

  if (readings.length === 0) {
    return (
      <EmptyState
        icon={Thermometer}
        title="No environmental data during this cycle"
        description={`No sensor readings for ${cycle.area?.name ?? "this area"} between ${startDate?.toLocaleDateString() ?? "—"} and ${endDate.toLocaleDateString()}. Assign sensors in Equipment settings.`}
        primaryAction={<Button variant="outline" onClick={() => navigate(`/cultivation/areas/${cycle.area_id}?tab=environment`)}>Go to Area Environment →</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{readings.length}</span> readings from{" "}
          <button onClick={() => navigate(`/cultivation/areas/${cycle.area_id}`)} className="text-primary hover:underline">{cycle.area?.name}</button>{" "}
          between {startDate?.toLocaleDateString() ?? "—"} and {endDate.toLocaleDateString()}
        </p>
      </div>

      {/* Cycle averages */}
      {averages && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <AvgCard icon={Thermometer} color="text-red-500" label="Avg Temp" value={averages.temp != null ? `${averages.temp.toFixed(1)}°F` : "—"} />
          <AvgCard icon={Droplets} color="text-blue-500" label="Avg Humidity" value={averages.hum != null ? `${averages.hum.toFixed(1)}%` : "—"} />
          <AvgCard icon={Wind} color="text-teal-500" label="Avg VPD" value={averages.vpd != null ? `${averages.vpd.toFixed(2)} kPa` : "—"} />
          <AvgCard icon={Gauge} color="text-emerald-500" label="Avg CO₂" value={averages.co2 != null ? `${averages.co2.toFixed(0)} ppm` : "—"} />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EnvironmentChart data={readings} metric="temperature" targetRange={{ min: null, max: null }} timeRange="30d" />
        <EnvironmentChart data={readings} metric="humidity" targetRange={{ min: null, max: null }} timeRange="30d" />
        <EnvironmentChart data={readings} metric="vpd" targetRange={{ min: null, max: null }} timeRange="30d" />
        <EnvironmentChart data={readings} metric="co2" targetRange={{ min: null, max: null }} timeRange="30d" />
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-2 text-[12px]">
        <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
        <p className="text-foreground">
          <span className="font-semibold">Cross-cycle correlation</span> — once this strain has multiple completed cycles with yield data,
          Cody will compare average environmental conditions per cycle to yield outcomes and surface "best cycle" patterns here.
        </p>
      </div>
    </div>
  );
}

function AvgCard({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-[18px] font-bold font-mono tabular-nums text-foreground">{value}</div>
    </div>
  );
}

// ─── Harvests panel ──────────────────────────────────────────────────────────

function HarvestsPanel({ cycle, harvests, onHarvest }: { cycle: Cycle; harvests: any[]; onHarvest: () => void }) {
  const navigate = useNavigate();

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "name", header: "Harvest",
      cell: ({ row }) => (
        <button onClick={() => navigate(`/cultivation/harvests/${row.original.id}`)} className="text-[13px] font-medium text-primary hover:underline text-left">
          {row.original.name ?? row.original.id.slice(0, 8)}
        </button>
      ),
    },
    { accessorKey: "harvest_started_at", header: "Date", cell: ({ row }) => row.original.harvest_started_at ? <DateTime value={row.original.harvest_started_at} format="date-only" className="text-[12px]" /> : "—" },
    { accessorKey: "total_plants_harvested", header: "Plants", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.total_plants_harvested ?? "—"}</span> },
    { accessorKey: "wet_weight_grams", header: "Wet", cell: ({ row }) => row.original.wet_weight_grams != null ? <span className="font-mono text-[12px]">{Number(row.original.wet_weight_grams).toFixed(0)}g</span> : "—" },
    { accessorKey: "dry_weight_grams", header: "Dry", cell: ({ row }) => row.original.dry_weight_grams != null ? <span className="font-mono text-[12px]">{Number(row.original.dry_weight_grams).toFixed(0)}g</span> : "—" },
    { accessorKey: "waste_weight_grams", header: "Waste", cell: ({ row }) => row.original.waste_weight_grams != null ? <span className="font-mono text-[12px]">{Number(row.original.waste_weight_grams).toFixed(0)}g</span> : "—" },
    {
      id: "yield", header: "Yield %",
      cell: ({ row }) => {
        const wet = Number(row.original.wet_weight_grams ?? 0);
        const dry = Number(row.original.dry_weight_grams ?? 0);
        if (wet <= 0 || dry <= 0) return <span className="text-muted-foreground text-[12px]">—</span>;
        const pct = (dry / wet) * 100;
        return <span className={cn("font-mono text-[12px] font-semibold", pct > 28 ? "text-emerald-500" : pct < 18 ? "text-amber-500" : "text-foreground")}>{pct.toFixed(1)}%</span>;
      },
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium capitalize">{HARVEST_STATUS_LABELS[row.original.status as HarvestStatus] ?? row.original.status ?? "—"}</span> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">
          {harvests.length === 0 ? "No harvests yet" : `${harvests.length} harvest${harvests.length === 1 ? "" : "s"} recorded`}
        </p>
        {cycle.phase === "flowering" && (
          <Button onClick={onHarvest} className="gap-1.5">
            <Scissors className="w-3.5 h-3.5" /> Harvest This Cycle
          </Button>
        )}
      </div>
      {harvests.length === 0 ? (
        <EmptyState
          icon={Scissors}
          title="No harvests yet"
          description="Harvests are created from the Grow Board or by clicking Harvest above when a cycle is ready."
          primaryAction={cycle.phase === "flowering" ? <Button onClick={onHarvest} className="gap-1.5"><Scissors className="w-3.5 h-3.5" /> Harvest Now</Button> : undefined}
        />
      ) : (
        <DataTable columns={columns} data={harvests} />
      )}
    </div>
  );
}

// ─── Yield analytics panel ───────────────────────────────────────────────────

function YieldAnalyticsPanel({ cycle, harvests, yieldMetrics }: { cycle: Cycle; harvests: any[]; yieldMetrics: ReturnType<typeof useCycleYield> }) {
  const [strainAverages, setStrainAverages] = useState<{ avg: number | null; best: number | null } | null>(null);

  useEffect(() => {
    if (!cycle.strain_id) return;
    (async () => {
      // Look up other completed cycles of the same strain with dry weight data
      const { data: otherCycles } = await supabase
        .from("grow_cycles")
        .select("id, plant_count")
        .eq("org_id", cycle.org_id)
        .eq("strain_id", cycle.strain_id)
        .eq("phase", "completed")
        .neq("id", cycle.id);
      const cycleIds = (otherCycles ?? []).map((c: any) => c.id);
      if (cycleIds.length === 0) { setStrainAverages({ avg: null, best: null }); return; }
      const { data: otherHarvests } = await supabase
        .from("grow_harvests")
        .select("grow_cycle_id, dry_weight_grams")
        .in("grow_cycle_id", cycleIds);
      const perCycle = new Map<string, number>();
      (otherHarvests ?? []).forEach((h: any) => {
        if (h.dry_weight_grams == null) return;
        perCycle.set(h.grow_cycle_id, (perCycle.get(h.grow_cycle_id) ?? 0) + Number(h.dry_weight_grams));
      });
      const yields = Array.from(perCycle.values());
      if (yields.length === 0) { setStrainAverages({ avg: null, best: null }); return; }
      const avg = yields.reduce((a, b) => a + b, 0) / yields.length;
      const best = Math.max(...yields);
      setStrainAverages({ avg, best });
    })();
  }, [cycle.id, cycle.strain_id, cycle.org_id]);

  if (harvests.length === 0 || yieldMetrics.total_dry_g == null) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Yield analytics available after harvest"
        description="Once this cycle has harvest records with dry weights, you'll see total dry, g/sqft, g/plant, g/day, and comparisons to other cycles of this strain."
      />
    );
  }

  const compareData = [
    { label: "This cycle", value: yieldMetrics.total_dry_g ?? 0, color: "hsl(var(--primary))" },
    ...(strainAverages?.avg != null ? [{ label: "Strain avg", value: strainAverages.avg, color: "#6B7280" }] : []),
    ...(strainAverages?.best != null ? [{ label: "Best ever", value: strainAverages.best, color: "#10B981" }] : []),
  ];

  const thisVsAvg = strainAverages?.avg != null ? ((yieldMetrics.total_dry_g ?? 0) / strainAverages.avg) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <YieldStat label="Total Dry" value={`${yieldMetrics.total_dry_g?.toFixed(0)}g`} accent="stat-accent-emerald" />
        <YieldStat label="g/sqft" value={yieldMetrics.g_per_sqft != null ? yieldMetrics.g_per_sqft.toFixed(1) : "—"} accent="stat-accent-teal" />
        <YieldStat label="g/plant" value={yieldMetrics.g_per_plant != null ? yieldMetrics.g_per_plant.toFixed(0) : "—"} accent="stat-accent-blue" />
        <YieldStat label="g/day" value={yieldMetrics.g_per_day != null ? yieldMetrics.g_per_day.toFixed(1) : "—"} accent="stat-accent-purple" />
        <YieldStat label="Dry/Wet" value={yieldMetrics.dry_wet_ratio != null ? `${yieldMetrics.dry_wet_ratio.toFixed(1)}%` : "—"} accent="stat-accent-amber" />
      </div>

      {compareData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-[13px] font-semibold text-foreground mb-4">Comparison</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compareData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} label={{ value: "grams", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid var(--glass-border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {compareData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {thisVsAvg != null && (
            <p className="text-[12px] text-muted-foreground mt-3 text-center">
              This cycle is <span className={cn("font-bold", thisVsAvg > 110 ? "text-emerald-500" : thisVsAvg < 90 ? "text-amber-500" : "text-foreground")}>{thisVsAvg.toFixed(0)}%</span> of the strain's average yield
              {strainAverages?.best && (yieldMetrics.total_dry_g ?? 0) > strainAverages.best * 0.99 && <> · 🏆 <span className="text-emerald-500 font-semibold">new personal best</span></>}
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-border bg-card p-5 flex items-start gap-2 text-[12px]">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        <div>
          <span className="font-semibold text-foreground">Cost per gram</span> coming soon — once time-clock entries are tied to cycles, we'll divide labor + input costs by total dry weight.
        </div>
      </div>
    </div>
  );
}

function YieldStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return <StatCard label={label} value={value} accentClass={accent} />;
}

function InfoCard({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

void Flower2; void CheckCircle2; void ScrollText; void Ruler;
