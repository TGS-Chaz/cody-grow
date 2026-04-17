import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Leaf, Edit, Trash2, ArrowUpDown, MapPin, GitFork, Loader2, MoreHorizontal,
  Sprout, ScrollText, Ruler, ListTodo, Activity, ArrowLeft, Sparkles,
  Building2, Package, Scissors, Camera, Plus, CheckCircle2, Clock,
  AlertTriangle, Thermometer, Droplets, Wind, Gauge, Send, Printer,
  FileDown, ShieldAlert,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import PhaseColorBadge from "@/components/shared/PhaseColorBadge";
import StatusPill from "@/components/shared/StatusPill";
import CopyableId from "@/components/shared/CopyableId";
import BarcodeRenderer from "@/components/shared/BarcodeRenderer";
import DateTime from "@/components/shared/DateTime";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import PlantTimeline from "@/components/shared/PlantTimeline";
import EnvironmentChart from "@/components/shared/EnvironmentChart";
import CodyInsightsPanel from "@/components/cody/CodyInsightsPanel";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  usePlant, usePlants, usePlantChildren, usePlantGrowLogs, usePlantTasks,
  usePlantMeasurements, useDesignateMother, useCreateMeasurement,
  Plant, PlantInput,
  MEASUREMENT_TYPES, MEASUREMENT_TYPE_LABELS, MEASUREMENT_UNITS,
  GROW_LOG_TYPES, GROW_LOG_TYPE_LABELS,
} from "@/hooks/usePlants";
import { useAreaEnvironment } from "@/hooks/useAreas";
import { supabase } from "@/lib/supabase";
import {
  CCRS_GROWTH_STAGES, CcrsGrowthStage,
  CCRS_PLANT_STATES, CcrsPlantState,
  PlantPhase, StrainType, STRAIN_TYPE_COLORS,
  SOURCE_TYPE_COLORS, SourceType, SOURCE_TYPE_LABELS,
} from "@/lib/schema-enums";
import PlantFormModal from "./PlantFormModal";
import PlantPhaseChangeModal from "./PlantPhaseChangeModal";
import DestroyPlantModal from "./DestroyPlantModal";
import MoveToAreaModal from "./MoveToAreaModal";
import SourceFormModal from "./SourceFormModal";
import AddGrowLogModal from "./AddGrowLogModal";
import { cn } from "@/lib/utils";

const PLANT_STATE_VARIANT: Record<CcrsPlantState, "success" | "warning" | "muted" | "critical" | "info"> = {
  Growing: "success",
  Drying: "warning",
  PartiallyHarvested: "warning",
  Harvested: "warning",
  Quarantined: "info",
  Destroyed: "critical",
  Inventory: "muted",
  Sold: "muted",
};

function plantPhaseKey(p: Plant): string {
  if (p.ccrs_plant_state === "Destroyed") return "destroyed";
  if (p.ccrs_plant_state === "Harvested") return "harvested";
  if (p.ccrs_plant_state === "Drying") return "drying";
  if (p.ccrs_growth_stage === "Flowering") return "flowering";
  if (p.ccrs_growth_stage === "Vegetative") return "vegetative";
  if (p.ccrs_growth_stage === "Immature") return "immature";
  return "default";
}

export default function PlantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const setActiveTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const { data: plant, loading, refresh } = usePlant(id);
  const { updatePlant } = usePlants({});
  const designateMother = useDesignateMother();
  const { data: children } = usePlantChildren(id);

  const [editOpen, setEditOpen] = useState(false);
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [destroyOpen, setDestroyOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [addLogOpen, setAddLogOpen] = useState(false);
  const [takeClonesOpen, setTakeClonesOpen] = useState(false);
  const [motherConfirmOpen, setMotherConfirmOpen] = useState(false);

  const modalOpen = editOpen || phaseOpen || destroyOpen || moveOpen || addLogOpen || takeClonesOpen || motherConfirmOpen;

  // ─── Cody context ────────────────────────────────────────────────────────
  const { setContext, clearContext } = useCodyContext();
  const sig = plant ? `${plant.id}:${plant.updated_at}:${children.length}` : "";
  const codyPayload = useMemo(() => {
    if (!plant) return null;
    return {
      plant: {
        id: plant.plant_identifier,
        strain: plant.strain?.name,
        area: plant.area?.name,
        stage: plant.ccrs_growth_stage,
        state: plant.ccrs_plant_state,
        is_mother: plant.is_mother_plant,
        source: plant.source_type,
        age_days: Math.floor((Date.now() - new Date(plant.created_at).getTime()) / 86400000),
      },
      lineage: {
        mother_plant: (plant as any).mother_plant?.plant_identifier,
        children_count: children.length,
        source: plant.source?.external_id,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (!plant || !codyPayload) return;
    setContext({ context_type: "plant_detail", context_id: plant.id, page_data: codyPayload });
    return () => clearContext();
  }, [setContext, clearContext, codyPayload, plant?.id]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────
  useShortcut(["e"], () => setEditOpen(true), { description: "Edit plant", scope: "Plant Detail", enabled: !!plant && !modalOpen });
  useShortcut(["p"], () => setPhaseOpen(true), { description: "Phase change", scope: "Plant Detail", enabled: !!plant && !modalOpen });
  useShortcut(["l"], () => setAddLogOpen(true), { description: "Add log entry", scope: "Plant Detail", enabled: !!plant && !modalOpen });
  useShortcut(["t"], () => { if (plant?.is_mother_plant) setTakeClonesOpen(true); }, { description: "Take clones", scope: "Plant Detail", enabled: !!plant?.is_mother_plant && !modalOpen });
  useShortcut(["Backspace"], () => navigate("/cultivation/plants"), { description: "Back to plants", scope: "Plant Detail", enabled: !!plant && !modalOpen });

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!plant) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState
          icon={Leaf}
          title="Plant not found"
          description="This plant may have been archived, destroyed, or doesn't exist."
          primaryAction={<Button onClick={() => navigate("/cultivation/plants")}>← Back to plants</Button>}
        />
      </div>
    );
  }

  const motherPlant = (plant as any).mother_plant as { id: string; plant_identifier: string | null } | null;
  const strainType = plant.strain?.type as StrainType | null;
  const strainColor = strainType ? STRAIN_TYPE_COLORS[strainType] : null;
  const sourceColor = plant.source_type ? SOURCE_TYPE_COLORS[plant.source_type as SourceType] : null;
  const ageDays = Math.floor((Date.now() - new Date(plant.created_at).getTime()) / 86400000);

  const handleSaveEdit = async (input: PlantInput) => {
    const row = await updatePlant(plant.id, input);
    refresh();
    return row;
  };

  const handleMotherToggle = async (confirmed: boolean) => {
    if (!confirmed) { setMotherConfirmOpen(false); return; }
    try {
      await designateMother(plant.id, !plant.is_mother_plant);
      toast.success(
        plant.is_mother_plant ? "Mother status removed" : "Designated as mother",
        plant.is_mother_plant
          ? undefined
          : { action: { label: "Take Clones →", onClick: () => { refresh(); setTimeout(() => setTakeClonesOpen(true), 100); } } },
      );
      setMotherConfirmOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={
          // Plant identifier is the hero — render it inline with the CopyableId so it stays copyable
          (plant.plant_identifier ?? plant.external_id) as string
        }
        breadcrumbs={[
          { label: "Cultivation" },
          { label: "Plants", to: "/cultivation/plants" },
          { label: plant.plant_identifier ?? plant.id.slice(0, 8) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PhaseColorBadge phase={plantPhaseKey(plant)} />
            {plant.is_mother_plant && (
              <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-teal-500/15 text-teal-500">
                <GitFork className="w-3 h-3" /> Mother
              </span>
            )}
            <Button variant="outline" onClick={() => setPhaseOpen(true)} className="gap-1.5" title="Phase change (P)">
              <ArrowUpDown className="w-3.5 h-3.5" /> Phase Change
            </Button>
            <Button variant="outline" onClick={() => setMoveOpen(true)} className="gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Move Area
            </Button>
            <Button
              variant="outline"
              onClick={() => setMotherConfirmOpen(true)}
              className={cn("gap-1.5", plant.is_mother_plant ? "text-teal-500 border-teal-500/40" : "")}
            >
              <GitFork className="w-3.5 h-3.5" />
              {plant.is_mother_plant ? "Remove Mother" : "Designate Mother"}
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5" title="Edit (E)">
              <Edit className="w-3.5 h-3.5" /> Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="w-9 h-9">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDestroyOpen(true)} className="text-destructive">
                  <Trash2 className="w-3.5 h-3.5" /> Destroy
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <ShieldAlert className="w-3.5 h-3.5" /> Quarantine (soon)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <Send className="w-3.5 h-3.5" /> Transfer (soon)
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Printer className="w-3.5 h-3.5" /> Print Tag (soon)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Hero subtitle with copyable id + strain */}
      <div className="flex items-center gap-3 mb-6 -mt-4 flex-wrap">
        <CopyableId value={plant.plant_identifier ?? plant.external_id} />
        <BarcodeRenderer value={plant.plant_identifier ?? plant.external_id} format="code128" height={40} showText={false} />
        {plant.strain && (
          <>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={() => navigate(`/cultivation/strains/${plant.strain!.id}`)}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
            >
              <Leaf className="w-3.5 h-3.5" />
              {plant.strain.name}
              {strainType && strainColor && (
                <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", strainColor.bg, strainColor.text)}>
                  {strainType}
                </span>
              )}
            </button>
          </>
        )}
        <span className="text-muted-foreground">·</span>
        <span className="text-[14px] font-bold text-foreground tabular-nums">Day {ageDays}</span>
        <span className="text-[11px] text-muted-foreground">since created</span>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <InfoCard icon={Sprout} label="Phase">
          <div className="flex items-center gap-1.5 mt-0.5">
            <PhaseColorBadge phase={plantPhaseKey(plant)} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">{plant.ccrs_growth_stage ?? "—"} · {plant.ccrs_plant_state ?? "—"}</p>
        </InfoCard>
        <InfoCard icon={MapPin} label="Location">
          {plant.area ? (
            <button onClick={() => navigate(`/cultivation/areas/${plant.area!.id}`)} className="text-[13px] font-medium text-primary hover:underline text-left">
              {plant.area.name}
            </button>
          ) : <div className="text-[13px] text-muted-foreground">—</div>}
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Building2 className="w-3 h-3" /> Facility
          </div>
        </InfoCard>
        <InfoCard icon={ScrollText} label="Cycle">
          {plant.cycle ? (
            <button onClick={() => navigate(`/cultivation/grow-cycles/${plant.cycle!.id}`)} className="text-[13px] font-medium text-primary hover:underline text-left truncate max-w-[160px]">
              {plant.cycle.name ?? plant.cycle.id.slice(0, 8)}
            </button>
          ) : <div className="text-[13px] text-muted-foreground italic">Unassigned</div>}
          {plant.cycle?.phase && <div className="text-[11px] text-muted-foreground capitalize">{plant.cycle.phase.replaceAll("_", " ")}</div>}
        </InfoCard>
        <InfoCard icon={Sprout} label="Source">
          <div className="flex items-center gap-1.5 mt-0.5">
            {sourceColor && plant.source_type && (
              <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium", sourceColor.bg, sourceColor.text)}>
                {SOURCE_TYPE_LABELS[plant.source_type as SourceType]}
              </span>
            )}
            {plant.source && (
              <button onClick={() => navigate(`/cultivation/sources/${plant.source!.id}`)} className="text-[11px] text-primary hover:underline font-mono">
                {plant.source.external_id.slice(-6)}
              </button>
            )}
          </div>
          {!plant.source && <p className="text-[11px] text-muted-foreground italic">Manual entry</p>}
        </InfoCard>
        <InfoCard icon={Clock} label="Harvest Cycle">
          {plant.harvest_cycle_months ? (
            <div className="text-[13px] font-semibold text-foreground font-mono">{plant.harvest_cycle_months} <span className="text-[11px] font-normal text-muted-foreground">months</span></div>
          ) : <div className="text-[13px] text-muted-foreground">—</div>}
        </InfoCard>
      </div>

      {/* Phase timeline */}
      <div className="mb-6">
        <PlantTimeline
          phase={plant.phase as PlantPhase | null}
          plantState={plant.ccrs_plant_state as CcrsPlantState | null}
          growthStage={plant.ccrs_growth_stage as CcrsGrowthStage | null}
          createdAt={plant.created_at}
          phaseChangedAt={plant.phase_changed_at}
          harvestDate={plant.harvest_date}
          destroyedAt={plant.destroyed_at}
          averageFlowerDays={null /* could fetch strain.average_flower_days — usePlant doesn't currently */}
          averageVegDays={null}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="growth_log">Growth Log</TabsTrigger>
          <TabsTrigger value="environmental">Environmental</TabsTrigger>
          <TabsTrigger value="measurements">Measurements</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          {plant.is_mother_plant && (
            <TabsTrigger value="children">Children ({children.length})</TabsTrigger>
          )}
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewPanel plant={plant} children={children} onAskCody={(q) => { window.dispatchEvent(new Event("open-cody-chat")); window.dispatchEvent(new CustomEvent("cody-prefill", { detail: q })); }} /></TabsContent>
        <TabsContent value="growth_log"><GrowthLogPanel plant={plant} onAdd={() => setAddLogOpen(true)} /></TabsContent>
        <TabsContent value="environmental"><EnvironmentalPanel plant={plant} /></TabsContent>
        <TabsContent value="measurements"><MeasurementsPanel plant={plant} /></TabsContent>
        <TabsContent value="tasks"><TasksPanel plant={plant} /></TabsContent>
        {plant.is_mother_plant && (
          <TabsContent value="children"><ChildrenPanel plant={plant} children={children} onTakeClones={() => setTakeClonesOpen(true)} /></TabsContent>
        )}
        <TabsContent value="activity">
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[14px] font-semibold text-foreground mb-1">Activity tracking will populate as changes are made</p>
            <p className="text-[12px] text-muted-foreground">Phase changes, area moves, and other audit events will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <PlantFormModal open={editOpen} onClose={() => setEditOpen(false)} editing={plant} onSave={handleSaveEdit} />
      <PlantPhaseChangeModal
        open={phaseOpen}
        onClose={() => setPhaseOpen(false)}
        plants={[plant]}
        onSuccess={() => refresh()}
      />
      <DestroyPlantModal
        open={destroyOpen}
        onClose={() => setDestroyOpen(false)}
        plants={[plant]}
        onSuccess={() => { refresh(); navigate("/cultivation/plants"); }}
      />
      <MoveToAreaModal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        plants={[plant]}
        onSuccess={() => refresh()}
      />
      <AddGrowLogModal
        open={addLogOpen}
        onClose={() => setAddLogOpen(false)}
        plantId={plant.id}
        onSuccess={() => refresh()}
      />
      {plant.strain && (
        <SourceFormModal
          open={takeClonesOpen}
          onClose={() => setTakeClonesOpen(false)}
          onSave={async (input) => {
            // Hit the same grow_sources insert path that useSources.createSource
            // uses — we can't call a hook inline so we write directly. The
            // form already wired the locked mother/strain/type fields.
            const { data: row, error } = await supabase.from("grow_sources").insert({
              org_id: plant.org_id,
              external_id: `CLONE-${Date.now()}`,
              source_type: "clone",
              strain_id: input.strain_id,
              area_id: input.area_id,
              mother_plant_id: input.mother_plant_id ?? plant.id,
              initial_quantity: input.quantity,
              current_quantity: input.quantity,
              cut_date: input.date,
              status: "available",
              notes: input.notes,
              is_rooted: input.is_rooted ?? false,
              rooting_medium: input.rooting_medium,
              health_rating: input.health_rating,
            }).select("*").single();
            if (error) throw error;
            // Also upsert a Grow Sources board card so the new clones appear on the Board
            await supabase.from("grow_board_cards").upsert({
              org_id: plant.org_id,
              column_name: "grow_sources",
              entity_type: "grow_source",
              entity_id: row.id,
              sort_order: 0,
            }, { onConflict: "column_name,entity_type,entity_id" });
            toast.success(`${input.quantity} clones recorded from ${plant.plant_identifier ?? "this mother"}`, {
              action: { label: "Go to Sources →", onClick: () => navigate("/cultivation/sources") },
            });
            return row as any;
          }}
          initialType="clone"
          initialStrainId={plant.strain_id ?? undefined}
          initialMotherPlantId={plant.id}
          initialAreaId={plant.area_id ?? undefined}
          lockedFields={["source_type", "strain_id", "mother_plant_id"]}
        />
      )}

      {/* Mother designation confirm */}
      {motherConfirmOpen && (
        <MotherConfirmModal
          plant={plant}
          childrenCount={children.length}
          onConfirm={() => handleMotherToggle(true)}
          onCancel={() => setMotherConfirmOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Overview panel ──────────────────────────────────────────────────────────

function OverviewPanel({ plant, children, onAskCody }: { plant: Plant; children: Plant[]; onAskCody: (q: string) => void }) {
  const motherPlant = (plant as any).mother_plant as { id: string; plant_identifier: string | null } | null;
  const pheno = (plant as any).phenotype as { id: string; pheno_number: string; pheno_name: string | null } | null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card title="Plant Info">
          <dl className="divide-y divide-border">
            <Row label="Identifier" value={plant.plant_identifier ? <span className="font-mono font-semibold">{plant.plant_identifier}</span> : <span className="italic text-muted-foreground">—</span>} />
            <Row label="External ID" value={<CopyableId value={plant.external_id} />} />
            <Row label="CCRS Growth Stage" value={plant.ccrs_growth_stage ?? "—"} />
            <Row label="CCRS Plant State" value={plant.ccrs_plant_state ?? "—"} />
            <Row label="Source Type" value={plant.source_type ? (plant.source_type === "tissue_culture" ? "Tissue Culture" : plant.source_type[0].toUpperCase() + plant.source_type.slice(1)) : "—"} />
            <Row label="Harvest Cycle" value={plant.harvest_cycle_months ? `${plant.harvest_cycle_months} months` : "—"} />
            <Row label="Created" value={<DateTime value={plant.created_at} format="full" />} />
            <Row label="Last Phase Change" value={plant.phase_changed_at ? <DateTime value={plant.phase_changed_at} format="full" /> : "—"} />
            {plant.harvest_date && <Row label="Harvest Date" value={<DateTime value={plant.harvest_date} format="date-only" />} />}
            {plant.destroyed_at && <Row label="Destroyed At" value={<DateTime value={plant.destroyed_at} format="full" />} />}
            {plant.destruction_reason && <Row label="Destruction Reason" value={<span className="capitalize">{plant.destruction_reason}</span>} />}
            <Row label="Notes" value={plant.notes ?? "—"} />
          </dl>
        </Card>

        <Card title="Lineage">
          <dl className="divide-y divide-border">
            <Row label="Mother Plant" value={motherPlant ? (
              <a href={`/cultivation/plants/${motherPlant.id}`} className="font-mono text-primary hover:underline">{motherPlant.plant_identifier ?? motherPlant.id.slice(0, 8)}</a>
            ) : plant.source_type === "clone" ? <span className="italic">External / Unknown</span> : <span className="italic">N/A (from seed)</span>} />
            <Row label="Source Batch" value={plant.source ? (
              <a href={`/cultivation/sources/${plant.source.id}`} className="font-mono text-primary hover:underline">{plant.source.external_id}</a>
            ) : <span className="italic">Manual entry</span>} />
            {plant.is_mother_plant && (
              <Row label="Children (clones)" value={
                children.length === 0
                  ? <span className="italic">No clones yet</span>
                  : <span>{children.length} plant{children.length === 1 ? "" : "s"} traced to this mother</span>
              } />
            )}
          </dl>
        </Card>

        {pheno && (
          <Card title={`Phenotype · ${pheno.pheno_number}`}>
            <dl className="divide-y divide-border">
              <Row label="Name" value={pheno.pheno_name ?? "—"} />
              <Row label="Phenotype ID" value={<span className="font-mono">{pheno.id.slice(0, 8)}</span>} />
            </dl>
          </Card>
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
              `What's the ideal VPD for ${plant.strain?.name ?? "this strain"} right now?`,
              plant.is_mother_plant
                ? "When should I take the next round of clones?"
                : "Is this plant on track for a healthy harvest?",
              "Any environmental issues in this plant's area today?",
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onAskCody(q)}
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

// ─── Growth Log panel ────────────────────────────────────────────────────────

function GrowthLogPanel({ plant, onAdd }: { plant: Plant; onAdd: () => void }) {
  const { data: logs, loading } = usePlantGrowLogs(plant.id);
  const [typeFilter, setTypeFilter] = useState<string>("");

  const filtered = useMemo(
    () => typeFilter ? logs.filter((l: any) => l.log_type === typeFilter) : logs,
    [logs, typeFilter],
  );

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setTypeFilter("")}
            className={cn(
              "inline-flex items-center h-7 px-2.5 rounded-full border text-[11px] font-medium transition-colors",
              !typeFilter ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground",
            )}
          >
            All · {logs.length}
          </button>
          {GROW_LOG_TYPES.map((t) => {
            const count = logs.filter((l: any) => l.log_type === t).length;
            if (count === 0) return null;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
                className={cn(
                  "inline-flex items-center h-7 px-2.5 rounded-full border text-[11px] font-medium transition-colors",
                  typeFilter === t ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {GROW_LOG_TYPE_LABELS[t]} · {count}
              </button>
            );
          })}
        </div>
        <Button onClick={onAdd} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Log Entry
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={logs.length === 0 ? "Start documenting this plant's journey" : "No matches"}
          description={logs.length === 0
            ? "Growth logs help you track what works and replicate success. Log observations, techniques, issues, and milestones."
            : "No log entries match the selected type filter."}
          primaryAction={logs.length === 0 ? <Button onClick={onAdd} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> First log entry</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((log: any, i: number) => (
            <LogCard key={log.id} log={log} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogCard({ log, index }: { log: any; index: number }) {
  const typeColor: Record<string, string> = {
    observation: "bg-blue-500/10 text-blue-500",
    measurement: "bg-teal-500/10 text-teal-500",
    technique: "bg-purple-500/10 text-purple-500",
    issue: "bg-red-500/10 text-red-500",
    intervention: "bg-amber-500/10 text-amber-500",
    milestone: "bg-primary/15 text-primary",
    note: "bg-muted text-muted-foreground",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wider", typeColor[log.log_type] ?? typeColor.note)}>
            {log.log_type}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          {log.title && <h4 className="text-[13px] font-semibold text-foreground mb-1">{log.title}</h4>}
          {log.content && <p className="text-[12px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{log.content}</p>}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 mt-2">
            <DateTime value={log.recorded_at} format="full" />
            {Array.isArray(log.photo_urls) && log.photo_urls.length > 0 && (
              <><span>·</span><span className="inline-flex items-center gap-1"><Camera className="w-3 h-3" />{log.photo_urls.length} photo{log.photo_urls.length === 1 ? "" : "s"}</span></>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Environmental panel ─────────────────────────────────────────────────────

function EnvironmentalPanel({ plant }: { plant: Plant }) {
  const { data: readings, latest, loading } = useAreaEnvironment(plant.area_id ?? undefined, "7d");
  const navigate = useNavigate();

  if (!plant.area_id) {
    return (
      <EmptyState
        icon={MapPin}
        title="No area assigned"
        description="This plant needs to be in an area before environmental data can be tracked."
      />
    );
  }

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

  if (!latest) {
    return (
      <EmptyState
        icon={Thermometer}
        title="No environmental data available"
        description={`No sensor readings for ${plant.area?.name ?? "this area"}. Assign sensors from Equipment settings.`}
        primaryAction={<Button onClick={() => navigate(`/cultivation/areas/${plant.area_id}?tab=environment`)} variant="outline" className="gap-1.5">Go to Area Environment →</Button>}
      />
    );
  }

  const currentConditions: Array<{ icon: any; label: string; value: string | null; color: string }> = [
    { icon: Thermometer, label: "Temperature", value: latest.temperature_f != null ? `${Number(latest.temperature_f).toFixed(1)}°F` : null, color: "text-red-500" },
    { icon: Droplets, label: "Humidity", value: latest.humidity_pct != null ? `${Number(latest.humidity_pct).toFixed(1)}%` : null, color: "text-blue-500" },
    { icon: Wind, label: "VPD", value: latest.vpd != null ? `${Number(latest.vpd).toFixed(2)} kPa` : null, color: "text-teal-500" },
    { icon: Gauge, label: "CO₂", value: latest.co2_ppm != null ? `${latest.co2_ppm} ppm` : null, color: "text-emerald-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-foreground">
          Conditions in <button onClick={() => navigate(`/cultivation/areas/${plant.area_id}`)} className="text-primary hover:underline">{plant.area?.name}</button>
        </h3>
        <Button variant="outline" size="sm" onClick={() => navigate(`/cultivation/areas/${plant.area_id}?tab=environment`)}>
          View Area Environment →
        </Button>
      </div>

      {/* Current conditions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {currentConditions.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className={cn("w-3.5 h-3.5", c.color)} />
              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{c.label}</span>
            </div>
            <div className="text-[22px] font-bold font-mono tabular-nums text-foreground">{c.value ?? "—"}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Last reading: <DateTime value={latest.recorded_at} format="full" />
      </p>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EnvironmentChart data={readings} metric="temperature" targetRange={{ min: null, max: null }} timeRange="7d" />
        <EnvironmentChart data={readings} metric="humidity" targetRange={{ min: null, max: null }} timeRange="7d" />
        <EnvironmentChart data={readings} metric="vpd" targetRange={{ min: null, max: null }} timeRange="7d" />
        <EnvironmentChart data={readings} metric="co2" targetRange={{ min: null, max: null }} timeRange="7d" />
      </div>
    </div>
  );
}

// ─── Measurements panel ──────────────────────────────────────────────────────

function MeasurementsPanel({ plant }: { plant: Plant }) {
  const { data: measurements, loading, refresh } = usePlantMeasurements(plant.id);
  const createMeasurement = useCreateMeasurement();

  const [type, setType] = useState<typeof MEASUREMENT_TYPES[number]>("height");
  const [value, setValue] = useState<string>("");
  const [unit, setUnit] = useState<typeof MEASUREMENT_UNITS[number]>("in");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) { toast.error("Enter a value"); return; }
    setSaving(true);
    try {
      await createMeasurement({
        plant_id: plant.id,
        type,
        value: Number(value),
        unit,
        notes: notes.trim() || null,
      });
      toast.success("Measurement recorded");
      setValue("");
      setNotes("");
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Chart data — one series per distinct measurement type
  const chartData = useMemo(() => {
    const byType = new Map<string, Array<{ t: number; v: number; unit: string | null }>>();
    measurements.forEach((m) => {
      if (m.value == null) return;
      const arr = byType.get(m.type) ?? [];
      arr.push({ t: new Date(m.recorded_at).getTime(), v: Number(m.value), unit: m.unit });
      byType.set(m.type, arr);
    });
    // Pick the type with the most data points for the chart
    let best: string | null = null;
    let bestCount = 0;
    byType.forEach((arr, k) => { if (arr.length > bestCount) { best = k; bestCount = arr.length; } });
    if (!best || bestCount < 3) return null;
    const points = byType.get(best)!.sort((a, b) => a.t - b.t);
    return { type: best, points };
  }, [measurements]);

  const columns: ColumnDef<any>[] = [
    { accessorKey: "recorded_at", header: "Date", cell: ({ row }) => <DateTime value={row.original.recorded_at} format="full" className="text-[12px]" /> },
    { accessorKey: "type", header: "Type", cell: ({ row }) => <span className="text-[12px] capitalize">{MEASUREMENT_TYPE_LABELS[row.original.type as keyof typeof MEASUREMENT_TYPE_LABELS] ?? row.original.type.replaceAll("_", " ")}</span> },
    { accessorKey: "value", header: "Value", cell: ({ row }) => <span className="font-mono text-[13px] font-semibold tabular-nums">{Number(row.original.value).toLocaleString()}</span> },
    { accessorKey: "unit", header: "Unit", cell: ({ row }) => row.original.unit ? <span className="text-[12px] text-muted-foreground">{row.original.unit}</span> : "—" },
    { accessorKey: "notes", header: "Notes", cell: ({ row }) => <span className="text-[11px] text-muted-foreground line-clamp-1 max-w-[200px]">{row.original.notes?.slice(0, 60) ?? "—"}</span> },
  ];

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Quick record form */}
      <form onSubmit={handleRecord} className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Ruler className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-[12px] uppercase tracking-wider font-semibold text-foreground">Record measurement</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <div className="col-span-2 md:col-span-2">
            <label className="block text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-[12px] shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {MEASUREMENT_TYPES.map((t) => <option key={t} value={t}>{MEASUREMENT_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">Value</label>
            <Input type="number" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} className="h-9 font-mono text-[12px]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">Unit</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as any)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-[12px] shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {MEASUREMENT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-2">
            <label className="block text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">Notes</label>
            <div className="flex gap-2">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9 text-[12px]" placeholder="Optional" />
              <Button type="submit" disabled={saving} size="sm" className="shrink-0">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Record"}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {measurements.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="Track this plant's physical development"
          description="Regular measurements help Cody predict yield and identify issues early."
        />
      ) : (
        <>
          {chartData && chartData.points.length >= 3 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-[13px] font-semibold text-foreground mb-3 capitalize">{String(chartData.type).replaceAll("_", " ")} over time</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData.points.map((p) => ({ ...p, date: new Date(p.t).toLocaleDateString() }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid var(--glass-border)", borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <DataTable columns={columns} data={measurements} />
        </>
      )}
    </div>
  );
}

// ─── Tasks panel ─────────────────────────────────────────────────────────────

function TasksPanel({ plant }: { plant: Plant }) {
  const { data: tasks, loading } = usePlantTasks(plant.id);

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title="No tasks assigned to this plant"
        description="Tasks let you track cultivation work — topping, watering, pest checks, etc."
      />
    );
  }

  const byStatus: Record<string, any[]> = { pending: [], in_progress: [], completed: [] };
  tasks.forEach((t) => {
    const s = t.status ?? "pending";
    if (byStatus[s]) byStatus[s].push(t);
    else byStatus.pending.push(t);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {["pending", "in_progress", "completed"].map((status) => (
        <div key={status} className="rounded-xl border border-border bg-card p-3">
          <h4 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-3 capitalize">
            {status.replace("_", " ")} · {byStatus[status].length}
          </h4>
          <div className="space-y-2">
            {byStatus[status].map((t: any) => (
              <div key={t.id} className="rounded-lg border border-border bg-background p-3">
                <p className="text-[12px] font-medium text-foreground mb-1">{t.title ?? t.task_type ?? "(untitled)"}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {t.priority && <StatusPill label={t.priority} variant={t.priority === "urgent" ? "critical" : t.priority === "high" ? "warning" : "info"} />}
                  {t.due_date && <DateTime value={t.due_date} format="date-only" />}
                </div>
              </div>
            ))}
            {byStatus[status].length === 0 && <p className="text-[11px] text-muted-foreground italic">No tasks</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Children panel ──────────────────────────────────────────────────────────

function ChildrenPanel({ plant, children, onTakeClones }: { plant: Plant; children: Plant[]; onTakeClones: () => void }) {
  const navigate = useNavigate();

  const stats = useMemo(() => ({
    total: children.length,
    veg: children.filter((c) => c.ccrs_growth_stage === "Vegetative").length,
    flower: children.filter((c) => c.ccrs_growth_stage === "Flowering").length,
    harvested: children.filter((c) => c.ccrs_plant_state === "Harvested").length,
  }), [children]);

  const columns: ColumnDef<Plant>[] = [
    {
      accessorKey: "plant_identifier",
      header: "Plant ID",
      cell: ({ row }) => (
        <button onClick={() => navigate(`/cultivation/plants/${row.original.id}`)} className="font-mono text-[12px] text-primary hover:underline">
          {row.original.plant_identifier ?? row.original.id.slice(0, 8)}
        </button>
      ),
    },
    { id: "strain", header: "Strain", cell: ({ row }) => <span className="text-[12px]">{plant.strain?.name ?? "—"}</span> },
    { id: "phase", header: "Phase", cell: ({ row }) => <PhaseColorBadge phase={plantPhaseKey(row.original)} /> },
    {
      id: "age", header: "Age",
      cell: ({ row }) => <span className="font-mono text-[12px]">{Math.floor((Date.now() - new Date(row.original.created_at).getTime()) / 86400000)}d</span>,
    },
    { id: "area", header: "Area", cell: ({ row }) => row.original.area?.name ?? <span className="text-muted-foreground text-[12px]">—</span> },
    { id: "cycle", header: "Cycle", cell: ({ row }) => row.original.cycle?.name ?? <span className="text-muted-foreground text-[12px]">—</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="Total Clones" value={stats.total} color="text-foreground" />
        <MiniStat label="In Veg" value={stats.veg} color="text-emerald-500" />
        <MiniStat label="In Flower" value={stats.flower} color="text-purple-500" />
        <MiniStat label="Harvested" value={stats.harvested} color="text-amber-500" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">
          Clones traced back to this mother via <span className="font-mono">mother_plant_id</span>.
        </p>
        <Button onClick={onTakeClones} className="gap-1.5">
          <GitFork className="w-3.5 h-3.5" /> Take Clones
        </Button>
      </div>

      {children.length === 0 ? (
        <EmptyState
          icon={GitFork}
          title="No clones taken yet"
          description="When you take clones from this mother, they'll appear here with full lineage tracking."
          primaryAction={<Button onClick={onTakeClones} className="gap-1.5"><GitFork className="w-3.5 h-3.5" /> Take First Clones</Button>}
        />
      ) : (
        <DataTable columns={columns} data={children} />
      )}
    </div>
  );
}

// ─── Mother confirm modal ────────────────────────────────────────────────────

function MotherConfirmModal({
  plant, childrenCount, onConfirm, onCancel,
}: {
  plant: Plant;
  childrenCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const makingMother = !plant.is_mother_plant;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", makingMother ? "bg-teal-500/15 text-teal-500" : "bg-muted text-muted-foreground")}>
            <GitFork className="w-4 h-4" />
          </div>
          <h2 className="text-[15px] font-semibold text-foreground">
            {makingMother ? "Designate as mother plant?" : "Remove mother status?"}
          </h2>
        </div>
        <div className="p-5 space-y-3 text-[12px] text-muted-foreground">
          {makingMother ? (
            <p className="leading-relaxed">
              Designate <span className="font-mono font-semibold text-foreground">{plant.plant_identifier}</span> ({plant.strain?.name ?? "—"}) as a Mother Plant?
              This plant will be available for clone selection across the platform.
            </p>
          ) : (
            <>
              <p className="leading-relaxed">
                Remove mother plant status from <span className="font-mono font-semibold text-foreground">{plant.plant_identifier}</span>?
              </p>
              {childrenCount > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                  <span className="text-foreground">
                    This plant has <span className="font-semibold">{childrenCount} recorded clone{childrenCount === 1 ? "" : "s"}</span>.
                    Removing mother status won't delete the lineage.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>{makingMother ? "Designate" : "Remove"}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/20">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 px-5 py-2.5">
      <dt className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</dt>
      <dd className="text-[12px] text-foreground">{value}</dd>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-[20px] font-bold tabular-nums mt-0.5", color)}>{value}</p>
    </div>
  );
}

// Silence unused imports that come from the template
void ArrowLeft; void CheckCircle2; void FileDown; void Package; void Scissors;
void CCRS_GROWTH_STAGES; void CCRS_PLANT_STATES;
