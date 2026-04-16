import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Factory, Plus, Eye, MoreHorizontal, FileEdit, Play, CheckCircle, XCircle, FileStack,
  Archive, Copy, Edit,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import StatusPill from "@/components/shared/StatusPill";
import DateTime from "@/components/shared/DateTime";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useBOMs, useProductionRuns, useProductionRunStats, useStartProductionRun,
  useArchiveBOM, useVoidProductionRun, BOM, ProductionRun,
} from "@/hooks/useProduction";
import {
  CCRS_INVENTORY_CATEGORY_LABELS, CCRS_INVENTORY_CATEGORY_COLORS, CcrsInventoryCategory,
} from "@/lib/schema-enums";
import { CreateBOMModal, CreateProductionRunModal } from "./ProductionModals";
import { cn } from "@/lib/utils";

const RUN_STATUS_VARIANT: Record<string, "success" | "warning" | "critical" | "info" | "muted"> = {
  draft: "muted",
  in_progress: "warning",
  finalized: "success",
  voided: "critical",
};

export default function ProductionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "runs";
  const setTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const { data: runs, loading: runsLoading, refresh: refreshRuns } = useProductionRuns();
  const { data: boms, loading: bomsLoading, refresh: refreshBoms } = useBOMs();
  const runStats = useProductionRunStats(runs);
  const startRun = useStartProductionRun();
  const voidRun = useVoidProductionRun();
  const archiveBom = useArchiveBOM();

  const [createBomOpen, setCreateBomOpen] = useState(false);
  const [createRunOpen, setCreateRunOpen] = useState(false);
  const [search, setSearch] = useState("");

  const modalOpen = createBomOpen || createRunOpen;

  useShortcut(["n"], () => {
    if (tab === "runs") setCreateRunOpen(true);
    else setCreateBomOpen(true);
  }, { description: "New entry", scope: "Production", enabled: !modalOpen });
  useShortcut(["/"], () => document.querySelector<HTMLInputElement>("[data-filters-search]")?.focus(), { description: "Focus search", scope: "Production" });

  const { setContext, clearContext } = useCodyContext();
  const payload = useMemo(() => ({
    tab,
    run_stats: runStats,
    active_boms: boms.filter((b) => b.is_active).length,
    total_boms: boms.length,
    recent_runs: runs.slice(0, 10).map((r) => ({
      name: r.name, bom: r.bom?.name, product: r.output_product?.name,
      status: r.status, yield_g: r.yield_weight_grams, inputs: r.input_count,
    })),
  }), [tab, runStats, boms, runs]);
  useEffect(() => {
    setContext({ context_type: "production_list", page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload]);

  const filteredRuns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) => `${r.name} ${r.bom?.name ?? ""} ${r.output_product?.name ?? ""}`.toLowerCase().includes(q));
  }, [runs, search]);
  const filteredBoms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return boms;
    return boms.filter((b) => `${b.name} ${b.output_product?.name ?? ""}`.toLowerCase().includes(q));
  }, [boms, search]);

  const distinctProductsCovered = useMemo(() => {
    return new Set(boms.filter((b) => b.is_active).map((b) => b.output_product_id).filter(Boolean)).size;
  }, [boms]);

  const runColumns: ColumnDef<ProductionRun>[] = useMemo(() => [
    { accessorKey: "name", header: "Run Name", cell: ({ row }) => <button onClick={() => navigate(`/inventory/production/${row.original.id}`)} className="text-[12px] font-medium text-primary hover:underline text-left">{row.original.name}</button> },
    { id: "bom", header: "BOM", cell: ({ row }) => row.original.bom
      ? <button onClick={(e) => { e.stopPropagation(); navigate(`/inventory/production/bom/${row.original.bom!.id}`); }} className="text-[12px] text-primary hover:underline truncate">{row.original.bom.name}</button>
      : <span className="text-muted-foreground italic text-[12px]">Ad-hoc</span> },
    { id: "product", header: "Output", cell: ({ row }) => {
      const p = row.original.output_product;
      if (!p) return <span className="text-muted-foreground">—</span>;
      const cat = p.ccrs_inventory_category;
      const c = cat ? CCRS_INVENTORY_CATEGORY_COLORS[cat] : null;
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <button onClick={(e) => { e.stopPropagation(); navigate(`/cultivation/products/${p.id}`); }} className="text-[12px] text-primary hover:underline truncate">{p.name}</button>
          {c && cat && <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", c.bg, c.text)}>{CCRS_INVENTORY_CATEGORY_LABELS[cat]}</span>}
        </div>
      );
    } },
    { id: "inputs", header: "Inputs", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.input_count ?? 0}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => row.original.status ? <StatusPill label={row.original.status.replace(/_/g, " ")} variant={RUN_STATUS_VARIANT[row.original.status] ?? "muted"} /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "planned_date", header: "Planned", cell: ({ row }) => row.original.planned_date ? <DateTime value={row.original.planned_date} format="date-only" className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "started_at", header: "Started", cell: ({ row }) => row.original.started_at ? <DateTime value={row.original.started_at} format="date-only" className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "finalized_at", header: "Finalized", cell: ({ row }) => row.original.finalized_at ? <DateTime value={row.original.finalized_at} format="date-only" className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "yield_weight_grams", header: "Yield", cell: ({ row }) => row.original.yield_weight_grams != null ? <span className="font-mono text-[12px] font-semibold">{Number(row.original.yield_weight_grams).toFixed(0)}g</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "waste_weight_grams", header: "Waste", cell: ({ row }) => row.original.waste_weight_grams != null ? <span className="font-mono text-[12px]">{Number(row.original.waste_weight_grams).toFixed(0)}g</span> : <span className="text-muted-foreground">—</span> },
    { id: "area", header: "Area", cell: ({ row }) => row.original.area ? <span className="text-[12px]">{row.original.area.name}</span> : <span className="text-muted-foreground">—</span> },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/inventory/production/${row.original.id}`)}><Eye className="w-3.5 h-3.5" /> View</DropdownMenuItem>
              {row.original.status === "draft" && (
                <DropdownMenuItem onClick={async () => { try { await startRun(row.original.id); toast.success("Run started"); refreshRuns(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }}>
                  <Play className="w-3.5 h-3.5" /> Start
                </DropdownMenuItem>
              )}
              {row.original.status === "in_progress" && (
                <DropdownMenuItem onClick={() => navigate(`/inventory/production/${row.original.id}?finalize=1`)}>
                  <CheckCircle className="w-3.5 h-3.5" /> Finalize
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {row.original.status !== "finalized" && row.original.status !== "voided" && (
                <DropdownMenuItem onClick={async () => { try { await voidRun(row.original.id); toast.success("Voided"); refreshRuns(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                  <XCircle className="w-3.5 h-3.5" /> Void
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate]);

  const bomColumns: ColumnDef<BOM>[] = useMemo(() => [
    { accessorKey: "name", header: "Name", cell: ({ row }) => <button onClick={() => navigate(`/inventory/production/bom/${row.original.id}`)} className="text-[12px] font-medium text-primary hover:underline text-left">{row.original.name}</button> },
    { id: "output", header: "Output Product", cell: ({ row }) => {
      const p = row.original.output_product;
      if (!p) return <span className="text-muted-foreground">—</span>;
      const cat = p.ccrs_inventory_category;
      const c = cat ? CCRS_INVENTORY_CATEGORY_COLORS[cat] : null;
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[12px]">{p.name}</span>
          {c && cat && <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", c.bg, c.text)}>{CCRS_INVENTORY_CATEGORY_LABELS[cat]}</span>}
        </div>
      );
    } },
    { id: "inputs", header: "Inputs", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.input_count ?? 0}</span> },
    { id: "runs", header: "Runs Using", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.run_count ?? 0}</span> },
    { accessorKey: "is_active", header: "Status", cell: ({ row }) => row.original.is_active
      ? <StatusPill label="Active" variant="success" />
      : <StatusPill label="Archived" variant="muted" /> },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/inventory/production/bom/${row.original.id}`)}><Eye className="w-3.5 h-3.5" /> View</DropdownMenuItem>
              <DropdownMenuItem disabled><Edit className="w-3.5 h-3.5" /> Edit (soon)</DropdownMenuItem>
              <DropdownMenuItem disabled><Copy className="w-3.5 h-3.5" /> Duplicate (soon)</DropdownMenuItem>
              {row.original.is_active && (
                <DropdownMenuItem onClick={async () => { try { await archiveBom(row.original.id); toast.success("Archived"); refreshBoms(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                  <Archive className="w-3.5 h-3.5" /> Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate]);

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title="Production"
        description="Transform raw materials into finished products"
        breadcrumbs={[{ label: "Inventory" }, { label: "Production" }]}
        actions={
          <Button onClick={() => { if (tab === "runs") setCreateRunOpen(true); else setCreateBomOpen(true); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> {tab === "runs" ? "Create Production Run" : "Create BOM"}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="runs">Production Runs ({runs.length})</TabsTrigger>
          <TabsTrigger value="boms">Bills of Materials ({boms.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard label="Total Runs" value={runStats.total} accentClass="stat-accent-blue" />
            <StatCard label="Draft" value={runStats.draft} accentClass="stat-accent-blue" delay={0.05} />
            <StatCard label="In Progress" value={runStats.in_progress} accentClass="stat-accent-amber" delay={0.1} />
            <StatCard label="Finalized" value={runStats.finalized} accentClass="stat-accent-emerald" delay={0.15} />
            <StatCard label="Voided" value={runStats.voided} accentClass="stat-accent-blue" delay={0.2} />
          </div>
          <FiltersBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search run, BOM, output product…"
          />
          <DataTable
            columns={runColumns}
            data={filteredRuns}
            loading={runsLoading}
            empty={{
              icon: Factory,
              title: runs.length === 0 ? "No production runs yet" : "No matches",
              description: runs.length === 0 ? "Create a BOM first, then start runs that transform inputs into outputs." : "Clear filters or adjust the search.",
              action: runs.length === 0 ? (
                <div className="flex items-center gap-2">
                  <Button onClick={() => setCreateRunOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Run</Button>
                  <Button variant="outline" onClick={() => { setTab("boms"); setCreateBomOpen(true); }} className="gap-1.5">Create BOM first</Button>
                </div>
              ) : undefined,
            }}
          />
        </TabsContent>

        <TabsContent value="boms">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total BOMs" value={boms.length} accentClass="stat-accent-blue" />
            <StatCard label="Active" value={boms.filter((b) => b.is_active).length} accentClass="stat-accent-emerald" delay={0.05} />
            <StatCard label="Products Covered" value={distinctProductsCovered} accentClass="stat-accent-teal" delay={0.1} />
          </div>
          <FiltersBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search BOM name, output product…"
          />
          <DataTable
            columns={bomColumns}
            data={filteredBoms}
            loading={bomsLoading}
            empty={{
              icon: FileStack,
              title: boms.length === 0 ? "No BOMs yet" : "No matches",
              description: boms.length === 0 ? "BOMs define what inputs produce what outputs — like a recipe." : "Clear filters or adjust the search.",
              action: boms.length === 0 ? <Button onClick={() => setCreateBomOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create BOM</Button> : undefined,
            }}
          />
        </TabsContent>
      </Tabs>

      <CreateBOMModal open={createBomOpen} onClose={() => setCreateBomOpen(false)} onSuccess={() => refreshBoms()} />
      <CreateProductionRunModal open={createRunOpen} onClose={() => setCreateRunOpen(false)} onSuccess={() => refreshRuns()} />
    </div>
  );
}

void FileEdit;
