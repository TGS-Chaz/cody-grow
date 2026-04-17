import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Barcode, Plus, Eye, MoreHorizontal, Scissors, Sliders, CheckCircle2, ShieldAlert, Combine,
  PackageOpen, Heart, Scale, ShieldCheck, XCircle, Store, Send, Archive, Package,
  ShoppingCart,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import PaginationControls from "@/components/shared/PaginationControls";
import StatusPill from "@/components/shared/StatusPill";
import DateTime from "@/components/shared/DateTime";
import CopyableId from "@/components/shared/CopyableId";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import { useBatches, useBatchStats, useMakeBatchAvailable, Batch, BatchFilters } from "@/hooks/useBatches";
import {
  CCRS_INVENTORY_CATEGORIES, CCRS_INVENTORY_CATEGORY_LABELS, CCRS_INVENTORY_CATEGORY_COLORS, CcrsInventoryCategory,
  STRAIN_TYPE_COLORS, StrainType,
} from "@/lib/schema-enums";
import { CreateBatchModal, SublotModal, AdjustInventoryModal } from "./BatchModals";
import { BlendBatchesModal } from "./BlendBatchesModal";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  harvest: "Harvest",
  production: "Production",
  sublot: "Sublot",
  inbound_transfer: "Transfer",
  manual: "Manual",
};

const QA_VARIANT: Record<NonNullable<Batch["qa_status"]>, { label: string; variant: "success" | "critical" | "warning" | "muted" }> = {
  passed: { label: "Passed", variant: "success" },
  failed: { label: "Failed", variant: "critical" },
  pending: { label: "Pending", variant: "warning" },
  not_required: { label: "N/A", variant: "muted" },
};

export default function BatchesPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<BatchFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const paginatedFilters = useMemo<BatchFilters>(() => ({ ...filters, page, pageSize }), [filters, page, pageSize]);
  const filterSig = useMemo(() => Object.values(filters).map((v) => v ?? "").join(":"), [filters]);
  useEffect(() => { setPage(1); }, [filterSig]);
  const { data: batches, loading, refresh, totalCount } = useBatches(paginatedFilters);
  const stats = useBatchStats(batches);
  const makeAvailable = useMakeBatchAvailable();
  const { setContext, clearContext } = useCodyContext();

  const [searchValue, setSearchValue] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"" | CcrsInventoryCategory>("");
  const [qaFilter, setQaFilter] = useState<"" | "passed" | "failed" | "pending" | "not_required">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [blendOpen, setBlendOpen] = useState(false);
  const [sublotBatch, setSublotBatch] = useState<Batch | null>(null);
  const [adjustBatch, setAdjustBatch] = useState<Batch | null>(null);
  const [selectedRows, setSelectedRows] = useState<Batch[]>([]);

  const sig = useMemo(() => batches.map((b) => `${b.id}:${b.current_quantity}:${b.is_available}:${b.qa_status}`).join(","), [batches]);
  const payload = useMemo(() => ({
    stats,
    filters,
    counts_by_source: batches.reduce<Record<string, number>>((acc, b) => {
      const k = b.source_type ?? "unknown";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
    availability_breakdown: {
      available: stats.available,
      quarantined: stats.quarantined,
      depleted: stats.depleted,
    },
    batches: batches.slice(0, 40).map((b) => ({
      barcode: b.barcode,
      product: b.product?.name,
      strain: b.strain?.name,
      current_qty: b.current_quantity,
      initial_qty: b.initial_quantity,
      source: b.source_type,
      qa: b.qa_status,
      available: b.is_available,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sig, stats.total]);

  useEffect(() => {
    setContext({ context_type: "batches_list", page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload]);

  useShortcut(["n"], () => setCreateOpen(true), { description: "Create batch", scope: "Batches", enabled: !createOpen && !sublotBatch && !adjustBatch });
  useShortcut(["/"], () => document.querySelector<HTMLInputElement>("[data-filters-search]")?.focus(), { description: "Focus search", scope: "Batches" });
  useShortcut(["s"], () => {
    if (selectedRows.length === 1) setSublotBatch(selectedRows[0]);
  }, { description: "Sublot selected", scope: "Batches", enabled: selectedRows.length === 1 });
  useShortcut(["a"], () => {
    if (selectedRows.length === 1) setAdjustBatch(selectedRows[0]);
  }, { description: "Adjust selected", scope: "Batches", enabled: selectedRows.length === 1 });

  const strainOptions = useMemo(() => {
    const m = new Map<string, string>();
    batches.forEach((b) => { if (b.strain) m.set(b.strain.id, b.strain.name); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [batches]);
  const areaOptions = useMemo(() => {
    const m = new Map<string, string>();
    batches.forEach((b) => { if (b.area) m.set(b.area.id, b.area.name); });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [batches]);

  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return batches.filter((b) => {
      if (q) {
        const hay = `${b.barcode} ${b.external_id} ${b.product?.name ?? ""} ${b.strain?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categoryFilter && b.product?.ccrs_inventory_category !== categoryFilter) return false;
      if (qaFilter && b.qa_status !== qaFilter) return false;
      return true;
    });
  }, [batches, searchValue, categoryFilter, qaFilter]);

  const handleMakeAvailable = async (batch: Batch) => {
    try {
      await makeAvailable(batch.id);
      toast.success(`${batch.barcode} is now available`);
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  };

  const handleBulkMakeAvailable = async () => {
    try {
      await Promise.all(selectedRows.map((b) => makeAvailable(b.id)));
      toast.success(`${selectedRows.length} batch${selectedRows.length === 1 ? "" : "es"} now available`);
      refresh();
      setSelectedRows([]);
    } catch (err: any) {
      toast.error(err?.message ?? "Bulk update failed");
    }
  };

  const columns: ColumnDef<Batch>[] = useMemo(() => [
    {
      accessorKey: "barcode", header: "Barcode",
      cell: ({ row }) => (
        <button onClick={() => navigate(`/inventory/batches/${row.original.id}`)} className="text-[12px] font-mono font-semibold text-primary hover:underline text-left">
          {row.original.barcode}
        </button>
      ),
    },
    {
      accessorKey: "external_id", header: "External ID",
      cell: ({ row }) => <CopyableId value={row.original.external_id} className="text-[11px]" />,
    },
    {
      id: "product", header: "Product",
      cell: ({ row }) => {
        const p = row.original.product;
        if (!p) return <span className="text-muted-foreground text-[12px]">—</span>;
        const cat = p.ccrs_inventory_category as CcrsInventoryCategory | null;
        const c = cat ? CCRS_INVENTORY_CATEGORY_COLORS[cat] : null;
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <button onClick={(e) => { e.stopPropagation(); navigate(`/cultivation/products/${p.id}`); }} className="text-[12px] text-primary hover:underline truncate">
              {p.name}
            </button>
            {c && cat && (
              <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", c.bg, c.text)}>
                {CCRS_INVENTORY_CATEGORY_LABELS[cat]}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "strain", header: "Strain",
      cell: ({ row }) => {
        const s = row.original.strain;
        if (!s) return <span className="text-muted-foreground text-[12px]">—</span>;
        const type = s.type as StrainType | null;
        const c = type ? STRAIN_TYPE_COLORS[type] : null;
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <button onClick={(e) => { e.stopPropagation(); navigate(`/cultivation/strains/${s.id}`); }} className="text-[12px] text-primary hover:underline truncate">
              {s.name}
            </button>
            {c && type && (
              <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", c.bg, c.text)}>{type}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "quantity", header: "Qty",
      cell: ({ row }) => {
        const init = Number(row.original.initial_quantity ?? 0);
        const cur = Number(row.original.current_quantity ?? 0);
        const pct = init > 0 ? cur / init : 1;
        return (
          <span className="font-mono text-[12px]">
            <span className="text-muted-foreground">{init.toFixed(0)}g</span>
            <span className="text-muted-foreground/50 mx-1">/</span>
            <span className={cn("font-semibold", cur === 0 ? "text-muted-foreground" : pct < 0.1 ? "text-destructive" : "text-foreground")}>{cur.toFixed(0)}g</span>
          </span>
        );
      },
    },
    {
      id: "source", header: "Source",
      cell: ({ row }) => {
        const src = row.original.source_type ?? "manual";
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">
              {SOURCE_LABELS[src] ?? src}
            </span>
            {row.original.harvest && (
              <button onClick={(e) => { e.stopPropagation(); navigate(`/cultivation/harvests/${row.original.harvest!.id}`); }} className="text-[11px] text-primary hover:underline truncate">
                {row.original.harvest.name}
              </button>
            )}
          </div>
        );
      },
    },
    {
      id: "parent", header: "Parent",
      cell: ({ row }) => row.original.parent_batch
        ? <button onClick={(e) => { e.stopPropagation(); navigate(`/inventory/batches/${row.original.parent_batch!.id}`); }} className="text-[11px] font-mono text-primary hover:underline">{row.original.parent_batch.barcode}</button>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "area", header: "Area",
      cell: ({ row }) => row.original.area
        ? <button onClick={(e) => { e.stopPropagation(); navigate(`/cultivation/areas/${row.original.area!.id}`); }} className="text-[12px] text-primary hover:underline truncate">{row.original.area.name}</button>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "qa", header: "QA",
      cell: ({ row }) => {
        const s = row.original.qa_status;
        if (!s) return <StatusPill label="N/A" variant="muted" />;
        const v = QA_VARIANT[s];
        return <StatusPill label={v.label} variant={v.variant} />;
      },
    },
    {
      id: "available", header: "Avail",
      cell: ({ row }) => row.original.is_available
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-label="Available" />
        : <XCircle className="w-4 h-4 text-muted-foreground/50" aria-label="Not available" />,
    },
    {
      id: "badges", header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.is_medical && <Heart className="w-3.5 h-3.5 text-pink-500" aria-label="Medical" />}
          {row.original.is_doh_compliant && <ShieldCheck className="w-3.5 h-3.5 text-blue-500" aria-label="DOH" />}
          {(row.original.marketplace_menu_ids?.length ?? 0) > 0 && <Store className="w-3.5 h-3.5 text-purple-500" aria-label="Marketplace" />}
        </div>
      ),
    },
    {
      accessorKey: "created_at", header: "Created",
      cell: ({ row }) => row.original.created_at
        ? <DateTime value={row.original.created_at} format="date-only" className="text-[12px]" />
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/inventory/batches/${row.original.id}`)}>
                <Eye className="w-3.5 h-3.5" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSublotBatch(row.original)}>
                <Scissors className="w-3.5 h-3.5" /> Sublot
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAdjustBatch(row.original)}>
                <Sliders className="w-3.5 h-3.5" /> Adjust
              </DropdownMenuItem>
              {!row.original.is_available && (
                <DropdownMenuItem onClick={() => handleMakeAvailable(row.original)}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Make Available
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <Send className="w-3.5 h-3.5" /> Transfer (soon)
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <ShoppingCart className="w-3.5 h-3.5" /> Create Order (soon)
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="text-destructive">
                <Archive className="w-3.5 h-3.5" /> Archive (soon)
              </DropdownMenuItem>
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
        title="Inventory"
        description="Track every batch from harvest to sale"
        breadcrumbs={[{ label: "Inventory" }, { label: "Batches" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBlendOpen(true)} className="gap-1.5">
              <Combine className="w-3.5 h-3.5" /> Blend Batches
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Create Batch
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total Batches" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Available" value={stats.available} accentClass="stat-accent-emerald" delay={0.05} />
        <StatCard label="QA / Quarantined" value={stats.quarantined} accentClass="stat-accent-amber" delay={0.1} />
        <StatCard label="Depleted" value={stats.depleted} accentClass="stat-accent-blue" delay={0.15} />
        <StatCard label="Medical" value={stats.medical} accentClass="stat-accent-amber" delay={0.2} />
        <StatCard label="Total Weight" value={`${(stats.totalWeight / 1000).toFixed(1)}kg`} accentClass="stat-accent-teal" delay={0.25} />
      </div>

      <FiltersBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search barcode, external ID, product, strain…"
        pageKey="batches"
        currentFilters={{ ...filters, categoryFilter, qaFilter, search: searchValue }}
        onApplyView={(f) => {
          setFilters({
            source_type: f.source_type, strain_id: f.strain_id, area_id: f.area_id,
            is_available: f.is_available, is_medical: f.is_medical, is_doh_compliant: f.is_doh_compliant,
          });
          setCategoryFilter(f.categoryFilter ?? "");
          setQaFilter(f.qaFilter ?? "");
          setSearchValue(f.search ?? "");
        }}
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={filters.source_type ?? ""} onChange={(e) => setFilters((f) => ({ ...f, source_type: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All sources</option>
              {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All categories</option>
              {CCRS_INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{CCRS_INVENTORY_CATEGORY_LABELS[c]}</option>)}
            </select>
            <select value={filters.strain_id ?? ""} onChange={(e) => setFilters((f) => ({ ...f, strain_id: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border" disabled={strainOptions.length === 0}>
              <option value="">All strains</option>
              {strainOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={filters.area_id ?? ""} onChange={(e) => setFilters((f) => ({ ...f, area_id: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border" disabled={areaOptions.length === 0}>
              <option value="">All areas</option>
              {areaOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={filters.is_available == null ? "" : String(filters.is_available)} onChange={(e) => setFilters((f) => ({ ...f, is_available: e.target.value === "" ? undefined : e.target.value === "true" }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">Any availability</option>
              <option value="true">Available</option>
              <option value="false">Not available</option>
            </select>
            <select value={filters.is_medical == null ? "" : String(filters.is_medical)} onChange={(e) => setFilters((f) => ({ ...f, is_medical: e.target.value === "" ? undefined : e.target.value === "true" }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">Any medical</option>
              <option value="true">Medical</option>
              <option value="false">Recreational</option>
            </select>
            <select value={filters.is_doh_compliant == null ? "" : String(filters.is_doh_compliant)} onChange={(e) => setFilters((f) => ({ ...f, is_doh_compliant: e.target.value === "" ? undefined : e.target.value === "true" }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">Any DOH</option>
              <option value="true">DOH compliant</option>
              <option value="false">Not DOH</option>
            </select>
            <select value={qaFilter} onChange={(e) => setQaFilter(e.target.value as any)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">Any QA</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="not_required">Not required</option>
            </select>
            <select value={filters.has_parent == null ? "" : String(filters.has_parent)} onChange={(e) => setFilters((f) => ({ ...f, has_parent: e.target.value === "" ? undefined : e.target.value === "true" }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All</option>
              <option value="true">Sublots only</option>
              <option value="false">Top-level only</option>
            </select>
          </div>
        }
      />

      {selectedRows.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2 rounded-lg border border-primary/30 bg-primary/5">
          <span className="text-[12px] font-medium">{selectedRows.length} selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleBulkMakeAvailable} className="gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Make Available
            </Button>
            <Button size="sm" variant="outline" onClick={() => selectedRows.length === 1 && setAdjustBatch(selectedRows[0])} disabled={selectedRows.length !== 1} className="gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> Adjust
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedRows([])}>Clear</Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        enableSelection
        onSelectionChange={setSelectedRows}
        empty={{
          icon: Barcode,
          title: batches.length === 0 ? "No batches yet" : "No matches",
          description: batches.length === 0
            ? "Batches are created when you finish a harvest, complete a production run, or receive an inbound transfer. You can also create one manually."
            : "Clear filters or adjust the search.",
          action: batches.length === 0 ? (
            <div className="flex items-center gap-2">
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Batch</Button>
              <Button variant="outline" onClick={() => navigate("/cultivation/harvests")} className="gap-1.5">Go to Harvests</Button>
            </div>
          ) : undefined,
        }}
      />

      <PaginationControls
        page={page} pageSize={pageSize} totalCount={totalCount}
        totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
      />

      <CreateBatchModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => refresh()} />
      <SublotModal open={!!sublotBatch} onClose={() => setSublotBatch(null)} parent={sublotBatch} onSuccess={() => refresh()} />
      <AdjustInventoryModal open={!!adjustBatch} onClose={() => setAdjustBatch(null)} batch={adjustBatch} onSuccess={() => refresh()} />
      <BlendBatchesModal open={blendOpen} onClose={() => setBlendOpen(false)} initialBatches={selectedRows} onSuccess={() => { setSelectedRows([]); refresh(); }} />
    </div>
  );
}

void Package; void PackageOpen; void ShieldAlert; void Scale;
