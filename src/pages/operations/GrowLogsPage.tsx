import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, Loader2, MapPin, Leaf, Flower2, Beaker, Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import FiltersBar from "@/components/shared/FiltersBar";
import PaginationControls from "@/components/shared/PaginationControls";
import EmptyState from "@/components/shared/EmptyState";
import DateTime from "@/components/shared/DateTime";
import { useCodyContext } from "@/hooks/useCodyContext";
import { useGrowLogs, useGrowLogStats, useCreateGrowLog, GrowLog, GrowLogFilters } from "@/hooks/useGrowLogs";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";

const LOG_TYPES = [
  { value: "general", label: "General", color: "bg-muted text-muted-foreground" },
  { value: "observation", label: "Observation", color: "bg-blue-500/15 text-blue-500" },
  { value: "feeding", label: "Feeding", color: "bg-emerald-500/15 text-emerald-500" },
  { value: "ipm", label: "IPM", color: "bg-amber-500/15 text-amber-500" },
  { value: "measurement", label: "Measurement", color: "bg-purple-500/15 text-purple-500" },
  { value: "issue", label: "Issue", color: "bg-red-500/15 text-red-500" },
];

const TYPE_COLOR = Object.fromEntries(LOG_TYPES.map((t) => [t.value, t.color]));

export default function GrowLogsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<GrowLogFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const filterSig = useMemo(() => `${filters.log_type ?? ""}:${filters.area_id ?? ""}:${filters.cycle_id ?? ""}`, [filters]);
  useEffect(() => { setPage(1); }, [filterSig]);
  const paginatedFilters = useMemo<GrowLogFilters>(() => ({ ...filters, page, pageSize }), [filters, page, pageSize]);
  const { data: logs, loading, refresh, totalCount } = useGrowLogs(paginatedFilters, 200);
  const stats = useGrowLogStats(logs);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { setContext, clearContext } = useCodyContext();
  useEffect(() => {
    setContext({ context_type: "grow_logs", page_data: { stats } });
    return () => clearContext();
  }, [setContext, clearContext, stats]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => `${l.title ?? ""} ${l.content} ${l.area?.name ?? ""} ${l.cycle?.name ?? ""}`.toLowerCase().includes(q));
  }, [logs, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, GrowLog[]>();
    for (const log of filtered) {
      const key = log.recorded_at ? new Date(log.recorded_at).toDateString() : "unknown";
      const arr = map.get(key) ?? [];
      arr.push(log);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Grow Logs"
        description="The daily journal across every area and cycle"
        breadcrumbs={[{ label: "Operations" }, { label: "Grow Logs" }]}
        actions={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> New Log Entry</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Entries" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Today" value={stats.today} accentClass="stat-accent-emerald" delay={0.05} />
        <StatCard label="This Week" value={stats.thisWeek} accentClass="stat-accent-teal" delay={0.1} />
      </div>

      <FiltersBar
        searchValue={search} onSearchChange={setSearch}
        searchPlaceholder="Search entries…"
        pageKey="grow_logs"
        currentFilters={{ ...filters, search }}
        onApplyView={(f) => {
          setFilters({ log_type: f.log_type, area_id: f.area_id, cycle_id: f.cycle_id });
          setSearch(f.search ?? "");
        }}
        actions={
          <select value={filters.log_type ?? ""} onChange={(e) => setFilters((f) => ({ ...f, log_type: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
            <option value="">All types</option>
            {LOG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : grouped.length === 0 ? (
        <EmptyState icon={BookOpen} title="No log entries" description="Capture observations, feedings, IPM events, and measurements across your grow." action={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> New Entry</Button>} />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, entries]) => (
            <div key={date}>
              <div className="sticky top-0 bg-background py-2 z-10 border-b border-border mb-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {date === new Date().toDateString() ? "Today" : new Date(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </h3>
              </div>
              <div className="space-y-2">
                {entries.map((log) => (
                  <article key={log.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wider ${TYPE_COLOR[log.log_type ?? "general"] ?? "bg-muted text-muted-foreground"}`}>
                          {log.log_type ?? "general"}
                        </span>
                        {log.title && <h4 className="text-[13px] font-semibold">{log.title}</h4>}
                      </div>
                      {log.recorded_at && <DateTime value={log.recorded_at} className="text-[10px] text-muted-foreground font-mono" />}
                    </div>
                    <p className="text-[12px] whitespace-pre-wrap mb-2">{log.content}</p>
                    <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                      {log.area && <button onClick={() => navigate(`/cultivation/areas/${log.area!.id}`)} className="inline-flex items-center gap-1 text-primary hover:underline"><MapPin className="w-3 h-3" />{log.area.name}</button>}
                      {log.cycle && <button onClick={() => navigate(`/cultivation/cycles/${log.cycle!.id}`)} className="inline-flex items-center gap-1 text-primary hover:underline"><Flower2 className="w-3 h-3" />{log.cycle.name}</button>}
                      {log.plant_id && <button onClick={() => navigate(`/cultivation/plants/${log.plant_id}`)} className="inline-flex items-center gap-1 text-primary hover:underline"><Leaf className="w-3 h-3" />Plant</button>}
                      {log.batch_id && <button onClick={() => navigate(`/inventory/batches/${log.batch_id}`)} className="inline-flex items-center gap-1 text-primary hover:underline"><Beaker className="w-3 h-3" />Batch</button>}
                      <span className="ml-auto">{log.author?.full_name ?? log.author?.email ?? "—"}</span>
                    </div>
                    {log.photo_urls && log.photo_urls.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {log.photo_urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationControls
        page={page} pageSize={pageSize} totalCount={totalCount}
        totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
      />

      <CreateLogModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => refresh()} />
      <span className="hidden"><Camera /></span>
    </div>
  );
}

function CreateLogModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess?: () => void }) {
  const { orgId } = useOrg();
  const createLog = useCreateGrowLog();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [logType, setLogType] = useState("general");
  const [areaId, setAreaId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState<Array<{ id: string; name: string }>>([]);
  const [cycles, setCycles] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    setTitle(""); setContent(""); setLogType("general"); setAreaId(""); setCycleId("");
    (async () => {
      const [aRes, cRes] = await Promise.all([
        supabase.from("grow_areas").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
        supabase.from("grow_cycles").select("id, name").eq("org_id", orgId).not("phase", "eq", "completed").order("name"),
      ]);
      setAreas((aRes.data ?? []) as any);
      setCycles((cRes.data ?? []) as any);
    })();
  }, [open, orgId]);

  const valid = content.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { toast.error("Content required"); return; }
    setSaving(true);
    try {
      await createLog({
        title: title.trim() || null, content: content.trim(),
        log_type: logType,
        area_id: areaId || null, grow_cycle_id: cycleId || null,
      });
      toast.success("Log entry saved");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<BookOpen className="w-4 h-4 text-primary" />} title="New log entry" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
            Save
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Type</label>
          <select value={logType} onChange={(e) => setLogType(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {LOG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional short title" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Content <span className="text-destructive">*</span></label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Area</label>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— None —</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Cycle</label>
            <select value={cycleId} onChange={(e) => setCycleId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— None —</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>
    </ScrollableModal>
  );
}
