import { useEffect, useMemo, useState } from "react";
import { Plus, X, Loader2, Sparkles, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateReport } from "@/hooks/useReports";
import { runReport, ReportQueryConfig } from "@/lib/reports/runReport";
import { REPORT_CATEGORIES } from "@/lib/reports/prebuilt";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";

const DATA_SOURCES = [
  { value: "grow_plants", label: "Plants", fields: ["id", "plant_identifier", "phase", "ccrs_plant_state", "strain_id", "area_id", "created_at", "updated_at", "harvest_date"] },
  { value: "grow_batches", label: "Batches", fields: ["id", "barcode", "external_id", "product_id", "strain_id", "area_id", "initial_quantity", "current_quantity", "source_type", "is_available", "is_medical", "created_at", "updated_at"] },
  { value: "grow_orders", label: "Orders", fields: ["id", "order_number", "account_id", "status", "sale_type", "subtotal", "tax_total", "total", "created_at", "completed_at"] },
  { value: "grow_harvests", label: "Harvests", fields: ["id", "name", "strain_id", "area_id", "status", "wet_weight_grams", "dry_weight_grams", "waste_weight_grams", "total_plants_harvested", "harvest_started_at"] },
  { value: "grow_cycles", label: "Cycles", fields: ["id", "name", "phase", "strain_id", "area_id", "plant_count", "expected_harvest_date", "start_date"] },
  { value: "grow_accounts", label: "Accounts", fields: ["id", "company_name", "license_number", "license_type", "city", "state", "is_active", "created_at"] },
  { value: "grow_qa_results", label: "QA Results", fields: ["id", "qa_lot_id", "test_date", "thc_total_pct", "cbd_total_pct", "total_terpenes_pct", "overall_pass", "lab_test_status"] },
  { value: "grow_tasks", label: "Tasks", fields: ["id", "title", "task_type", "priority", "status", "assigned_to_user_id", "scheduled_end", "completed_at"] },
  { value: "grow_environmental_readings", label: "Environmental Readings", fields: ["id", "area_id", "reading_type", "value", "unit", "recorded_at"] },
  { value: "grow_disposals", label: "Disposals", fields: ["id", "disposal_type", "ccrs_destruction_reason", "pre_disposal_weight_grams", "destroyed_at"] },
  { value: "grow_manifests", label: "Manifests", fields: ["id", "external_id", "manifest_type", "status", "destination_license_number", "departure_datetime"] },
];

const FILTER_OPS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "ilike", label: "contains" },
];

export function ReportBuilderModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess?: () => void }) {
  const { orgId } = useOrg();
  const createReport = useCreateReport();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("cultivation");
  const [dataSource, setDataSource] = useState(DATA_SOURCES[0].value);
  const [columns, setColumns] = useState<string[]>(DATA_SOURCES[0].fields.slice(0, 5));
  const [filters, setFilters] = useState<Array<{ field: string; op: string; value: string }>>([]);
  const [groupBy, setGroupBy] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortDesc, setSortDesc] = useState(false);
  const [chartType, setChartType] = useState<"none" | "bar" | "line" | "pie" | "area">("none");
  const [chartX, setChartX] = useState("");
  const [chartY, setChartY] = useState("");

  const [preview, setPreview] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const available = DATA_SOURCES.find((s) => s.value === dataSource)?.fields ?? [];

  useEffect(() => {
    if (!open) return;
    setName(""); setDescription(""); setCategory("cultivation");
    setDataSource(DATA_SOURCES[0].value);
    setColumns(DATA_SOURCES[0].fields.slice(0, 5));
    setFilters([]); setGroupBy(""); setSortField(""); setSortDesc(false);
    setChartType("none"); setChartX(""); setChartY("");
  }, [open]);

  // Reset columns when data source changes
  useEffect(() => {
    const fields = DATA_SOURCES.find((s) => s.value === dataSource)?.fields ?? [];
    setColumns(fields.slice(0, 5));
    setGroupBy(""); setSortField(""); setFilters([]);
  }, [dataSource]);

  // Debounced preview
  useEffect(() => {
    if (!open || !orgId) return;
    const handle = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const config = buildConfig();
        const r = await runReport(config, { orgId });
        setPreview((r.grouped ?? r.rows ?? []).slice(0, 10));
      } catch { setPreview([]); }
      finally { setPreviewLoading(false); }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orgId, dataSource, columns, filters, groupBy, sortField, sortDesc]);

  function buildConfig(): ReportQueryConfig {
    return {
      data_source: dataSource,
      columns: columns.length > 0 ? columns : undefined,
      filters: filters.filter((f) => f.field && f.value).map((f) => ({ field: f.field, op: f.op as any, value: coerceValue(f.value) })),
      group_by: groupBy || undefined,
      order_by: sortField ? [{ field: sortField, ascending: !sortDesc }] : undefined,
      limit: 200,
    };
  }

  const toggleColumn = (f: string) => setColumns((c) => c.includes(f) ? c.filter((x) => x !== f) : [...c, f]);
  const addFilter = () => setFilters((f) => [...f, { field: available[0] ?? "", op: "eq", value: "" }]);
  const removeFilter = (i: number) => setFilters((f) => f.filter((_, idx) => idx !== i));
  const updateFilter = (i: number, patch: Partial<{ field: string; op: string; value: string }>) => setFilters((f) => f.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  const valid = name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      await createReport({
        name: name.trim(),
        description: description.trim() || null,
        report_category: category,
        query_config: buildConfig(),
        columns_config: columns.map((f) => ({ field: f, label: humanize(f) })),
        chart_config: chartType !== "none" && chartX && chartY ? { type: chartType, x_field: chartX, y_field: chartY } : null,
      });
      toast.success(`Report "${name}" created`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally { setSaving(false); }
  };

  const previewCols = useMemo(() => columns.length > 0 ? columns : available.slice(0, 4), [columns, available]);

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="xl" onSubmit={handleSubmit}
      header={<ModalHeader icon={<Sparkles className="w-4 h-4 text-primary" />} title="Build custom report" subtitle="Configure on the left, preview on the right" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            Save Report
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-5 gap-0 flex-1 min-h-0 overflow-hidden">
        {/* Left — config */}
        <div className="col-span-2 p-6 space-y-4 overflow-y-auto border-r border-border">
          <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {REPORT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Data source" required>
            <select value={dataSource} onChange={(e) => setDataSource(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {DATA_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Columns" helper="Pick fields to include">
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto rounded-md border border-border p-2">
              {available.map((f) => (
                <label key={f} className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-accent/30 px-1.5 py-1 rounded">
                  <input type="checkbox" checked={columns.includes(f)} onChange={() => toggleColumn(f)} className="w-3.5 h-3.5 accent-primary" />
                  <span className="font-mono truncate">{f}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Filters">
            <div className="space-y-2">
              {filters.map((f, i) => (
                <div key={i} className="flex items-center gap-1">
                  <select value={f.field} onChange={(e) => updateFilter(i, { field: e.target.value })} className="flex-1 h-8 px-2 rounded-md border border-border bg-background text-[11px]">
                    {available.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                  <select value={f.op} onChange={(e) => updateFilter(i, { op: e.target.value })} className="h-8 px-2 rounded-md border border-border bg-background text-[11px]">
                    {FILTER_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <Input value={f.value} onChange={(e) => updateFilter(i, { value: e.target.value })} className="h-8 text-[11px] flex-1" placeholder="value" />
                  <button type="button" onClick={() => removeFilter(i)} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                </div>
              ))}
              <button type="button" onClick={addFilter} className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80"><Plus className="w-3 h-3" /> Add filter</button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Group by">
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">— None —</option>
                {available.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Sort by">
              <div className="flex gap-1">
                <select value={sortField} onChange={(e) => setSortField(e.target.value)} className="flex h-9 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">— None —</option>
                  {available.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <button type="button" onClick={() => setSortDesc((d) => !d)} className="h-9 px-2 rounded-lg border border-border bg-background text-[11px]">{sortDesc ? "↓" : "↑"}</button>
              </div>
            </Field>
          </div>
          <Section title="Chart">
            <Field label="Type">
              <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 w-full">
                {(["none", "bar", "line", "pie", "area"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setChartType(t)} className={cn("flex-1 h-8 text-[11px] font-medium rounded-md capitalize", chartType === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>{t}</button>
                ))}
              </div>
            </Field>
            {chartType !== "none" && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="X axis">
                  <select value={chartX} onChange={(e) => setChartX(e.target.value)} className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">—</option>
                    {[...columns, groupBy].filter(Boolean).map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Y axis">
                  <select value={chartY} onChange={(e) => setChartY(e.target.value)} className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">—</option>
                    {columns.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </Section>
        </div>

        {/* Right — preview */}
        <div className="col-span-3 p-6 bg-muted/20 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold">Preview</h3>
            {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>
          {preview.length === 0 ? (
            <div className="text-[12px] text-muted-foreground italic py-12 text-center">Configure above to preview. No rows yet.</div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50">
                  <tr>
                    {previewCols.map((c) => <th key={c} className="text-left px-3 py-2 font-mono text-muted-foreground">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r: any, i) => (
                    <tr key={i} className="border-t border-border/50">
                      {previewCols.map((c) => <td key={c} className="px-3 py-2 font-mono truncate max-w-[180px]">{formatPreview(r[c])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ScrollableModal>
  );
}

function formatPreview(v: any): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
}

function coerceValue(v: string): any {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  const n = Number(v);
  if (!isNaN(n) && v.trim() !== "") return n;
  return v;
}

function humanize(field: string): string {
  return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Field({ label, required, helper, children }: { label: string; required?: boolean; helper?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {helper && <p className="text-[10px] text-muted-foreground/70">{helper}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
