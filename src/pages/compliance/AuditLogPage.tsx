import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ScrollText, Clock, Users, Calendar, ChevronDown, ChevronRight,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import PaginationControls from "@/components/shared/PaginationControls";
import DateTime from "@/components/shared/DateTime";
import { useCodyContext } from "@/hooks/useCodyContext";
import { useAuditLog, useAuditLogStats, AuditLogEntry, AuditLogFilters } from "@/hooks/useAuditLog";
import { cn } from "@/lib/utils";

const ACTION_STYLES: Record<string, { bg: string; text: string }> = {
  created: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  updated: { bg: "bg-blue-500/10", text: "text-blue-500" },
  deleted: { bg: "bg-red-500/10", text: "text-red-500" },
  phase_changed: { bg: "bg-purple-500/10", text: "text-purple-500" },
  allocated: { bg: "bg-teal-500/10", text: "text-teal-500" },
  destroyed: { bg: "bg-red-500/10", text: "text-red-500" },
  harvested: { bg: "bg-amber-500/10", text: "text-amber-500" },
  finalized: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  adjusted: { bg: "bg-blue-500/10", text: "text-blue-500" },
};

const ENTITY_PATHS: Record<string, (id: string) => string> = {
  plant: (id) => `/cultivation/plants/${id}`,
  grow_cycle: (id) => `/cultivation/cycles/${id}`,
  harvest: (id) => `/cultivation/harvests/${id}`,
  batch: (id) => `/inventory/batches/${id}`,
  qa_lot: (id) => `/inventory/qa/${id}`,
  production_run: (id) => `/inventory/production/${id}`,
  account: (id) => `/sales/accounts/${id}`,
  order: (id) => `/sales/orders/${id}`,
  manifest: (id) => `/sales/manifests/${id}`,
};

export default function AuditLogPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const filterSig = useMemo(() => `${filters.entity_type ?? ""}:${filters.action ?? ""}`, [filters]);
  useEffect(() => { setPage(1); }, [filterSig]);
  const paginated = useMemo<AuditLogFilters>(() => ({ ...filters, page, pageSize }), [filters, page, pageSize]);
  const { data: entries, loading, totalCount } = useAuditLog(paginated, 200);
  const stats = useAuditLogStats(entries);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { setContext, clearContext } = useCodyContext();
  useEffect(() => {
    setContext({ context_type: "audit_log", page_data: { stats, filters, count: entries.length, top_entities: stats.topEntities } });
    return () => clearContext();
  }, [setContext, clearContext, stats, filters, entries.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => `${e.user_email ?? ""} ${e.entity_type} ${e.entity_name ?? ""} ${e.action}`.toLowerCase().includes(q));
  }, [entries, search]);

  const entityTypes = useMemo(() => Array.from(new Set(entries.map((e) => e.entity_type))).sort(), [entries]);
  const actions = useMemo(() => Array.from(new Set(entries.map((e) => e.action))).sort(), [entries]);

  const columns: ColumnDef<AuditLogEntry>[] = useMemo(() => [
    {
      id: "expand", enableSorting: false, header: "",
      cell: ({ row }) => row.original.changes_json ? (
        <button onClick={() => setExpanded((x) => x === row.original.id ? null : row.original.id)} className="p-1 rounded hover:bg-accent">
          {expanded === row.original.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      ) : null,
    },
    { accessorKey: "created_at", header: "When", cell: ({ row }) => row.original.created_at ? <DateTime value={row.original.created_at} className="text-[11px] font-mono" /> : "—" },
    { id: "user", header: "User", cell: ({ row }) => <span className="text-[12px]">{row.original.user_email ?? <span className="text-muted-foreground italic">system</span>}</span> },
    {
      accessorKey: "action", header: "Action",
      cell: ({ row }) => {
        const style = ACTION_STYLES[row.original.action] ?? { bg: "bg-muted", text: "text-muted-foreground" };
        return <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wider", style.bg, style.text)}>{row.original.action.replace(/_/g, " ")}</span>;
      },
    },
    {
      accessorKey: "entity_type", header: "Entity",
      cell: ({ row }) => <span className="text-[12px] capitalize">{row.original.entity_type.replace(/_/g, " ")}</span>,
    },
    {
      id: "name", header: "Name",
      cell: ({ row }) => {
        const href = row.original.entity_id && ENTITY_PATHS[row.original.entity_type]?.(row.original.entity_id);
        const label = row.original.entity_name ?? row.original.entity_id?.slice(0, 8) ?? "—";
        return href
          ? <button onClick={() => navigate(href)} className="text-[12px] text-primary hover:underline truncate max-w-[240px]">{label}</button>
          : <span className="text-[12px] truncate max-w-[240px] inline-block">{label}</span>;
      },
    },
    { id: "ip", header: "IP", cell: ({ row }) => row.original.ip_address ? <span className="font-mono text-[10px] text-muted-foreground">{row.original.ip_address}</span> : <span className="text-muted-foreground">—</span> },
  ], [navigate, expanded]);

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title="Audit Log"
        description="Every compliance-sensitive action, who did it, what changed"
        breadcrumbs={[{ label: "Compliance" }, { label: "Audit Log" }]}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Entries" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Today" value={stats.today} accentClass="stat-accent-emerald" delay={0.05} />
        <StatCard label="Active Users Today" value={stats.activeUsersToday} accentClass="stat-accent-teal" delay={0.1} />
        <StatCard label="This Week" value={stats.thisWeek} accentClass="stat-accent-teal" delay={0.15} />
      </div>

      <FiltersBar
        searchValue={search} onSearchChange={setSearch}
        searchPlaceholder="Search user, entity, action…"
        pageKey="audit_log"
        currentFilters={{ ...filters, search }}
        onApplyView={(f) => {
          setFilters({ entity_type: f.entity_type, action: f.action });
          setSearch(f.search ?? "");
        }}
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={filters.entity_type ?? ""} onChange={(e) => setFilters((f) => ({ ...f, entity_type: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All entities</option>
              {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filters.action ?? ""} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All actions</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {(filters.entity_type || filters.action) && (
              <Button size="sm" variant="ghost" onClick={() => setFilters({})}>Clear</Button>
            )}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        empty={{
          icon: ScrollText,
          title: entries.length === 0 ? "No audit entries yet" : "No matches",
          description: entries.length === 0 ? "Compliance-sensitive actions will be logged here. Try creating an order or completing a harvest." : "Clear filters or adjust search.",
        }}
      />
      <PaginationControls
        page={page} pageSize={pageSize} totalCount={totalCount}
        totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
      />

      {/* Expanded changes preview */}
      {expanded && (() => {
        const entry = entries.find((e) => e.id === expanded);
        if (!entry?.changes_json) return null;
        return (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <h4 className="text-[12px] font-semibold mb-2">Changes for {entry.entity_name ?? entry.entity_type}</h4>
            <pre className="text-[10px] font-mono overflow-x-auto">{JSON.stringify(entry.changes_json, null, 2)}</pre>
          </div>
        );
      })()}
    </div>
  );
}

void Clock; void Users; void Calendar;
