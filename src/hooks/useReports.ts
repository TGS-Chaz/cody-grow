import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { runReport, ReportQueryConfig, ReportResult, exportCSV, downloadFile } from "@/lib/reports/runReport";
import { PREBUILT_REPORTS, PrebuiltReport, getReportByKey } from "@/lib/reports/prebuilt";

export interface SavedReport {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  report_type: string;
  report_category: string | null;
  query_config: any;
  columns_config: any;
  filters_config: any;
  chart_config: any;
  is_system: boolean | null;
  is_favorite: boolean | null;
  created_by: string | null;
  created_at: string | null;
  /** Derived — merged from prebuilt when missing in DB */
  prebuilt_key?: string | null;
}

export function useSavedReports(options: { category?: string; is_system?: boolean; is_favorite?: boolean } = {}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const sig = `${options.category ?? ""}:${options.is_system ?? ""}:${options.is_favorite ?? ""}`;

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("grow_saved_reports").select("*").eq("org_id", orgId);
      if (options.category) q = q.eq("report_category", options.category);
      if (options.is_system != null) q = q.eq("is_system", options.is_system);
      if (options.is_favorite) q = q.eq("is_favorite", true);
      const { data: rows } = await q.order("name");
      const dbReports = ((rows ?? []) as any[]) as SavedReport[];

      // Merge with prebuilts the DB doesn't have yet
      let merged: SavedReport[] = [...dbReports];
      if (!options.is_favorite && (options.is_system == null || options.is_system === true)) {
        const existingKeys = new Set(dbReports.map((r) => (r.query_config as any)?.prebuilt_key).filter(Boolean));
        for (const p of PREBUILT_REPORTS) {
          if (options.category && p.category !== options.category) continue;
          if (existingKeys.has(p.key)) continue;
          merged.push(prebuiltToReport(p, orgId));
        }
      }
      merged = merged.sort((a, b) => a.name.localeCompare(b.name));
      if (cancelled) return;
      setData(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, tick, sig]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useSavedReport(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<SavedReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Check if it's a prebuilt virtual ID (starts with "prebuilt:")
      if (id.startsWith("prebuilt:")) {
        const key = id.slice("prebuilt:".length);
        const p = getReportByKey(key);
        if (p) {
          if (!cancelled) { setData(prebuiltToReport(p, orgId)); setLoading(false); }
          return;
        }
      }
      const { data: row } = await supabase.from("grow_saved_reports").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
      if (cancelled) return;
      setData(row as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id]);

  return { data, loading };
}

function prebuiltToReport(p: PrebuiltReport, orgId: string): SavedReport {
  return {
    id: `prebuilt:${p.key}`,
    org_id: orgId,
    name: p.name,
    description: p.description,
    report_type: p.key,
    report_category: p.category,
    query_config: { ...p.query_config, prebuilt_key: p.key },
    columns_config: p.columns_config,
    filters_config: p.filters_config ?? null,
    chart_config: p.chart_config ?? null,
    is_system: true,
    is_favorite: false,
    created_by: null,
    created_at: null,
    prebuilt_key: p.key,
  };
}

export function useCreateReport() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: {
    name: string; description?: string | null; report_category: string;
    query_config: ReportQueryConfig; columns_config: any[]; filters_config?: any[]; chart_config?: any;
  }) => {
    if (!orgId) throw new Error("No active org");
    const { data, error } = await supabase.from("grow_saved_reports").insert({
      org_id: orgId,
      name: input.name,
      description: input.description ?? null,
      report_type: "custom",
      report_category: input.report_category,
      query_config: input.query_config,
      columns_config: input.columns_config,
      filters_config: input.filters_config ?? null,
      chart_config: input.chart_config ?? null,
      is_system: false,
      created_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    return data;
  }, [orgId, user?.id]);
}

export function useUpdateReport() {
  return useCallback(async (id: string, patch: Partial<SavedReport>) => {
    const { error } = await supabase.from("grow_saved_reports").update(patch as any).eq("id", id);
    if (error) throw error;
  }, []);
}

export function useDeleteReport() {
  return useCallback(async (id: string) => {
    const { error } = await supabase.from("grow_saved_reports").delete().eq("id", id);
    if (error) throw error;
  }, []);
}

export function useToggleFavorite() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (report: SavedReport) => {
    if (!orgId) throw new Error("No active org");
    // If the report is prebuilt-only (no DB row), materialize it first
    if (report.id.startsWith("prebuilt:")) {
      const { data } = await supabase.from("grow_saved_reports").insert({
        org_id: orgId,
        name: report.name,
        description: report.description,
        report_type: report.report_type,
        report_category: report.report_category,
        query_config: report.query_config,
        columns_config: report.columns_config,
        filters_config: report.filters_config,
        chart_config: report.chart_config,
        is_system: true,
        is_favorite: true,
        created_by: user?.id ?? null,
      }).select("id").single();
      return data;
    }
    const { error } = await supabase.from("grow_saved_reports").update({ is_favorite: !report.is_favorite }).eq("id", report.id);
    if (error) throw error;
  }, [orgId, user?.id]);
}

export function useRunReport() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (report: SavedReport, params: { dateFrom?: string | null; dateTo?: string | null } = {}): Promise<ReportResult> => {
    if (!orgId) throw new Error("No active org");
    const result = await runReport(report.query_config as ReportQueryConfig, {
      orgId, dateFrom: params.dateFrom, dateTo: params.dateTo,
    });
    // Hydrate joined labels for reports that group by id fields
    await hydrateLabels(report, result);
    // Log the run (fire and forget)
    if (!report.id.startsWith("prebuilt:")) {
      supabase.from("grow_report_runs").insert({
        report_id: report.id,
        run_by: user?.id ?? null,
        row_count: result.total,
        duration_ms: 0,
        params: params as any,
      }).then(() => {}, () => {});
    }
    return result;
  }, [orgId, user?.id]);
}

async function hydrateLabels(report: SavedReport, result: ReportResult) {
  const key = (report.query_config as any)?.prebuilt_key;
  if (!key) return;
  const orgId = report.org_id;

  // Hydrate strain_name / area_name / account_name / product_name / employee_name for grouped reports
  if (result.grouped) {
    const strainIds = result.grouped.map((g) => g.strain_id).filter(Boolean);
    const areaIds = result.grouped.map((g) => g.area_id).filter(Boolean);
    const accountIds = result.grouped.map((g) => g.account_id).filter(Boolean);
    const employeeIds = result.grouped.map((g) => g.assigned_to_user_id).filter(Boolean);
    const [sRes, aRes, acctRes, empRes] = await Promise.all([
      strainIds.length > 0 ? supabase.from("grow_strains").select("id, name").in("id", strainIds) : Promise.resolve({ data: [] }),
      areaIds.length > 0 ? supabase.from("grow_areas").select("id, name").in("id", areaIds) : Promise.resolve({ data: [] }),
      accountIds.length > 0 ? supabase.from("grow_accounts").select("id, company_name").in("id", accountIds) : Promise.resolve({ data: [] }),
      employeeIds.length > 0 ? supabase.from("organization_members").select("id, full_name, email").in("id", employeeIds) : Promise.resolve({ data: [] }),
    ]);
    const sById = new Map((sRes.data ?? []).map((r: any) => [r.id, r.name]));
    const aById = new Map((aRes.data ?? []).map((r: any) => [r.id, r.name]));
    const acctById = new Map((acctRes.data ?? []).map((r: any) => [r.id, r.company_name]));
    const empById = new Map((empRes.data ?? []).map((r: any) => [r.id, r.full_name ?? r.email]));
    for (const g of result.grouped) {
      if (g.strain_id) g.strain_name = sById.get(g.strain_id) ?? "—";
      if (g.area_id) g.area_name = aById.get(g.area_id) ?? "—";
      if (g.account_id) g.account_name = acctById.get(g.account_id) ?? "—";
      if (g.assigned_to_user_id) g.employee_name = empById.get(g.assigned_to_user_id) ?? "—";
    }
  }

  // Row-level joins for rows (non-grouped reports)
  if (key === "inventory_aging") {
    const productIds = Array.from(new Set(result.rows.map((r: any) => r.product_id).filter(Boolean)));
    const { data: products } = productIds.length > 0 ? await supabase.from("grow_products").select("id, name").in("id", productIds) : { data: [] };
    const pById = new Map((products ?? []).map((p: any) => [p.id, p.name]));
    const now = Date.now();
    for (const r of result.rows) {
      r.product_name = r.product_id ? pById.get(r.product_id) ?? "—" : "—";
      const age = r.created_at ? Math.floor((now - new Date(r.created_at).getTime()) / 86400000) : 0;
      r.age_days = age;
      r.aging_band = age <= 30 ? "0-30 days" : age <= 60 ? "30-60 days" : age <= 90 ? "60-90 days" : "90+ days";
    }
  }
  if (key === "upcoming_harvests") {
    const strainIds = Array.from(new Set(result.rows.map((r: any) => r.strain_id).filter(Boolean)));
    const areaIds = Array.from(new Set(result.rows.map((r: any) => r.area_id).filter(Boolean)));
    const [sRes, aRes] = await Promise.all([
      strainIds.length > 0 ? supabase.from("grow_strains").select("id, name").in("id", strainIds) : Promise.resolve({ data: [] }),
      areaIds.length > 0 ? supabase.from("grow_areas").select("id, name").in("id", areaIds) : Promise.resolve({ data: [] }),
    ]);
    const sById = new Map((sRes.data ?? []).map((r: any) => [r.id, r.name]));
    const aById = new Map((aRes.data ?? []).map((r: any) => [r.id, r.name]));
    for (const r of result.rows) {
      r.strain_name = r.strain_id ? sById.get(r.strain_id) ?? "—" : "—";
      r.area_name = r.area_id ? aById.get(r.area_id) ?? "—" : "—";
    }
  }
  if (key === "tasks_overdue") {
    const userIds = Array.from(new Set(result.rows.map((r: any) => r.assigned_to_user_id).filter(Boolean)));
    const { data: users } = userIds.length > 0 ? await supabase.from("organization_members").select("id, full_name, email").in("id", userIds) : { data: [] };
    const uById = new Map((users ?? []).map((u: any) => [u.id, u.full_name ?? u.email]));
    const now = Date.now();
    for (const r of result.rows) {
      r.assignee_name = r.assigned_to_user_id ? uById.get(r.assigned_to_user_id) ?? "—" : "Unassigned";
      r.days_overdue = r.scheduled_end ? Math.floor((now - new Date(r.scheduled_end).getTime()) / 86400000) : 0;
    }
  }
  if (key === "ar_aging") {
    const accountIds = Array.from(new Set(result.rows.map((r: any) => r.account_id).filter(Boolean)));
    const { data: accounts } = accountIds.length > 0 ? await supabase.from("grow_accounts").select("id, company_name").in("id", accountIds) : { data: [] };
    const aById = new Map((accounts ?? []).map((a: any) => [a.id, a.company_name]));
    const now = Date.now();
    for (const r of result.rows) {
      r.account_name = r.account_id ? aById.get(r.account_id) ?? "—" : "—";
      const days = r.due_date ? Math.floor((now - new Date(r.due_date).getTime()) / 86400000) : 0;
      r.days_outstanding = days;
      r.aging_band = days <= 30 ? "Current" : days <= 60 ? "30-60" : days <= 90 ? "60-90" : "90+";
    }
  }
  if (key === "environmental_anomalies") {
    const areaIds = Array.from(new Set(result.rows.map((r: any) => r.area_id).filter(Boolean)));
    const { data: areas } = areaIds.length > 0 ? await supabase.from("grow_areas").select("id, name").in("id", areaIds) : { data: [] };
    const aById = new Map((areas ?? []).map((a: any) => [a.id, a.name]));
    for (const r of result.rows) {
      r.area_name = r.area_id ? aById.get(r.area_id) ?? "—" : "—";
    }
  }
  void orgId;
}

export function useScheduledReports() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_scheduled_reports").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
      if (cancelled) return;
      setData((rows ?? []) as any[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useCreateSchedule() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: { name: string; report_id: string; schedule_cron: string; format?: string; recipient_emails?: string[]; is_active?: boolean }) => {
    if (!orgId) throw new Error("No active org");
    const { data, error } = await supabase.from("grow_scheduled_reports").insert({
      org_id: orgId,
      ...input,
      is_active: input.is_active ?? true,
      format: input.format ?? "csv",
      created_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    return data;
  }, [orgId, user?.id]);
}

export function useUpdateSchedule() {
  return useCallback(async (id: string, patch: any) => {
    const { error } = await supabase.from("grow_scheduled_reports").update(patch).eq("id", id);
    if (error) throw error;
  }, []);
}

export function useDeleteSchedule() {
  return useCallback(async (id: string) => {
    const { error } = await supabase.from("grow_scheduled_reports").delete().eq("id", id);
    if (error) throw error;
  }, []);
}

export function useExportReport() {
  return useCallback((result: ReportResult, columns: Array<{ field: string; label: string }>, filename: string, format: "csv" | "json" = "csv") => {
    const rows = result.grouped ?? result.rows;
    if (format === "csv") {
      const cols = columns.map((c) => c.field);
      const labelRow = columns.map((c) => c.label);
      const esc = (v: any) => { if (v == null) return ""; const s = String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const header = labelRow.join(",");
      const body = rows.map((r: any) => cols.map((c) => esc(r[c])).join(","));
      downloadFile([header, ...body].join("\n"), `${filename}.csv`, "text/csv");
    } else if (format === "json") {
      downloadFile(JSON.stringify(rows, null, 2), `${filename}.json`, "application/json");
    }
    void exportCSV;
  }, []);
}

export function useReportStats(reports: SavedReport[]) {
  return useMemo(() => {
    const byCat: Record<string, number> = {};
    let favorites = 0;
    for (const r of reports) {
      const c = r.report_category ?? "other";
      byCat[c] = (byCat[c] ?? 0) + 1;
      if (r.is_favorite) favorites++;
    }
    return { total: reports.length, favorites, byCategory: byCat };
  }, [reports]);
}
