import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Leaf, Scissors, MapPin, CalendarDays, Package, Trash2, Building2, ShoppingCart,
  ClipboardList, Users, DollarSign, ShieldCheck, Thermometer, BarChart3, Plus, Star,
  Clock, Mail, Play, Pause, Edit, Trash, FileText, Loader2, Sparkles,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import FiltersBar from "@/components/shared/FiltersBar";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useSavedReports, useToggleFavorite, useScheduledReports, useDeleteSchedule, useUpdateSchedule,
  SavedReport,
} from "@/hooks/useReports";
import { CATEGORY_COLORS, REPORT_CATEGORIES, ReportCategory } from "@/lib/reports/prebuilt";
import { ScheduleReportModal } from "./ScheduleReportModal";
import { ReportBuilderModal } from "./ReportBuilderModal";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, any> = {
  Leaf, Scissors, MapPin, CalendarDays, Package, Trash2, Building2, ShoppingCart,
  ClipboardList, Users, DollarSign, ShieldCheck, Thermometer, BarChart3,
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "prebuilt";
  const setTab = (t: string) => { const next = new URLSearchParams(searchParams); next.set("tab", t); setSearchParams(next, { replace: true }); };

  const { data: reports, loading, refresh } = useSavedReports();
  const { data: schedules, loading: schedulesLoading, refresh: refreshSchedules } = useScheduledReports();
  const toggleFav = useToggleFavorite();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const { setContext, clearContext } = useCodyContext();
  useEffect(() => {
    setContext({ context_type: "reports_list", page_data: { total: reports.length, scheduled: schedules.length } });
    return () => clearContext();
  }, [setContext, clearContext, reports.length, schedules.length]);

  const prebuilt = reports.filter((r) => r.is_system);
  const custom = reports.filter((r) => !r.is_system);
  const favorites = reports.filter((r) => r.is_favorite);

  const filteredPrebuilt = useMemo(() => {
    let out = prebuilt;
    if (categoryFilter) out = out.filter((r) => r.report_category === categoryFilter);
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((r) => `${r.name} ${r.description ?? ""}`.toLowerCase().includes(q));
    return out;
  }, [prebuilt, categoryFilter, search]);

  const filteredCustom = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? custom.filter((r) => `${r.name} ${r.description ?? ""}`.toLowerCase().includes(q)) : custom;
  }, [custom, search]);

  const handleFav = async (report: SavedReport) => {
    try { await toggleFav(report); toast.success(report.is_favorite ? "Removed favorite" : "Added to favorites"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  };

  const scheduleColumns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: "name", header: "Report", cell: ({ row }) => <span className="text-[12px] font-medium">{row.original.name}</span> },
    { accessorKey: "schedule_cron", header: "Schedule", cell: ({ row }) => <span className="font-mono text-[11px]">{cronHuman(row.original.schedule_cron)}</span> },
    { accessorKey: "format", header: "Format", cell: ({ row }) => <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">{row.original.format ?? "csv"}</span> },
    { id: "recipients", header: "Recipients", cell: ({ row }) => {
      const emails = (row.original.recipient_emails ?? []) as string[];
      return emails.length === 0 ? <span className="text-muted-foreground">—</span> : <span className="text-[11px]">{emails[0]}{emails.length > 1 && ` +${emails.length - 1}`}</span>;
    } },
    { accessorKey: "last_run_at", header: "Last Run", cell: ({ row }) => row.original.last_run_at ? <DateTime value={row.original.last_run_at} format="date-only" className="text-[12px]" /> : <span className="text-muted-foreground">Never</span> },
    { accessorKey: "next_run_at", header: "Next Run", cell: ({ row }) => row.original.next_run_at ? <DateTime value={row.original.next_run_at} format="date-only" className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "is_active", header: "Status", cell: ({ row }) => <StatusPill label={row.original.is_active ? "Active" : "Paused"} variant={row.original.is_active ? "success" : "muted"} /> },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="p-1 rounded hover:bg-accent">⋯</button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast.info("Run now — coming when scheduler is live")}><Play className="w-3.5 h-3.5" /> Run Now</DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { try { await updateSchedule(row.original.id, { is_active: !row.original.is_active }); toast.success(row.original.is_active ? "Paused" : "Resumed"); refreshSchedules(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }}>
                {row.original.is_active ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Resume</>}
              </DropdownMenuItem>
              <DropdownMenuItem disabled><Edit className="w-3.5 h-3.5" /> Edit (soon)</DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { try { await deleteSchedule(row.original.id); toast.success("Deleted"); refreshSchedules(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                <Trash className="w-3.5 h-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title="Reports"
        description="Prebuilt analytics and custom report builder"
        breadcrumbs={[{ label: "Reports" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setScheduleOpen(true)} className="gap-1.5"><Mail className="w-3.5 h-3.5" /> Schedule Report</Button>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Custom Report</Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="prebuilt">Prebuilt ({prebuilt.length})</TabsTrigger>
          <TabsTrigger value="custom">My Reports ({custom.length})</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({schedules.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="prebuilt">
          {favorites.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Favorites</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {favorites.map((r) => <ReportCard key={r.id} report={r} onRun={() => navigate(`/reports/${r.id}`)} onFavorite={() => handleFav(r)} />)}
              </div>
            </div>
          )}
          <FiltersBar
            searchValue={search} onSearchChange={setSearch}
            searchPlaceholder="Search reports…"
            actions={
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
                <option value="">All categories</option>
                {REPORT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            }
          />
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {REPORT_CATEGORIES.map((cat) => {
                const list = filteredPrebuilt.filter((r) => r.report_category === cat.key);
                if (list.length === 0) return null;
                const color = CATEGORY_COLORS[cat.key];
                return (
                  <div key={cat.key} className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-[13px] font-semibold">{cat.label}</h3>
                      <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wider", color.bg, color.text)}>{list.length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {list.map((r) => <ReportCard key={r.id} report={r} onRun={() => navigate(`/reports/${r.id}`)} onFavorite={() => handleFav(r)} />)}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </TabsContent>

        <TabsContent value="custom">
          <FiltersBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search my reports…" />
          {filteredCustom.length === 0 ? (
            <EmptyState icon={FileText} title="No custom reports yet" description="Build a report from any data source with filters, grouping, and charts." action={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Custom Report</Button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredCustom.map((r) => <ReportCard key={r.id} report={r} onRun={() => navigate(`/reports/${r.id}`)} onFavorite={() => handleFav(r)} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduled">
          <DataTable
            columns={scheduleColumns}
            data={schedules}
            loading={schedulesLoading}
            empty={{ icon: Clock, title: "No scheduled reports", description: "Schedule a report for automatic email delivery.", action: <Button onClick={() => setScheduleOpen(true)} className="gap-1.5"><Mail className="w-3.5 h-3.5" /> Schedule Report</Button> }}
          />
        </TabsContent>
      </Tabs>

      <ReportBuilderModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => refresh()} />
      <ScheduleReportModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} reports={reports} onSuccess={() => refreshSchedules()} />
    </div>
  );
}

function ReportCard({ report, onRun, onFavorite }: { report: SavedReport; onRun: () => void; onFavorite: () => void }) {
  const category = report.report_category as ReportCategory;
  const color = CATEGORY_COLORS[category] ?? { bg: "bg-muted", text: "text-muted-foreground" };
  const iconKey = (report.query_config as any)?.prebuilt_key ? getIconKeyForPrebuilt(report) : "BarChart3";
  const Icon = ICON_MAP[iconKey] ?? Sparkles;
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <button onClick={onFavorite} className="p-1 rounded hover:bg-accent" aria-label="Favorite">
          <Star className={cn("w-3.5 h-3.5", report.is_favorite ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
        </button>
      </div>
      <h4 className="text-[13px] font-semibold leading-snug">{report.name}</h4>
      {report.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{report.description}</p>}
      <div className="flex items-center justify-between mt-3 gap-2">
        <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wider", color.bg, color.text)}>{category}</span>
        <Button size="sm" variant="outline" onClick={onRun} className="gap-1.5 h-7 text-[11px]">
          <Play className="w-3 h-3" /> Run
        </Button>
      </div>
    </div>
  );
}

function getIconKeyForPrebuilt(r: SavedReport): string {
  // Map to icon based on category as fallback
  const key = (r.query_config as any)?.prebuilt_key as string | undefined;
  const map: Record<string, string> = {
    active_plants_by_strain: "Leaf",
    yield_per_strain: "Scissors",
    grams_per_sqft_by_area: "MapPin",
    upcoming_harvests: "CalendarDays",
    inventory_aging: "Package",
    waste_log_by_type: "Trash2",
    top_customers: "Building2",
    sales_by_category: "ShoppingCart",
    tasks_overdue: "ClipboardList",
    employee_performance: "Users",
    labor_cost_per_batch: "DollarSign",
    ar_aging: "DollarSign",
    ccrs_compliance_status: "ShieldCheck",
    environmental_anomalies: "Thermometer",
  };
  return (key && map[key]) || "BarChart3";
}

function cronHuman(cron: string): string {
  if (cron === "0 8 * * 1") return "Every Monday at 8:00 AM";
  if (cron === "0 8 * * *") return "Every day at 8:00 AM";
  if (cron === "0 8 1 * *") return "1st of each month at 8:00 AM";
  return cron;
}
