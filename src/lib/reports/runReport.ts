/**
 * Generic report query engine.
 *
 * Takes a query_config JSONB and executes it against Supabase. Covers all 15
 * prebuilt reports + custom reports built from the ReportBuilderModal.
 *
 * The config is intentionally simple (no joins, no subqueries). When a report
 * needs joined data, the hook does the join client-side after fetching.
 */

import { supabase } from "@/lib/supabase";

export interface ReportFilter {
  field: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "ilike" | "is" | "not";
  value: any;
}

export interface ReportQueryConfig {
  /** Supabase table name */
  data_source: string;
  /** Columns to select. "*" for all. */
  columns?: string[];
  filters?: ReportFilter[];
  /** Sort by {field, asc} */
  order_by?: { field: string; ascending?: boolean }[];
  limit?: number;
  /** Date range filter: applies `gte`/`lte` to this field when a range is passed */
  date_field?: string;
  /** If set, client-side groups rows by this field and aggregates */
  group_by?: string;
  /** Aggregations to compute per group: { field, kind }. Kind: count | sum | avg | max | min */
  aggregates?: Array<{ field: string; kind: "count" | "sum" | "avg" | "max" | "min"; alias?: string }>;
}

export interface ReportRunParams {
  orgId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  /** Extra filters merged in (from runtime filters bar) */
  extraFilters?: ReportFilter[];
}

export interface ReportResult {
  rows: any[];
  total: number;
  aggregates?: Record<string, any>;
  grouped?: Array<Record<string, any>>;
}

/** Apply one filter to a Supabase query. */
function applyFilter(q: any, f: ReportFilter): any {
  switch (f.op) {
    case "eq": return q.eq(f.field, f.value);
    case "neq": return q.neq(f.field, f.value);
    case "gt": return q.gt(f.field, f.value);
    case "gte": return q.gte(f.field, f.value);
    case "lt": return q.lt(f.field, f.value);
    case "lte": return q.lte(f.field, f.value);
    case "in": return q.in(f.field, f.value);
    case "ilike": return q.ilike(f.field, `%${f.value}%`);
    case "is": return q.is(f.field, f.value);
    case "not": return q.not(f.field, "is", f.value);
    default: return q;
  }
}

export async function runReport(config: ReportQueryConfig, params: ReportRunParams): Promise<ReportResult> {
  const cols = config.columns?.length ? config.columns.join(", ") : "*";
  let q = supabase.from(config.data_source).select(cols, { count: "exact" }).eq("org_id", params.orgId);

  // Date range on the report's date_field
  if (config.date_field) {
    if (params.dateFrom) q = q.gte(config.date_field, params.dateFrom);
    if (params.dateTo) q = q.lte(config.date_field, params.dateTo);
  }
  for (const f of config.filters ?? []) q = applyFilter(q, f);
  for (const f of params.extraFilters ?? []) q = applyFilter(q, f);

  for (const o of config.order_by ?? []) q = q.order(o.field, { ascending: o.ascending ?? true });
  if (config.limit) q = q.limit(config.limit);

  const { data: rows, count, error } = await q;
  if (error) throw error;

  // Client-side group + aggregate
  let grouped: Array<Record<string, any>> | undefined;
  if (config.group_by) {
    const groups = new Map<string, any[]>();
    for (const r of (rows ?? []) as any[]) {
      const key = String(r[config.group_by] ?? "—");
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    grouped = Array.from(groups.entries()).map(([key, groupRows]) => {
      const out: Record<string, any> = { [config.group_by!]: key, count: groupRows.length };
      for (const agg of config.aggregates ?? []) {
        const alias = agg.alias ?? `${agg.kind}_${agg.field}`;
        const values = groupRows.map((r) => Number(r[agg.field] ?? 0));
        switch (agg.kind) {
          case "count": out[alias] = groupRows.length; break;
          case "sum": out[alias] = values.reduce((s, v) => s + v, 0); break;
          case "avg": out[alias] = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0; break;
          case "max": out[alias] = values.length ? Math.max(...values) : 0; break;
          case "min": out[alias] = values.length ? Math.min(...values) : 0; break;
        }
      }
      return out;
    });
  }

  const aggregates: Record<string, any> = {};
  for (const agg of config.aggregates ?? []) {
    if (config.group_by) continue; // handled above
    const values = (rows ?? []).map((r: any) => Number(r[agg.field] ?? 0));
    const alias = agg.alias ?? `${agg.kind}_${agg.field}`;
    switch (agg.kind) {
      case "count": aggregates[alias] = (rows ?? []).length; break;
      case "sum": aggregates[alias] = values.reduce((s, v) => s + v, 0); break;
      case "avg": aggregates[alias] = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0; break;
      case "max": aggregates[alias] = values.length ? Math.max(...values) : 0; break;
      case "min": aggregates[alias] = values.length ? Math.min(...values) : 0; break;
    }
  }

  return {
    rows: (rows ?? []) as any[],
    total: count ?? (rows?.length ?? 0),
    aggregates: Object.keys(aggregates).length ? aggregates : undefined,
    grouped,
  };
}

/** Export helpers */

export function exportCSV(rows: any[], columns: string[]): string {
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c])).join(","));
  return [header, ...body].join("\n");
}

export function downloadFile(content: string | Blob, filename: string, mime: string = "text/csv") {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
