import { useMemo, useState } from "react";
import { Upload, ArrowRight, Check, X, AlertTriangle, Loader2, Download, FileText } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseCCRS, CCRS_FIELD_MAP } from "@/lib/import/parseCCRS";
import { cn } from "@/lib/utils";

export interface ImporterColumn {
  field: string;
  label: string;
  required?: boolean;
  hint?: string;
}

export type DryRunStatus = "create" | "update" | "skip" | "error";

export interface DryRunResult {
  status: DryRunStatus;
  /** When status="update", the fields that differ from the existing record */
  diffs?: Record<string, { old: any; new: any }>;
  /** Human-readable reason (e.g. why this row would be skipped / error) */
  reason?: string;
}

export interface ImporterProps {
  entityKey: keyof typeof CCRS_FIELD_MAP | string;
  columns: ImporterColumn[];
  /** Function to import a single mapped row. Should return { success, error? }. */
  onImport: (row: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
  /**
   * Optional dry-run classifier. If provided, the preview step calls this
   * for each row to decide CREATE / UPDATE / SKIP / ERROR. SKIP rows are
   * not imported; CREATE + UPDATE rows are.
   */
  dryRun?: (row: Record<string, any>) => Promise<DryRunResult> | DryRunResult;
  onDone?: (stats: { imported: number; failed: number }) => void;
}

type Step = "upload" | "map" | "preview" | "import" | "done";

export default function CSVImporter({ entityKey, columns, onImport, dryRun, onDone }: ImporterProps) {
  const [step, setStep] = useState<Step>("upload");
  const [rawColumns, setRawColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [isCCRS, setIsCCRS] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [failures, setFailures] = useState<Array<{ row: Record<string, any>; error: string }>>([]);
  const [dryRunResults, setDryRunResults] = useState<DryRunResult[]>([]);
  const [dryRunning, setDryRunning] = useState(false);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const detection = parseCCRS(text);
    setIsCCRS(detection.isCCRS);
    setRawColumns(detection.columns);
    setRawRows(detection.rows);

    // Auto-detect column mapping
    const map: Record<string, string> = {};
    if (detection.isCCRS && CCRS_FIELD_MAP[entityKey]) {
      const ccrsMap = CCRS_FIELD_MAP[entityKey];
      for (const col of detection.columns) {
        if (ccrsMap[col]) map[ccrsMap[col]] = col;
      }
    } else {
      // Plain CSV — try to auto-match by normalized column name
      for (const def of columns) {
        const match = detection.columns.find((c) => c.toLowerCase().replace(/[_\s-]/g, "") === def.field.toLowerCase().replace(/[_\s-]/g, ""));
        if (match) map[def.field] = match;
      }
    }
    setColumnMap(map);
    setStep("map");
  };

  const mappedRows = useMemo(() => {
    return rawRows.map((r) => {
      const out: Record<string, any> = {};
      for (const def of columns) {
        const src = columnMap[def.field];
        if (src) out[def.field] = r[src] ?? null;
      }
      return out;
    });
  }, [rawRows, columnMap, columns]);

  const validation = useMemo(() => {
    const errors: Array<{ rowIdx: number; missing: string[] }> = [];
    mappedRows.forEach((row, idx) => {
      const missing = columns.filter((c) => c.required && !row[c.field]).map((c) => c.field);
      if (missing.length > 0) errors.push({ rowIdx: idx, missing });
    });
    return { errors, valid: errors.length === 0 };
  }, [mappedRows, columns]);

  const validRowCount = mappedRows.length - validation.errors.length;

  const runImport = async () => {
    setStep("import");
    setProgress({ done: 0, failed: 0, total: mappedRows.length });
    const newFailures: Array<{ row: Record<string, any>; error: string }> = [];
    let done = 0, failed = 0;
    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i];
      // Skip rows with missing required fields
      const missing = columns.filter((c) => c.required && !row[c.field]);
      if (missing.length > 0) {
        failed++;
        newFailures.push({ row, error: `Missing: ${missing.map((c) => c.field).join(", ")}` });
        setProgress({ done, failed, total: mappedRows.length });
        continue;
      }
      // Honor dry-run classification: skip SKIP rows entirely
      if (dryRunResults[i] && dryRunResults[i].status === "skip") {
        setProgress({ done, failed, total: mappedRows.length });
        continue;
      }
      if (dryRunResults[i] && dryRunResults[i].status === "error") {
        failed++;
        newFailures.push({ row, error: dryRunResults[i].reason ?? "Flagged by dry-run" });
        setProgress({ done, failed, total: mappedRows.length });
        continue;
      }
      try {
        const r = await onImport(row);
        if (r.success) done++;
        else { failed++; newFailures.push({ row, error: r.error ?? "Unknown error" }); }
      } catch (err: any) {
        failed++; newFailures.push({ row, error: err?.message ?? "Failed" });
      }
      setProgress({ done, failed, total: mappedRows.length });
    }
    setFailures(newFailures);
    setStep("done");
    onDone?.({ imported: done, failed });
  };

  // Run the classifier in parallel-ish for every mapped row when preview opens.
  const runDryRun = async () => {
    if (!dryRun) return;
    setDryRunning(true);
    try {
      const results: DryRunResult[] = [];
      for (const row of mappedRows) {
        try {
          const r = await Promise.resolve(dryRun(row));
          results.push(r);
        } catch (err: any) {
          results.push({ status: "error", reason: err?.message ?? "Classifier failed" });
        }
      }
      setDryRunResults(results);
    } finally { setDryRunning(false); }
  };

  const downloadFailures = () => {
    if (failures.length === 0) return;
    const csv = Papa.unparse(failures.map((f) => ({ ...f.row, _error: f.error })));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `import_errors_${entityKey}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStep("upload");
    setRawColumns([]); setRawRows([]); setColumnMap({});
    setIsCCRS(false); setProgress({ done: 0, failed: 0, total: 0 }); setFailures([]);
  };

  if (step === "upload") {
    return (
      <label className="block rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer bg-card/50">
        <div className="p-12 text-center">
          <Upload className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
          <p className="text-[14px] font-semibold">Drop CSV or click to upload</p>
          <p className="text-[11px] text-muted-foreground mt-1">CCRS-format CSVs are auto-detected.</p>
        </div>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </label>
    );
  }

  if (step === "map") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold">Map columns</div>
            <div className="text-[11px] text-muted-foreground">{rawRows.length} rows detected{isCCRS && " · CCRS format"}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={reset}>Cancel</Button>
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Target field</th>
                <th className="text-left px-4 py-2 font-semibold">Source column</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => (
                <tr key={c.field} className="border-t border-border/50">
                  <td className="px-4 py-2">
                    <div className="font-mono">{c.field}{c.required && <span className="text-destructive ml-1">*</span>}</div>
                    {c.hint && <div className="text-[10px] text-muted-foreground">{c.hint}</div>}
                  </td>
                  <td className="px-4 py-2">
                    <select value={columnMap[c.field] ?? ""} onChange={(e) => setColumnMap((m) => ({ ...m, [c.field]: e.target.value }))} className="h-9 w-full rounded-md border border-border bg-background px-2 text-[12px]">
                      <option value="">— Skip —</option>
                      {rawColumns.map((rc) => <option key={rc} value={rc}>{rc}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button onClick={async () => { setStep("preview"); if (dryRun) await runDryRun(); }} className="gap-1.5"><ArrowRight className="w-3.5 h-3.5" /> Preview</Button>
      </div>
    );
  }

  if (step === "preview") {
    const preview = mappedRows.slice(0, 10);
    // Summary of all rows (not just preview)
    const counts = { create: 0, update: 0, skip: 0, error: 0 };
    mappedRows.forEach((_, idx) => {
      const hasMissing = validation.errors.find((e) => e.rowIdx === idx);
      if (hasMissing) { counts.error++; return; }
      const dr = dryRunResults[idx];
      if (dr) counts[dr.status]++;
      else counts.create++; // default when no classifier
    });
    const toImport = counts.create + counts.update;

    const badge = (status: DryRunStatus) => {
      const base = "inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wider";
      if (status === "create") return <span className={cn(base, "bg-emerald-500/15 text-emerald-500")}>Create</span>;
      if (status === "update") return <span className={cn(base, "bg-amber-500/15 text-amber-500")}>Update</span>;
      if (status === "skip")   return <span className={cn(base, "bg-muted text-muted-foreground")}>Skip</span>;
      return <span className={cn(base, "bg-destructive/15 text-destructive")}>Error</span>;
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold">Preview first 10 rows</div>
            <div className="text-[11px] text-muted-foreground">
              {dryRunning
                ? "Classifying rows…"
                : `${mappedRows.length} row${mappedRows.length === 1 ? "" : "s"} — ${toImport} will be imported`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep("map")}>Back</Button>
            <Button size="sm" onClick={runImport} disabled={toImport === 0 || dryRunning} className="gap-1.5">
              Import {toImport} Row{toImport === 1 ? "" : "s"}
            </Button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-2 text-[11px]">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
            <div className="text-emerald-500 font-semibold uppercase tracking-wider text-[9px]">Create</div>
            <div className="font-mono text-[16px] font-bold">{counts.create}</div>
          </div>
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
            <div className="text-amber-500 font-semibold uppercase tracking-wider text-[9px]">Update</div>
            <div className="font-mono text-[16px] font-bold">{counts.update}</div>
          </div>
          <div className="rounded-lg bg-muted/50 border border-border px-3 py-2">
            <div className="text-muted-foreground font-semibold uppercase tracking-wider text-[9px]">Skip</div>
            <div className="font-mono text-[16px] font-bold">{counts.skip}</div>
          </div>
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
            <div className="text-destructive font-semibold uppercase tracking-wider text-[9px]">Error</div>
            <div className="font-mono text-[16px] font-bold">{counts.error}</div>
          </div>
        </div>

        {validation.errors.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2 text-[12px]">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
            <span>{validation.errors.length} row{validation.errors.length === 1 ? "" : "s"} will be skipped — missing required fields.</span>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] min-w-[640px]">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 w-24">Status</th>
                  {columns.map((c) => <th key={c.field} className="text-left px-3 py-2 font-mono">{c.field}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => {
                  const hasError = validation.errors.find((e) => e.rowIdx === idx);
                  const dr = hasError
                    ? { status: "error" as DryRunStatus, reason: `Missing: ${hasError.missing.join(", ")}` }
                    : dryRunResults[idx] ?? { status: "create" as DryRunStatus };
                  return (
                    <tr key={idx} className={cn(
                      "border-t border-border/50 align-top",
                      dr.status === "error" && "bg-destructive/5",
                      dr.status === "update" && "bg-amber-500/5",
                      dr.status === "skip" && "opacity-60",
                    )}>
                      <td className="px-3 py-2">
                        {badge(dr.status)}
                        {dr.reason && <div className="text-[10px] text-muted-foreground mt-1 max-w-[120px]">{dr.reason}</div>}
                      </td>
                      {columns.map((c) => {
                        const val = row[c.field];
                        const diff = dr.diffs?.[c.field];
                        return (
                          <td key={c.field} className="px-3 py-2 font-mono truncate max-w-[180px]">
                            {diff ? (
                              <div>
                                <div className="text-rose-500 line-through text-[10px] truncate">{String(diff.old ?? "—")}</div>
                                <div className="text-emerald-500 truncate">{String(diff.new ?? "—")}</div>
                              </div>
                            ) : val ? val : (
                              <span className={cn("text-muted-foreground", c.required && "text-destructive")}>—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (step === "import") {
    const pct = progress.total > 0 ? Math.round(((progress.done + progress.failed) / progress.total) * 100) : 0;
    return (
      <div className="space-y-4">
        <div className="text-center py-6">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-3" />
          <div className="text-[14px] font-semibold">Importing…</div>
          <div className="text-[11px] text-muted-foreground mt-1">{progress.done + progress.failed} / {progress.total}</div>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="space-y-4">
      <div className="text-center py-6">
        <Check className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
        <div className="text-[16px] font-bold">Import complete</div>
        <div className="text-[12px] text-muted-foreground mt-1">{progress.done} imported · {progress.failed} failed</div>
      </div>
      {failures.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="text-[12px]">
            <div className="font-semibold">{failures.length} row{failures.length === 1 ? "" : "s"} failed</div>
            <div className="text-muted-foreground text-[11px] mt-0.5">Download the errors CSV to review + re-import.</div>
          </div>
          <Button size="sm" variant="outline" onClick={downloadFailures} className="gap-1.5"><Download className="w-3.5 h-3.5" /> Errors CSV</Button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={reset} className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Import another</Button>
        <Button onClick={() => { toast.success("Data imported successfully"); reset(); }}>Done</Button>
      </div>
    </div>
  );
}
