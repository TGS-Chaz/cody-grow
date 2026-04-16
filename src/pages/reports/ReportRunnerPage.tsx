import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BarChart3, ArrowLeft, Download, Star, Mail, Loader2, Play, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import EmptyState from "@/components/shared/EmptyState";
import DateTime from "@/components/shared/DateTime";
import { useCodyContext } from "@/hooks/useCodyContext";
import { useSavedReport, useRunReport, useToggleFavorite, useExportReport } from "@/hooks/useReports";
import { CATEGORY_COLORS, ReportCategory } from "@/lib/reports/prebuilt";
import { ScheduleReportModal } from "./ScheduleReportModal";
import type { ReportResult } from "@/lib/reports/runReport";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#00D4AA", "#3B82F6", "#A855F7", "#F59E0B", "#EF4444", "#EC4899", "#10B981", "#06B6D4", "#F97316"];

export default function ReportRunnerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: report, loading } = useSavedReport(id);
  const runReport = useRunReport();
  const toggleFav = useToggleFavorite();
  const exportReport = useExportReport();

  const [result, setResult] = useState<ReportResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const run = async (report: any) => {
    if (!report) return;
    setRunning(true);
    setRunError(null);
    try {
      const r = await runReport(report, { dateFrom: dateFrom || null, dateTo: dateTo || null });
      setResult(r);
    } catch (err: any) {
      setRunError(err?.message ?? "Run failed");
    } finally { setRunning(false); }
  };

  useEffect(() => {
    if (report) run(report);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id]);

  const { setContext, clearContext } = useCodyContext();
  useEffect(() => {
    if (!report) return;
    setContext({ context_type: "report_detail", context_id: report.id, page_data: { name: report.name, category: report.report_category, row_count: result?.total ?? 0 } });
    return () => clearContext();
  }, [setContext, clearContext, report, result]);

  if (loading || !report) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const cols = (report.columns_config ?? []) as Array<{ field: string; label: string; format?: string }>;
  const chart = report.chart_config as { type: string; x_field: string; y_field: string } | null;
  const category = report.report_category as ReportCategory;
  const catColor = CATEGORY_COLORS[category] ?? { bg: "bg-muted", text: "text-muted-foreground" };

  const rows = result?.grouped ?? result?.rows ?? [];
  const chartData = rows.slice(0, 20);

  const columns: ColumnDef<any>[] = cols.map((c) => ({
    accessorKey: c.field, header: c.label,
    cell: ({ row }) => formatValue(row.original[c.field], c.format),
  }));

  // Summary stats row
  const summary = useMemo(() => {
    const stats: Array<{ label: string; value: string }> = [
      { label: "Rows", value: String(rows.length) },
    ];
    for (const col of cols) {
      if (col.format === "currency" || col.format === "weight" || col.format === "number") {
        const sum = rows.reduce((s, r) => s + (Number(r[col.field]) || 0), 0);
        stats.push({ label: `Total ${col.label}`, value: formatValue(sum, col.format) });
      }
    }
    return stats.slice(0, 4);
  }, [rows, cols]);

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title={report.name}
        breadcrumbs={[
          { label: "Reports", to: "/reports" },
          { label: report.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider", catColor.bg, catColor.text)}>{category}</span>
            <Button variant="outline" size="icon" onClick={async () => { await toggleFav(report); }} className="w-9 h-9" aria-label="Favorite">
              <Star className={cn("w-4 h-4", report.is_favorite ? "fill-amber-500 text-amber-500" : "")} />
            </Button>
            <Button variant="outline" onClick={() => setScheduleOpen(true)} className="gap-1.5"><Mail className="w-3.5 h-3.5" /> Schedule</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" className="gap-1.5"><Download className="w-3.5 h-3.5" /> Export</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { if (result) exportReport(result, cols, report.name.replace(/\s+/g, "_"), "csv"); toast.success("CSV exported"); }}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { if (result) exportReport(result, cols, report.name.replace(/\s+/g, "_"), "json"); toast.success("JSON exported"); }}>JSON</DropdownMenuItem>
                <DropdownMenuItem disabled>XLSX (soon)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.print()}>PDF (print)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {report.description && <p className="text-[12px] text-muted-foreground -mt-4 mb-6">{report.description}</p>}

      {/* Filters bar */}
      {(report.filters_config as any[] ?? []).length > 0 && (
        <div className="flex items-end gap-3 flex-wrap mb-6 rounded-xl border border-border bg-card p-4">
          {((report.filters_config as any[]) ?? []).map((f: any) =>
            f.type === "date_range" ? (
              <div key="date_range" className="flex items-end gap-2">
                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">From</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">To</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36" />
                </div>
              </div>
            ) : null
          )}
          <Button onClick={() => run(report)} disabled={running} className="gap-1.5">
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Run
          </Button>
        </div>
      )}

      {running && !result ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : runError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
          <div>
            <div className="text-[13px] font-semibold text-destructive">Run failed</div>
            <div className="text-[11px] text-muted-foreground mt-1">{runError}</div>
          </div>
        </div>
      ) : result ? (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {summary.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                <div className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground mb-1">{s.label}</div>
                <div className="text-[22px] font-bold font-mono tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          {chart && chartData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <h3 className="text-[13px] font-semibold mb-4">Visualization</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {renderChart(chart.type, chartData, chart.x_field, chart.y_field)}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Data table */}
          <DataTable
            columns={columns} data={rows}
            empty={{ icon: BarChart3, title: "No data", description: "This report returned no rows for the current filters." }}
          />
        </>
      ) : null}

      <ScheduleReportModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} reports={[report]} initialReportId={report.id} onSuccess={() => {}} />
      {(() => { void navigate; void ArrowLeft; return null; })()}
    </div>
  );
}

function renderChart(type: string, data: any[], xField: string, yField: string) {
  switch (type) {
    case "line":
      return (
        <LineChart data={data}>
          <XAxis dataKey={xField} stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
          <Line type="monotone" dataKey={yField} stroke={CHART_COLORS[0]} strokeWidth={2} />
        </LineChart>
      );
    case "pie":
      return (
        <PieChart>
          <Pie data={data} dataKey={yField} nameKey={xField} cx="50%" cy="50%" outerRadius={100} label>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      );
    case "area":
      return (
        <AreaChart data={data}>
          <XAxis dataKey={xField} stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
          <Area type="monotone" dataKey={yField} stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.3} />
        </AreaChart>
      );
    case "bar":
    default:
      return (
        <BarChart data={data}>
          <XAxis dataKey={xField} stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
          <Bar dataKey={yField} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      );
  }
}

function formatValue(v: any, format?: string): any {
  if (v == null) return "—";
  switch (format) {
    case "number": return <span className="font-mono">{Number(v).toLocaleString()}</span>;
    case "currency": return <span className="font-mono">${Number(v).toFixed(2)}</span>;
    case "weight": return <span className="font-mono">{Number(v).toFixed(1)}g</span>;
    case "percent": return <span className="font-mono">{Number(v).toFixed(2)}%</span>;
    case "date": return typeof v === "string" && v.length > 0 ? <DateTime value={v} format="date-only" className="font-mono text-[12px]" /> : "—";
    default: return <span>{String(v)}</span>;
  }
}
