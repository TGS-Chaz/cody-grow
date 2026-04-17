import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Dna, Edit, Copy, Archive, FileDown, Loader2, Star, Plus,
  Sparkles, Leaf, ClipboardCheck, Activity, Package,
  Flame, Droplets,
} from "lucide-react";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid,
} from "recharts";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import BarcodeRenderer from "@/components/shared/BarcodeRenderer";
import StatCard from "@/components/shared/StatCard";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import CodyInsightsPanel from "@/components/cody/CodyInsightsPanel";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useStrain, useStrains, useStrainLineage, useStrainPhenotypes,
  useStrainCycles, useStrainLabResults, useStrainActivePlants,
  Phenotype, PhenotypeInput, Strain,
} from "@/hooks/useStrains";
import {
  STRAIN_TYPE_LABELS, STRAIN_TYPE_COLORS, StrainType,
  STRAIN_DIFFICULTY_LABELS, STRAIN_ENVIRONMENT_LABELS, STRAIN_GROWTH_PATTERN_LABELS,
  TERPENE_COLORS,
} from "@/lib/schema-enums";
import StrainFormModal from "./StrainFormModal";
import PhenotypeFormModal from "./PhenotypeFormModal";
import { TerpeneChips } from "./StrainsPage";
import { cn } from "@/lib/utils";

export default function StrainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const setActiveTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const { data: strain, loading, refresh } = useStrain(id);
  const { updateStrain, archiveStrain, duplicateStrain } = useStrains();
  const [editOpen, setEditOpen] = useState(false);
  /** `p` fires this ref; PhenotypesPanel listens for it and opens its own modal. */
  const [phenoAddTick, setPhenoAddTick] = useState(0);

  const { setContext, clearContext } = useCodyContext();
  const sig = strain ? `${strain.id}:${strain.updated_at}` : "";
  const codyPayload = useMemo(() => {
    if (!strain) return null;
    return {
      strain: {
        name: strain.name,
        type: strain.type,
        breeder: strain.breeder,
        genetics: strain.genetics,
        avg_thc: strain.average_thc_pct,
        avg_cbd: strain.average_cbd_pct,
        avg_flower_days: strain.average_flower_days,
        difficulty: strain.difficulty,
        preferred_environment: strain.preferred_environment,
        dominant_terpenes: strain.dominant_terpenes,
        flavors: strain.flavor_profile,
        effects: strain.effects,
        active_plants: strain.active_plant_count,
        phenotypes: strain.phenotype_count,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (!strain || !codyPayload) return;
    setContext({ context_type: "strain_detail", context_id: strain.id, page_data: codyPayload });
    return () => clearContext();
  }, [setContext, clearContext, codyPayload, strain?.id]);

  useShortcut(["e"], () => setEditOpen(true), { description: "Edit strain", scope: "Strain Detail", enabled: !!strain && !editOpen });
  useShortcut(["p"], () => setPhenoAddTick((t) => t + 1), { description: "Add phenotype", scope: "Strain Detail", enabled: !!strain && activeTab === "phenotypes" && !editOpen });

  const handleArchive = async () => {
    if (!strain) return;
    if (!confirm(`Archive "${strain.name}"? Existing plants and cycles keep their reference.`)) return;
    try {
      await archiveStrain(strain.id);
      toast.success("Strain archived");
      navigate("/cultivation/strains");
    } catch (e: any) { toast.error(e?.message ?? "Archive failed"); }
  };

  const handleDuplicate = async () => {
    if (!strain) return;
    try {
      const dup = await duplicateStrain(strain);
      toast.success(`Duplicated as "${dup.name}"`);
      navigate(`/cultivation/strains/${dup.id}`);
    } catch (e: any) { toast.error(e?.message ?? "Duplicate failed"); }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!strain) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState
          icon={Dna}
          title="Strain not found"
          description="This strain may have been archived or deleted."
          primaryAction={<Button onClick={() => navigate("/cultivation/strains")}>← Back to strains</Button>}
        />
      </div>
    );
  }

  const type = strain.type ?? "Hybrid";
  const color = STRAIN_TYPE_COLORS[type];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={strain.name}
        breadcrumbs={[
          { label: "Cultivation" },
          { label: "Strains", to: "/cultivation/strains" },
          { label: strain.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Edit className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button variant="outline" onClick={handleDuplicate} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </Button>
            <Button variant="outline" disabled className="gap-1.5" title="CCRS CSV generation — coming soon">
              <FileDown className="w-3.5 h-3.5" /> CCRS CSV
            </Button>
            <Button variant="outline" onClick={handleArchive} className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10">
              <Archive className="w-3.5 h-3.5" /> Archive
            </Button>
          </div>
        }
      />

      {/* Hero */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className={cn("relative w-full md:w-[200px] h-[200px] rounded-xl overflow-hidden shrink-0 bg-gradient-to-br", color.gradient)}>
            {strain.image_url ? (
              <img src={strain.image_url} alt={strain.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Dna className="w-12 h-12 text-foreground/25" />
              </div>
            )}
            <div className="absolute bottom-2 right-2 rounded-md bg-white/90 p-1 shadow-sm" title="Scan for strain info">
              <BarcodeRenderer value={strain.name} format="qr" width={56} height={56} showText={false} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider", color.bg, color.text)}>
                {STRAIN_TYPE_LABELS[type]}
              </span>
              {strain.breeder && <span className="text-[12px] text-muted-foreground">by <span className="font-medium text-foreground">{strain.breeder}</span></span>}
            </div>
            {strain.genetics && <p className="text-[14px] text-muted-foreground italic mb-3">{strain.genetics}</p>}
            {(strain.dominant_terpenes ?? []).length > 0 && (
              <div className="mb-3">
                <TerpeneChips terpenes={strain.dominant_terpenes ?? []} max={6} />
              </div>
            )}
            {strain.description && <p className="text-[13px] text-foreground/80 leading-relaxed">{strain.description}</p>}
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Avg THC"
          value={strain.average_thc_pct != null ? `${Number(strain.average_thc_pct).toFixed(1)}%` : "—"}
          accentClass={strain.average_thc_pct != null && strain.average_thc_pct > 25 ? "stat-accent-emerald" : "stat-accent-blue"}
        />
        <StatCard
          label="Avg Flower Days"
          value={strain.average_flower_days ?? "—"}
          accentClass="stat-accent-amber"
          delay={0.05}
        />
        <StatCard
          label="Active Plants"
          value={strain.active_plant_count ?? 0}
          accentClass="stat-accent-teal"
          delay={0.1}
          onClick={() => navigate(`/cultivation/plants?strain=${strain.id}`)}
        />
        <StatCard
          label="Phenotypes"
          value={strain.phenotype_count ?? 0}
          accentClass="stat-accent-purple"
          delay={0.15}
          onClick={() => setActiveTab("phenotypes")}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="phenotypes">Phenotypes</TabsTrigger>
          <TabsTrigger value="cycles">Grow History</TabsTrigger>
          <TabsTrigger value="lab">Lab Results</TabsTrigger>
          <TabsTrigger value="plants">Active Plants</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewPanel strain={strain} /></TabsContent>
        <TabsContent value="phenotypes">
          <PhenotypesPanel strain={strain} addTick={phenoAddTick} />
        </TabsContent>
        <TabsContent value="cycles"><CyclesPanel strainId={strain.id} /></TabsContent>
        <TabsContent value="lab"><LabResultsPanel strainId={strain.id} /></TabsContent>
        <TabsContent value="plants"><ActivePlantsPanel strainId={strain.id} /></TabsContent>
        <TabsContent value="activity">
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[14px] font-semibold text-foreground mb-1">Audit log coming soon</p>
            <p className="text-[12px] text-muted-foreground">Strain changes, phenotype updates, and lineage edits will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>

      <StrainFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editing={strain}
        onSave={async (input) => {
          const row = await updateStrain(strain.id, input);
          refresh();
          return row;
        }}
      />
    </div>
  );
}

// ─── Overview panel ───────────────────────────────────────────────────────────

function OverviewPanel({ strain }: { strain: Strain }) {
  const { data: lineage } = useStrainLineage(strain.id);
  const mother = lineage.find((l) => l.parent_type === "mother");
  const father = lineage.find((l) => l.parent_type === "father");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Genetics card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/20">
            <h3 className="text-[13px] font-semibold text-foreground">Genetics & Lineage</h3>
          </div>
          <div className="p-5">
            {mother || father ? (
              <div className="flex items-center justify-center gap-4 py-4">
                <ParentTile
                  label="Mother"
                  name={mother?.parent_strain?.name ?? mother?.parent_name_external ?? "Unknown"}
                  type={mother?.parent_strain?.type ?? null}
                />
                <span className="text-foreground/40 text-xl font-mono">×</span>
                <ParentTile
                  label="Father"
                  name={father?.parent_strain?.name ?? father?.parent_name_external ?? "Unknown"}
                  type={father?.parent_strain?.type ?? null}
                />
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground italic text-center py-4">
                No lineage recorded. Edit this strain to add parent genetics.
              </p>
            )}
            <dl className="divide-y divide-border mt-2">
              <InfoRow label="Genetics" value={strain.genetics ?? "—"} />
              {mother?.generation && <InfoRow label="Generation" value={<span className="font-mono">{mother.generation}</span>} />}
              <InfoRow label="Breeder" value={strain.breeder ?? "—"} />
            </dl>
          </div>
        </div>

        {/* Characteristics card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/20">
            <h3 className="text-[13px] font-semibold text-foreground">Characteristics</h3>
          </div>
          <div className="p-5 space-y-4">
            <CharGroup title="Dominant Terpenes" items={strain.dominant_terpenes ?? []} colorMap={TERPENE_COLORS} />
            <CharGroup title="Flavor Profile" items={strain.flavor_profile ?? []} />
            <CharGroup title="Effects" items={strain.effects ?? []} />
          </div>
        </div>

        {/* Cultivation notes card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/20">
            <h3 className="text-[13px] font-semibold text-foreground">Cultivation</h3>
          </div>
          <dl className="divide-y divide-border">
            <InfoRow label="Difficulty" value={strain.difficulty ? STRAIN_DIFFICULTY_LABELS[strain.difficulty] : "—"} />
            <InfoRow label="Preferred Environment" value={strain.preferred_environment ? STRAIN_ENVIRONMENT_LABELS[strain.preferred_environment] : "—"} />
            <InfoRow label="Growth Pattern" value={strain.growth_pattern ? STRAIN_GROWTH_PATTERN_LABELS[strain.growth_pattern] : "—"} />
            <InfoRow label="Avg Flower Days" value={strain.average_flower_days ?? "—"} />
            <InfoRow label="Avg THC %" value={strain.average_thc_pct != null ? `${Number(strain.average_thc_pct).toFixed(1)}%` : "—"} />
            <InfoRow label="Avg CBD %" value={strain.average_cbd_pct != null ? `${Number(strain.average_cbd_pct).toFixed(1)}%` : "—"} />
            <InfoRow label="CCRS Notes" value={strain.ccrs_notes ?? "—"} />
          </dl>
        </div>
      </div>

      <div className="lg:col-span-1">
        <CodyInsightsPanel />
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <h4 className="text-[12px] font-semibold text-foreground">Ask Cody</h4>
          </div>
          <div className="space-y-1.5">
            {[
              `What's the best VPD range for ${strain.name}?`,
              `How does ${strain.name} compare to my other ${strain.type?.toLowerCase() ?? ""} strains on yield?`,
              `When should I transition ${strain.name} to flower for best results?`,
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

function ParentTile({ label, name, type }: { label: string; name: string; type: StrainType | null }) {
  const color = type ? STRAIN_TYPE_COLORS[type] : null;
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">{label}</span>
      <div className={cn("w-14 h-14 rounded-lg flex items-center justify-center bg-gradient-to-br", color?.gradient ?? "from-muted/50 to-muted")}>
        <Dna className="w-5 h-5 text-foreground/40" />
      </div>
      <span className="text-[12px] font-medium text-foreground mt-1 max-w-[120px] text-center">{name}</span>
    </div>
  );
}

function CharGroup({ title, items, colorMap }: { title: string; items: string[]; colorMap?: Record<string, string> }) {
  return (
    <div>
      <h4 className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground mb-2">{title}</h4>
      {items.length === 0 ? (
        <span className="text-[12px] text-muted-foreground italic">None recorded</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className={cn(
                "inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium",
                colorMap?.[item] ?? "bg-muted text-foreground",
              )}
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 px-5 py-2.5">
      <dt className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</dt>
      <dd className="text-[12px] text-foreground">{value}</dd>
    </div>
  );
}

// ─── Phenotypes panel ─────────────────────────────────────────────────────────

function PhenotypesPanel({ strain, addTick }: { strain: Strain; addTick: number }) {
  const { data: phenos, loading, createPhenotype, updatePhenotype, retirePhenotype, setKeeper, nextPhenoNumber } = useStrainPhenotypes(strain.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Phenotype | null>(null);

  // Respond to the `P` keyboard shortcut from the parent detail page
  useEffect(() => {
    if (addTick > 0) { setEditing(null); setModalOpen(true); }
  }, [addTick]);

  const handleSave = async (input: PhenotypeInput) => {
    if (editing) return await updatePhenotype(editing.id, input);
    return await createPhenotype(input);
  };

  const columns: ColumnDef<Phenotype>[] = [
    {
      id: "number",
      header: "#",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-[13px]">{row.original.pheno_number}</span>
          {row.original.is_keeper && <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />}
          {row.original.is_retired && <StatusPill label="Retired" variant="muted" />}
        </div>
      ),
    },
    {
      accessorKey: "pheno_name",
      header: "Name",
      cell: ({ row }) => row.original.pheno_name ?? <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "mother",
      header: "Mother Plant",
      cell: ({ row }) => row.original.mother_plant?.plant_tag
        ? <span className="text-[12px] font-mono">{row.original.mother_plant.plant_tag}</span>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      accessorKey: "thc_avg",
      header: "THC",
      cell: ({ row }) => row.original.thc_avg != null ? <span className="font-mono text-[12px]">{Number(row.original.thc_avg).toFixed(1)}%</span> : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      accessorKey: "cbd_avg",
      header: "CBD",
      cell: ({ row }) => row.original.cbd_avg != null ? <span className="font-mono text-[12px]">{Number(row.original.cbd_avg).toFixed(1)}%</span> : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      accessorKey: "total_terpenes_avg",
      header: "Terps",
      cell: ({ row }) => row.original.total_terpenes_avg != null ? <span className="font-mono text-[12px]">{Number(row.original.total_terpenes_avg).toFixed(2)}%</span> : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      accessorKey: "yield_avg_grams",
      header: "Avg Yield",
      cell: ({ row }) => row.original.yield_avg_grams != null ? <span className="font-mono text-[12px]">{Number(row.original.yield_avg_grams).toFixed(1)}g</span> : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      accessorKey: "flower_days_avg",
      header: "Flower",
      cell: ({ row }) => row.original.flower_days_avg != null ? <span className="font-mono text-[12px]">{row.original.flower_days_avg}d</span> : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "actions",
      enableSorting: false,
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => setKeeper(row.original.id, !row.original.is_keeper)}
            className="p-1 rounded hover:bg-accent"
            title={row.original.is_keeper ? "Remove keeper" : "Set as keeper"}
          >
            <Star className={cn("w-3.5 h-3.5", row.original.is_keeper ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
          </button>
          <button
            onClick={() => { setEditing(row.original); setModalOpen(true); }}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
            title="Edit"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          {!row.original.is_retired && (
            <button
              onClick={async () => { if (confirm("Retire this phenotype?")) await retirePhenotype(row.original.id); }}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              title="Retire"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-muted-foreground">
          {phenos.length === 0 ? "No phenotypes yet" : `${phenos.length} phenotype${phenos.length === 1 ? "" : "s"} for this strain`}
        </p>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Phenotype
        </Button>
      </div>

      {loading ? (
        <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : phenos.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No phenotypes yet"
          description="A phenotype is a specific genetic expression of this strain — typically identified during a phenohunt. Add your keeper cuts here."
          primaryAction={<Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add First Phenotype</Button>}
        />
      ) : (
        <DataTable columns={columns} data={phenos} />
      )}

      <PhenotypeFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        strainId={strain.id}
        defaultPhenoNumber={editing?.pheno_number ?? nextPhenoNumber}
        editing={editing}
        onSave={handleSave}
      />
    </div>
  );
}

// ─── Grow history panel ───────────────────────────────────────────────────────

function CyclesPanel({ strainId }: { strainId: string }) {
  const { data: cycles, loading } = useStrainCycles(strainId);

  const yieldSeries = useMemo(() => {
    return [...cycles]
      .reverse()
      .filter((c) => c.total_yield_grams > 0)
      .map((c) => ({
        name: c.cycle_name ?? c.id.slice(0, 6),
        yield: Number(c.total_yield_grams ?? 0),
        date: c.harvest_date ?? c.start_date ?? c.created_at,
      }));
  }, [cycles]);

  const summary = useMemo(() => {
    const yields = cycles.map((c: any) => Number(c.total_yield_grams ?? 0)).filter((y) => y > 0);
    if (yields.length === 0) return null;
    return {
      total: yields.reduce((a, b) => a + b, 0),
      average: yields.reduce((a, b) => a + b, 0) / yields.length,
      best: Math.max(...yields),
      worst: Math.min(...yields),
      count: yields.length,
    };
  }, [cycles]);

  const columns: ColumnDef<any>[] = [
    { accessorKey: "cycle_name", header: "Cycle", cell: ({ row }) => <span className="text-[13px] font-medium">{row.original.cycle_name ?? row.original.id.slice(0, 8)}</span> },
    { accessorKey: "start_date", header: "Start", cell: ({ row }) => row.original.start_date ? <DateTime value={row.original.start_date} format="date-only" className="text-[12px]" /> : "—" },
    { accessorKey: "harvest_date", header: "Harvested", cell: ({ row }) => row.original.harvest_date ? <DateTime value={row.original.harvest_date} format="date-only" className="text-[12px]" /> : "—" },
    { accessorKey: "plant_count", header: "Plants", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.plant_count ?? "—"}</span> },
    { accessorKey: "total_yield_grams", header: "Yield", cell: ({ row }) => row.original.total_yield_grams > 0 ? <span className="font-mono text-[12px]">{Number(row.original.total_yield_grams).toFixed(0)}g</span> : <span className="text-muted-foreground text-[12px]">—</span> },
    { accessorKey: "phase", header: "Phase", cell: ({ row }) => <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium capitalize">{row.original.phase?.replaceAll("_", " ") ?? "—"}</span> },
  ];

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (cycles.length === 0) {
    return (
      <EmptyState
        icon={Leaf}
        title="No grow history yet"
        description="Cycles run with this strain will appear here with yield and performance data. Start a cycle from the Grow Cycles page."
      />
    );
  }

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniStat label="Total cycles" value={summary.count} />
          <MiniStat label="Total harvested" value={`${summary.total.toFixed(0)}g`} />
          <MiniStat label="Average" value={`${summary.average.toFixed(0)}g`} />
          <MiniStat label="Best cycle" value={`${summary.best.toFixed(0)}g`} />
        </div>
      )}

      {yieldSeries.length >= 2 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-[13px] font-semibold text-foreground mb-4">Yield over time</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={yieldSeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} label={{ value: "grams", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid var(--glass-border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="yield" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <DataTable columns={columns} data={cycles} />
    </div>
  );
}

// ─── Lab results panel ────────────────────────────────────────────────────────

function LabResultsPanel({ strainId }: { strainId: string }) {
  const { data: results, loading } = useStrainLabResults(strainId);

  const thcSeries = useMemo(() => {
    return [...results]
      .filter((r) => r.test_completed_at && r.thc_pct != null)
      .map((r) => ({
        date: new Date(r.test_completed_at).getTime(),
        thc: Number(r.thc_pct),
        cbd: r.cbd_pct != null ? Number(r.cbd_pct) : null,
      }))
      .sort((a, b) => a.date - b.date);
  }, [results]);

  const columns: ColumnDef<any>[] = [
    { accessorKey: "test_completed_at", header: "Date", cell: ({ row }) => row.original.test_completed_at ? <DateTime value={row.original.test_completed_at} format="date-only" className="text-[12px]" /> : "—" },
    { accessorKey: "batch", header: "Batch", cell: ({ row }) => row.original.batch ? <span className="font-mono text-[11px]">{row.original.batch.external_id}</span> : <span className="text-muted-foreground text-[12px]">—</span> },
    { accessorKey: "thc_pct", header: "THC %", cell: ({ row }) => row.original.thc_pct != null ? <span className="font-mono text-[12px]">{Number(row.original.thc_pct).toFixed(2)}%</span> : "—" },
    { accessorKey: "cbd_pct", header: "CBD %", cell: ({ row }) => row.original.cbd_pct != null ? <span className="font-mono text-[12px]">{Number(row.original.cbd_pct).toFixed(2)}%</span> : "—" },
    { accessorKey: "total_terpenes", header: "Terps", cell: ({ row }) => row.original.total_terpenes != null ? <span className="font-mono text-[12px]">{Number(row.original.total_terpenes).toFixed(2)}%</span> : "—" },
    {
      accessorKey: "lab_test_status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.lab_test_status;
        if (!s) return "—";
        if (s === "Pass") return <StatusPill label="Pass" variant="success" />;
        if (s.startsWith("Fail")) return <StatusPill label={s} variant="critical" />;
        return <StatusPill label={s} variant="muted" />;
      },
    },
    {
      id: "coa",
      header: "CoA",
      cell: ({ row }) => row.original.certificate_url ? (
        <a href={row.original.certificate_url} target="_blank" rel="noreferrer" className="text-primary text-[12px] hover:underline">View</a>
      ) : <span className="text-muted-foreground text-[12px]">—</span>,
    },
  ];

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (results.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No lab results yet"
        description="Once batches from this strain are tested, QA results will appear here with THC/CBD trends over time."
      />
    );
  }

  return (
    <div className="space-y-6">
      {thcSeries.length >= 2 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-[13px] font-semibold text-foreground mb-4">THC % over time</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
              <XAxis
                dataKey="date"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis dataKey="thc" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} label={{ value: "THC %", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }} />
              <RTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid var(--glass-border)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v) => new Date(v).toLocaleDateString()}
              />
              <Scatter name="THC %" data={thcSeries} fill="hsl(var(--primary))" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      <DataTable columns={columns} data={results} />
    </div>
  );
}

// ─── Active plants panel ──────────────────────────────────────────────────────

function ActivePlantsPanel({ strainId }: { strainId: string }) {
  const navigate = useNavigate();
  const { data: plants, loading } = useStrainActivePlants(strainId);

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "plant_tag",
      header: "Plant",
      cell: ({ row }) => (
        <button
          onClick={() => navigate(`/cultivation/plants/${row.original.id}`)}
          className="text-[12px] font-mono text-primary hover:underline"
        >
          {row.original.plant_tag ?? row.original.id.slice(0, 8)}
        </button>
      ),
    },
    { id: "area", header: "Area", cell: ({ row }) => row.original.area?.name ?? <span className="text-muted-foreground text-[12px]">—</span> },
    {
      accessorKey: "phase",
      header: "Phase",
      cell: ({ row }) => <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium capitalize">{row.original.phase?.replaceAll("_", " ") ?? "—"}</span>,
    },
    {
      id: "age",
      header: "Age",
      cell: ({ row }) => {
        const start = row.original.planted_date ?? row.original.created_at;
        if (!start) return "—";
        const days = Math.floor((Date.now() - new Date(start).getTime()) / 86400000);
        return <span className="text-[12px] font-mono">{days}d</span>;
      },
    },
    { accessorKey: "source_type", header: "Source", cell: ({ row }) => <span className="text-[12px] capitalize">{row.original.source_type ?? "—"}</span> },
  ];

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (plants.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No active plants"
        description="No plants of this strain are currently growing. Start a new cycle from Grow Cycles."
      />
    );
  }

  return <DataTable columns={columns} data={plants} />;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</p>
      <p className="text-[18px] font-bold text-foreground tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

void Flame; void Droplets;
