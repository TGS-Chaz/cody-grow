import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FileText, Plus, Eye, MoreHorizontal, FileEdit, Truck, CheckCircle, ShieldCheck, Archive, Send,
  XCircle, Download, Printer,
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
import StatusPill from "@/components/shared/StatusPill";
import DateTime from "@/components/shared/DateTime";
import CopyableId from "@/components/shared/CopyableId";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useManifests, useManifestStats, useCancelManifest, Manifest, ManifestFilters,
} from "@/hooks/useManifests";
import {
  MANIFEST_STATUSES, MANIFEST_TYPES, ManifestStatus, ManifestType,
} from "@/lib/schema-enums";
import { CreateManifestModal } from "./ManifestModal";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "warning" | "critical" | "info" | "muted"> = {
  draft: "muted", generated: "info", uploaded_to_ccrs: "info", ccrs_confirmed: "info",
  in_transit: "warning", accepted: "success", rejected: "critical", cancelled: "critical",
};

const TYPE_LABELS: Record<ManifestType, string> = {
  outbound: "Outbound", inbound: "Inbound", return: "Return",
  qa_sample: "QA Sample", trade_sample: "Trade Sample",
};

export default function ManifestsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<ManifestFilters>({});
  const { data: manifests, loading, refresh } = useManifests(filters);
  const stats = useManifestStats(manifests);
  const cancel = useCancelManifest();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [initialOrderId, setInitialOrderId] = useState<string | undefined>();
  const [initialAccountId, setInitialAccountId] = useState<string | undefined>();

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setInitialOrderId(searchParams.get("order_id") ?? undefined);
      setInitialAccountId(searchParams.get("account_id") ?? undefined);
      setCreateOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("create"); next.delete("order_id"); next.delete("account_id");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useShortcut(["n"], () => setCreateOpen(true), { description: "Create manifest", scope: "Manifests", enabled: !createOpen });
  useShortcut(["/"], () => document.querySelector<HTMLInputElement>("[data-filters-search]")?.focus(), { description: "Focus search", scope: "Manifests" });

  const { setContext, clearContext } = useCodyContext();
  const payload = useMemo(() => ({
    stats, filters,
    manifests: manifests.slice(0, 40).map((m) => ({
      external_id: m.external_id, type: m.manifest_type, status: m.status,
      destination: m.destination_license_name, order: m.order?.order_number,
    })),
  }), [stats, filters, manifests]);
  useEffect(() => {
    setContext({ context_type: "manifests_list", page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return manifests;
    return manifests.filter((m) => `${m.external_id} ${m.destination_license_name ?? ""} ${m.destination_license_number} ${m.order?.order_number ?? ""}`.toLowerCase().includes(q));
  }, [manifests, search]);

  const columns: ColumnDef<Manifest>[] = useMemo(() => [
    { accessorKey: "external_id", header: "Manifest ID", cell: ({ row }) => <button onClick={() => navigate(`/sales/manifests/${row.original.id}`)} className="text-left"><CopyableId value={row.original.external_id} className="text-[11px]" truncate={6} /></button> },
    { accessorKey: "manifest_type", header: "Type", cell: ({ row }) => <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">{TYPE_LABELS[row.original.manifest_type]}</span> },
    { id: "order", header: "Order", cell: ({ row }) => row.original.order ? <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/orders/${row.original.order!.id}`); }} className="font-mono text-[12px] text-primary hover:underline">{row.original.order.order_number}</button> : <span className="text-muted-foreground italic">—</span> },
    { id: "destination", header: "Destination", cell: ({ row }) => (
      <div className="text-[12px]">
        <div className="font-mono font-semibold">{row.original.destination_license_number}</div>
        {row.original.destination_license_name && <div className="text-[11px] text-muted-foreground">{row.original.destination_license_name}</div>}
      </div>
    ) },
    { id: "driver", header: "Driver", cell: ({ row }) => row.original.driver ? `${row.original.driver.first_name ?? ""} ${row.original.driver.last_name ?? ""}`.trim() : row.original.driver_name ?? <span className="text-muted-foreground">—</span> },
    { id: "vehicle", header: "Vehicle", cell: ({ row }) => row.original.vehicle ? <span className="font-mono text-[11px]">{row.original.vehicle.license_plate}</span> : row.original.vehicle_license_plate ? <span className="font-mono text-[11px]">{row.original.vehicle_license_plate}</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "departure_datetime", header: "Departure", cell: ({ row }) => row.original.departure_datetime ? <DateTime value={row.original.departure_datetime} className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => row.original.status ? <StatusPill label={row.original.status.replace(/_/g, " ")} variant={STATUS_VARIANT[row.original.status] ?? "muted"} /> : <span className="text-muted-foreground">—</span> },
    { id: "ccrs", header: "CCRS", cell: ({ row }) => row.original.ccrs_submitted_at ? <ShieldCheck className="w-4 h-4 text-emerald-500" aria-label="Uploaded" /> : <span className="text-muted-foreground text-[10px]">pending</span> },
    { id: "wcia", header: "WCIA", cell: ({ row }) => row.original.wcia_json_data ? <Send className="w-4 h-4 text-purple-500" aria-label="WCIA generated" /> : <span className="text-muted-foreground">—</span> },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/sales/manifests/${row.original.id}`)}><Eye className="w-3.5 h-3.5" /> View</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/sales/manifests/${row.original.id}?tab=ccrs`)}><Download className="w-3.5 h-3.5" /> Generate CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/sales/manifests/${row.original.id}?tab=overview&print=1`)}><Printer className="w-3.5 h-3.5" /> Print</DropdownMenuItem>
              <DropdownMenuSeparator />
              {row.original.status !== "cancelled" && row.original.status !== "accepted" && (
                <DropdownMenuItem onClick={async () => { try { await cancel(row.original.id); toast.success("Cancelled"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                  <XCircle className="w-3.5 h-3.5" /> Cancel
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
        title="Manifests"
        description="Transportation documents for CCRS compliance"
        breadcrumbs={[{ label: "Sales & Fulfillment" }, { label: "Manifests" }]}
        actions={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Manifest</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Draft" value={stats.draft} accentClass="stat-accent-blue" delay={0.05} />
        <StatCard label="In Transit" value={stats.in_transit} accentClass="stat-accent-amber" delay={0.1} />
        <StatCard label="Accepted" value={stats.accepted} accentClass="stat-accent-emerald" delay={0.15} />
        <StatCard label="CCRS Uploaded" value={stats.uploaded} accentClass="stat-accent-teal" delay={0.2} />
      </div>

      <FiltersBar
        searchValue={search} onSearchChange={setSearch}
        searchPlaceholder="Search manifest ID, destination, order…"
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={filters.status ?? ""} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as ManifestStatus || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All statuses</option>
              {MANIFEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.type ?? ""} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as ManifestType || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All types</option>
              {MANIFEST_TYPES.filter((t) => t !== "inbound").map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
        }
      />

      <DataTable
        columns={columns} data={filtered} loading={loading}
        empty={{
          icon: FileText,
          title: manifests.length === 0 ? "No manifests yet" : "No matches",
          description: manifests.length === 0 ? "Manifests are generated from allocated orders. Create an order, allocate inventory, then generate a manifest." : "Clear filters or adjust the search.",
          action: manifests.length === 0 ? <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Manifest</Button> : undefined,
        }}
      />

      <CreateManifestModal open={createOpen} onClose={() => setCreateOpen(false)} initialOrderId={initialOrderId} initialAccountId={initialAccountId} onSuccess={(m) => { refresh(); navigate(`/sales/manifests/${m.id}`); }} />
    </div>
  );
}

void cn; void FileEdit; void Truck; void CheckCircle; void Archive;
