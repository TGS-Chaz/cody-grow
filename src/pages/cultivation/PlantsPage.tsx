import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Leaf, Sprout, Flower2, GitFork, Scissors, Trash2, Plus, MoreHorizontal,
  Edit, Eye, ArrowUpDown, MapPin, Tag, FileDown, Printer, X,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import PaginationControls from "@/components/shared/PaginationControls";
import StatusPill from "@/components/shared/StatusPill";
import CopyableId from "@/components/shared/CopyableId";
import PhaseColorBadge from "@/components/shared/PhaseColorBadge";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  usePlants, usePlantStats, useDesignateMother, Plant, PlantInput, PlantFilters,
} from "@/hooks/usePlants";
import {
  CCRS_GROWTH_STAGES, CcrsGrowthStage,
  CCRS_PLANT_STATES, CcrsPlantState,
  PLANT_SOURCE_TYPES, PlantSourceType,
  HARVEST_CYCLE_MONTHS,
  STRAIN_TYPE_COLORS, StrainType,
} from "@/lib/schema-enums";
import PlantFormModal from "./PlantFormModal";
import PlantPhaseChangeModal from "./PlantPhaseChangeModal";
import DestroyPlantModal from "./DestroyPlantModal";
import MoveToAreaModal from "./MoveToAreaModal";
import { cn } from "@/lib/utils";

type AgeBucket = "" | "0-30" | "30-60" | "60-90" | "90+";

/** Map a plant's (growth_stage + plant_state) to the PHASE_COLORS key used by the badge. */
function plantPhaseKey(p: Plant): string {
  if (p.ccrs_plant_state === "Destroyed") return "destroyed";
  if (p.ccrs_plant_state === "Harvested") return "harvested";
  if (p.ccrs_plant_state === "Drying") return "drying";
  if (p.ccrs_plant_state === "Quarantined") return "default"; // quarantine handled separately
  if (p.ccrs_growth_stage === "Flowering") return "flowering";
  if (p.ccrs_growth_stage === "Vegetative") return "vegetative";
  if (p.ccrs_growth_stage === "Immature") return "immature";
  return "default";
}

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

export default function PlantsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const strainFromQuery = searchParams.get("strain");
  const areaFromQuery = searchParams.get("area");
  const cycleFromQuery = searchParams.get("cycle");

  const [filters, setFilters] = useState<PlantFilters>(() => ({
    strain_id: strainFromQuery ?? undefined,
    area_id: areaFromQuery ?? undefined,
    cycle_id: cycleFromQuery ?? undefined,
  }));
  const [page, setPage] = useState<number>(() => {
    const p = parseInt(searchParams.get("page") ?? "1", 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [pageSize, setPageSize] = useState<number>(50);
  // Pass page+pageSize through to the hook for server-side pagination
  const plantsFilters = useMemo<PlantFilters>(() => ({ ...filters, page, pageSize }), [filters, page, pageSize]);
  const { data: plants, loading, createPlant, updatePlant, refresh, totalCount } = usePlants(plantsFilters);
  // Reset page to 1 when any filter changes
  const filterSig = useMemo(() => Object.values(filters).map((v) => v ?? "").join(":"), [filters]);
  useEffect(() => { setPage(1); }, [filterSig]);
  // URL-sync page number
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (page <= 1) next.delete("page"); else next.set("page", String(page));
    // Intentionally bypass extra re-renders from setSearchParams setter identity
    if ((searchParams.get("page") ?? "") !== (next.get("page") ?? "")) {
      window.history.replaceState({}, "", `${window.location.pathname}${next.toString() ? `?${next.toString()}` : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  const stats = usePlantStats(plants);
  const designateMother = useDesignateMother();

  const [searchValue, setSearchValue] = useState("");
  const [ageBucket, setAgeBucket] = useState<AgeBucket>("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Plant | null>(null);
  const [phaseOpen, setPhaseOpen] = useState(false);
  const [destroyOpen, setDestroyOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [phaseTargets, setPhaseTargets] = useState<Plant[]>([]);
  const [destroyTargets, setDestroyTargets] = useState<Plant[]>([]);
  const [moveTargets, setMoveTargets] = useState<Plant[]>([]);

  const [selected, setSelected] = useState<Plant[]>([]);

  const { setContext, clearContext } = useCodyContext();
  const sig = useMemo(() =>
    plants.map((p) => `${p.id}:${p.ccrs_growth_stage}:${p.ccrs_plant_state}`).join(","),
  [plants]);
  const payload = useMemo(() => ({
    stats,
    filters,
    totalCount: plants.length,
    plants: plants.slice(0, 100).map((p) => ({
      id: p.plant_identifier,
      strain: p.strain?.name,
      stage: p.ccrs_growth_stage,
      state: p.ccrs_plant_state,
      area: p.area?.name,
      is_mother: p.is_mother_plant,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sig, stats.total]);

  useEffect(() => {
    setContext({ context_type: "plants_list", page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload]);

  const modalOpen = formOpen || phaseOpen || destroyOpen || moveOpen;
  useShortcut(["n"], () => { setEditing(null); setFormOpen(true); }, { description: "Add plant", scope: "Plants", enabled: !modalOpen });
  useShortcut(["/"], () => document.querySelector<HTMLInputElement>("[data-filters-search]")?.focus(), { description: "Focus search", scope: "Plants", enabled: !modalOpen });
  useShortcut(["p"], () => {
    if (selected.length === 0) { toast.error("Select plants first"); return; }
    setPhaseTargets(selected); setPhaseOpen(true);
  }, { description: "Phase change selected", scope: "Plants", enabled: !modalOpen && selected.length > 0 });
  useShortcut(["d"], () => {
    if (selected.length === 0) { toast.error("Select plants first"); return; }
    setDestroyTargets(selected); setDestroyOpen(true);
  }, { description: "Destroy selected", scope: "Plants", enabled: !modalOpen && selected.length > 0 });
  useShortcut(["m"], () => {
    if (selected.length === 0) { toast.error("Select plants first"); return; }
    setMoveTargets(selected); setMoveOpen(true);
  }, { description: "Move selected to area", scope: "Plants", enabled: !modalOpen && selected.length > 0 });

  // Filter options derived from visible plants
  const strainOptions = useMemo(() => {
    const m = new Map<string, string>();
    plants.forEach((p) => { if (p.strain) m.set(p.strain.id, p.strain.name); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [plants]);
  const areaOptions = useMemo(() => {
    const m = new Map<string, string>();
    plants.forEach((p) => { if (p.area) m.set(p.area.id, p.area.name); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [plants]);
  const cycleOptions = useMemo(() => {
    const m = new Map<string, string>();
    plants.forEach((p) => { if (p.cycle?.id) m.set(p.cycle.id, p.cycle.name ?? p.cycle.id.slice(0, 8)); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [plants]);

  // Client-side search + age filter (on top of server-side filters)
  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    const now = Date.now();
    return plants.filter((p) => {
      if (q) {
        const hay = `${p.plant_identifier ?? ""} ${p.strain?.name ?? ""} ${p.area?.name ?? ""} ${p.external_id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (ageBucket) {
        const ageDays = Math.floor((now - new Date(p.created_at).getTime()) / 86400000);
        if (ageBucket === "0-30" && ageDays > 30) return false;
        if (ageBucket === "30-60" && (ageDays <= 30 || ageDays > 60)) return false;
        if (ageBucket === "60-90" && (ageDays <= 60 || ageDays > 90)) return false;
        if (ageBucket === "90+" && ageDays <= 90) return false;
      }
      return true;
    });
  }, [plants, searchValue, ageBucket]);

  const handleSave = async (input: PlantInput) => {
    if (editing) return await updatePlant(editing.id, input);
    return await createPlant(input);
  };

  const handleExportCSV = () => {
    if (selected.length === 0) return;
    const rows = selected.map((p) => ({
      plant_id: p.plant_identifier,
      external_id: p.external_id,
      strain: p.strain?.name,
      area: p.area?.name,
      growth_stage: p.ccrs_growth_stage,
      plant_state: p.ccrs_plant_state,
      source_type: p.source_type,
      is_mother: p.is_mother_plant,
      created_at: p.created_at,
    }));
    const header = Object.keys(rows[0]).join(",");
    const body = rows.map((r) => Object.values(r).map((v) => `"${v ?? ""}"`).join(",")).join("\n");
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plants-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<Plant>[] = useMemo(() => [
    {
      accessorKey: "plant_identifier",
      header: "Plant ID",
      cell: ({ row }) => {
        const id = row.original.plant_identifier;
        if (!id) return <span className="text-muted-foreground text-[12px] italic">—</span>;
        return (
          <button onClick={() => navigate(`/cultivation/plants/${row.original.id}`)} className="font-mono text-[12px] text-primary hover:underline">
            {id}
          </button>
        );
      },
    },
    {
      id: "strain",
      header: "Strain",
      cell: ({ row }) => {
        const s = row.original.strain;
        if (!s) return <span className="text-muted-foreground text-[12px]">—</span>;
        const strainType = s.type as StrainType | null;
        const c = strainType ? STRAIN_TYPE_COLORS[strainType] : null;
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/cultivation/strains/${s.id}`); }}
              className="text-[12px] text-primary hover:underline truncate"
            >
              {s.name}
            </button>
            {c && strainType && (
              <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider shrink-0", c.bg, c.text)}>
                {strainType}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "phase",
      header: "Phase",
      cell: ({ row }) => <PhaseColorBadge phase={plantPhaseKey(row.original)} />,
    },
    {
      id: "age",
      header: "Age",
      accessorFn: (p) => Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000),
      cell: ({ getValue }) => <span className="font-mono text-[12px]" title={`${getValue()} days old`}>{String(getValue())}d</span>,
    },
    {
      id: "area",
      header: "Area",
      cell: ({ row }) => row.original.area
        ? <button onClick={(e) => { e.stopPropagation(); navigate(`/cultivation/areas/${row.original.area!.id}`); }} className="text-[12px] text-primary hover:underline">{row.original.area.name}</button>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "cycle",
      header: "Cycle",
      cell: ({ row }) => row.original.cycle
        ? <button onClick={(e) => { e.stopPropagation(); navigate(`/cultivation/grow-cycles/${row.original.cycle!.id}`); }} className="text-[12px] text-primary hover:underline truncate max-w-[120px] inline-block">{row.original.cycle.name ?? row.original.cycle.id.slice(0, 8)}</button>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "source",
      header: "Source",
      cell: ({ row }) => {
        const t = row.original.source_type;
        if (!t) return <span className="text-muted-foreground text-[12px]">—</span>;
        const cls = t === "seed" ? "bg-amber-500/15 text-amber-500" : t === "clone" ? "bg-green-500/15 text-green-500" : "bg-purple-500/15 text-purple-500";
        const label = t === "tissue_culture" ? "Tissue" : t.charAt(0).toUpperCase() + t.slice(1);
        return (
          <div className="flex items-center gap-1">
            <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", cls)}>{label}</span>
            {row.original.source && (
              <button onClick={(e) => { e.stopPropagation(); navigate(`/cultivation/sources/${row.original.source!.id}`); }} className="text-[10px] text-muted-foreground hover:text-primary font-mono">
                {row.original.source.external_id.slice(-4)}
              </button>
            )}
          </div>
        );
      },
    },
    {
      id: "phenotype",
      header: "Pheno",
      cell: ({ row }) => row.original.phenotype
        ? <span className="font-mono text-[11px]">{row.original.phenotype.pheno_number}{row.original.phenotype.pheno_name ? ` · ${row.original.phenotype.pheno_name}` : ""}</span>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "mother",
      header: "",
      enableSorting: false,
      cell: ({ row }) => row.original.is_mother_plant
        ? <span title="Mother plant"><GitFork className="w-3.5 h-3.5 text-teal-500" /></span>
        : null,
    },
    {
      accessorKey: "harvest_cycle_months",
      header: "HCM",
      cell: ({ row }) => row.original.harvest_cycle_months
        ? <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-mono font-medium bg-muted text-muted-foreground">{row.original.harvest_cycle_months}mo</span>
        : <span className="text-muted-foreground text-[11px]">—</span>,
    },
    {
      id: "state",
      header: "State",
      cell: ({ row }) => row.original.ccrs_plant_state
        ? <StatusPill label={row.original.ccrs_plant_state} variant={PLANT_STATE_VARIANT[row.original.ccrs_plant_state as CcrsPlantState] ?? "muted"} />
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "actions",
      enableSorting: false,
      header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/cultivation/plants/${row.original.id}`)}>
                <Eye className="w-3.5 h-3.5" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setEditing(row.original); setFormOpen(true); }}>
                <Edit className="w-3.5 h-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setPhaseTargets([row.original]); setPhaseOpen(true); }}>
                <ArrowUpDown className="w-3.5 h-3.5" /> Phase change
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setMoveTargets([row.original]); setMoveOpen(true); }}>
                <MapPin className="w-3.5 h-3.5" /> Move to area
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await designateMother(row.original.id, !row.original.is_mother_plant);
                    toast.success(row.original.is_mother_plant ? "Mother status removed" : "Designated as mother");
                    refresh();
                  } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                }}
              >
                <GitFork className="w-3.5 h-3.5" />
                {row.original.is_mother_plant ? "Remove mother status" : "Designate as mother"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => { setDestroyTargets([row.original]); setDestroyOpen(true); }}
                className="text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" /> Destroy
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate, designateMother, refresh]);

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title="Plants"
        description="Individual plant tracking from veg to harvest"
        breadcrumbs={[{ label: "Cultivation" }, { label: "Plants" }]}
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Plant
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total Plants" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Vegetative" value={stats.vegetative} accentClass="stat-accent-emerald" delay={0.05} />
        <StatCard label="Flowering" value={stats.flowering} accentClass="stat-accent-purple" delay={0.1} />
        <StatCard label="Mother Plants" value={stats.motherPlants} accentClass="stat-accent-teal" delay={0.15} />
        <StatCard label="Harvested" value={stats.harvested} accentClass="stat-accent-amber" delay={0.2} />
        <StatCard label="Destroyed" value={stats.destroyed} accentClass={stats.destroyed > 0 ? "stat-accent-rose" : "stat-accent-emerald"} delay={0.25} />
      </div>

      <FiltersBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search plant ID, strain, area, external ID…"
        pageKey="plants"
        currentFilters={{ ...filters, ageBucket, search: searchValue }}
        onApplyView={(f) => {
          setFilters({
            strain_id: f.strain_id, area_id: f.area_id, cycle_id: f.cycle_id,
            growth_stage: f.growth_stage, plant_state: f.plant_state,
            source_type: f.source_type, is_mother: f.is_mother,
          });
          setAgeBucket((f.ageBucket ?? "") as AgeBucket);
          setSearchValue(f.search ?? "");
        }}
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={filters.growth_stage ?? ""} onChange={(e) => setFilters((f) => ({ ...f, growth_stage: (e.target.value || undefined) as CcrsGrowthStage | undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All stages</option>
              {CCRS_GROWTH_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.plant_state ?? ""} onChange={(e) => setFilters((f) => ({ ...f, plant_state: (e.target.value || undefined) as CcrsPlantState | undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All states</option>
              {CCRS_PLANT_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.strain_id ?? ""} onChange={(e) => setFilters((f) => ({ ...f, strain_id: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border" disabled={strainOptions.length === 0}>
              <option value="">All strains</option>
              {strainOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={filters.area_id ?? ""} onChange={(e) => setFilters((f) => ({ ...f, area_id: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border" disabled={areaOptions.length === 0}>
              <option value="">All areas</option>
              {areaOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={filters.cycle_id ?? ""} onChange={(e) => setFilters((f) => ({ ...f, cycle_id: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border" disabled={cycleOptions.length === 0}>
              <option value="">All cycles</option>
              {cycleOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filters.source_type ?? ""} onChange={(e) => setFilters((f) => ({ ...f, source_type: (e.target.value || undefined) as PlantSourceType | undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All sources</option>
              {PLANT_SOURCE_TYPES.map((t) => <option key={t} value={t}>{t === "tissue_culture" ? "Tissue" : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <select value={String(filters.is_mother ?? "")} onChange={(e) => setFilters((f) => ({ ...f, is_mother: e.target.value === "" ? undefined : e.target.value === "true" }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">Any mother</option>
              <option value="true">Mothers only</option>
              <option value="false">Non-mothers</option>
            </select>
            <select value={ageBucket} onChange={(e) => setAgeBucket(e.target.value as AgeBucket)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">Any age</option>
              <option value="0-30">0–30 days</option>
              <option value="30-60">30–60 days</option>
              <option value="60-90">60–90 days</option>
              <option value="90+">90+ days</option>
            </select>
          </div>
        }
      />

      {/* Bulk actions toolbar */}
      {selected.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 mb-3 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{selected.length}</span>
            <span className="text-muted-foreground">selected</span>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground ml-2"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => { setPhaseTargets(selected); setPhaseOpen(true); }} className="gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5" /> Phase Change
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setMoveTargets(selected); setMoveOpen(true); }} className="gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Move to Area
            </Button>
            <Button size="sm" variant="outline" disabled className="gap-1.5" title="Coming soon">
              <Printer className="w-3.5 h-3.5" /> Print Tags
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1.5">
              <FileDown className="w-3.5 h-3.5" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setDestroyTargets(selected); setDestroyOpen(true); }} className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10">
              <Trash2 className="w-3.5 h-3.5" /> Destroy
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        enableSelection
        onSelectionChange={setSelected}
        empty={{
          icon: Leaf,
          title: plants.length === 0 ? "No plants yet" : "No matches",
          description: plants.length === 0
            ? "Plants are created when you promote grow sources to cycles, or add them manually. Each plant gets a unique identifier for CCRS tracking."
            : "Clear filters or adjust the search to see more plants.",
          action: plants.length === 0 ? (
            <div className="flex items-center gap-2">
              <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Plant Manually
              </Button>
              <Button variant="outline" onClick={() => navigate("/cultivation/sources")} className="gap-1.5">
                Go to Grow Sources →
              </Button>
            </div>
          ) : undefined,
        }}
      />

      <PaginationControls
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
      />

      {/* Modals */}
      <PlantFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        editing={editing}
        onSave={handleSave}
      />
      <PlantPhaseChangeModal
        open={phaseOpen}
        onClose={() => { setPhaseOpen(false); setPhaseTargets([]); }}
        plants={phaseTargets}
        onSuccess={() => { refresh(); setSelected([]); }}
      />
      <DestroyPlantModal
        open={destroyOpen}
        onClose={() => { setDestroyOpen(false); setDestroyTargets([]); }}
        plants={destroyTargets}
        onSuccess={() => { refresh(); setSelected([]); }}
      />
      <MoveToAreaModal
        open={moveOpen}
        onClose={() => { setMoveOpen(false); setMoveTargets([]); }}
        plants={moveTargets}
        onSuccess={() => { refresh(); setSelected([]); }}
      />
    </div>
  );
}

// Unused imports from spec silenced
void Sprout; void Flower2; void Scissors; void Tag;
