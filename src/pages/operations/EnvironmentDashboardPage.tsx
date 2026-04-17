import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Thermometer, Droplets, Wind, CheckCircle2, AlertTriangle, Loader2, CloudLightning,
  Zap, Gauge,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  LineChart, Line, ResponsiveContainer, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import { useCodyContext } from "@/hooks/useCodyContext";
import { supabase } from "@/lib/supabase";
import { subscribeToChanges } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";

type MetricView = "temperature" | "humidity" | "vpd" | "co2";

interface AreaEnv {
  id: string;
  name: string;
  canopy_type: string | null;
  current: {
    temperature_f: number | null;
    humidity_pct: number | null;
    vpd: number | null;
    co2_ppm: number | null;
    recorded_at: string | null;
  };
  sparkline: Array<{ t: string; temperature: number | null; humidity: number | null; vpd: number | null; co2: number | null }>;
  active_alerts: number;
  sensor_count: number;
}

// Optimal ranges — from common cannabis environmental guidelines
const OPTIMAL = {
  temperature: { min: 68, max: 82 },      // °F
  humidity: { min: 40, max: 65 },         // %
  vpd: { min: 0.8, max: 1.5 },            // kPa
  co2: { min: 800, max: 1500 },           // ppm
};

function statusOf(metric: MetricView, v: number | null | undefined): "ok" | "warn" | "none" {
  if (v == null) return "none";
  const r = OPTIMAL[metric];
  if (v >= r.min && v <= r.max) return "ok";
  return "warn";
}

export default function EnvironmentDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [areas, setAreas] = useState<AreaEnv[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<MetricView>("temperature");
  const [tick, setTick] = useState(0);

  // Realtime: readings + alerts both invalidate the dashboard (best-effort).
  // Multiple listeners share a single channel — all .on() calls happen before
  // .subscribe() inside the helper, and failures don't crash the page.
  useEffect(() => {
    if (!orgId) return;
    const sub = subscribeToChanges(`environment:${orgId}`, [
      { table: "grow_environmental_alerts", filter: `org_id=eq.${orgId}`, callback: () => setTick((t) => t + 1) },
      { event: "INSERT", table: "grow_environmental_readings", callback: () => setTick((t) => t + 1) },
    ]);
    return () => sub.unsubscribe();
  }, [orgId]);

  useEffect(() => {
    if (!user || !orgId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [areasRes, alertsRes] = await Promise.all([
        supabase.from("grow_areas").select("id, name, canopy_type").eq("org_id", orgId).eq("is_active", true).order("name"),
        supabase.from("grow_environmental_alerts").select("*").eq("org_id", orgId).is("resolved_at", null).order("created_at", { ascending: false }),
      ]);
      const areaIds = ((areasRes.data ?? []) as any[]).map((a) => a.id);
      const [readingsRes, sensorsRes] = await Promise.all([
        areaIds.length > 0 ? supabase.from("grow_environmental_readings").select("*").in("area_id", areaIds).gte("recorded_at", new Date(Date.now() - 6 * 3600000).toISOString()).order("recorded_at", { ascending: true }) : Promise.resolve({ data: [] }),
        areaIds.length > 0 ? supabase.from("grow_hardware_devices").select("id, area_id, device_status").in("area_id", areaIds) : Promise.resolve({ data: [] }),
      ]);

      const readingsByArea = new Map<string, any[]>();
      ((readingsRes.data ?? []) as any[]).forEach((r) => {
        const arr = readingsByArea.get(r.area_id) ?? [];
        arr.push(r);
        readingsByArea.set(r.area_id, arr);
      });
      const sensorCountByArea = new Map<string, number>();
      ((sensorsRes.data ?? []) as any[]).forEach((s) => {
        sensorCountByArea.set(s.area_id, (sensorCountByArea.get(s.area_id) ?? 0) + 1);
      });
      const alertsByArea = new Map<string, number>();
      ((alertsRes.data ?? []) as any[]).forEach((a) => {
        alertsByArea.set(a.area_id, (alertsByArea.get(a.area_id) ?? 0) + 1);
      });

      const enriched: AreaEnv[] = ((areasRes.data ?? []) as any[]).map((a) => {
        const readings = readingsByArea.get(a.id) ?? [];
        const latest = readings[readings.length - 1] ?? null;
        return {
          id: a.id,
          name: a.name,
          canopy_type: a.canopy_type,
          current: {
            temperature_f: latest?.temperature_f ?? null,
            humidity_pct: latest?.humidity_pct ?? null,
            vpd: latest?.vpd ?? null,
            co2_ppm: latest?.co2_ppm ?? null,
            recorded_at: latest?.recorded_at ?? null,
          },
          sparkline: readings.slice(-24).map((r) => ({
            t: r.recorded_at, temperature: r.temperature_f, humidity: r.humidity_pct, vpd: r.vpd, co2: r.co2_ppm,
          })),
          active_alerts: alertsByArea.get(a.id) ?? 0,
          sensor_count: sensorCountByArea.get(a.id) ?? 0,
        };
      });

      // Enrich alerts with area names
      const areaById = new Map<string, string>(enriched.map((a) => [a.id, a.name]));
      const enrichedAlerts = ((alertsRes.data ?? []) as any[]).map((a) => ({ ...a, area_name: areaById.get(a.area_id) ?? "—" }));

      if (cancelled) return;
      setAreas(enriched);
      setAlerts(enrichedAlerts);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const { setContext, clearContext } = useCodyContext();
  useEffect(() => {
    setContext({
      context_type: "environment_dashboard",
      page_data: {
        area_count: areas.length,
        active_alerts: alerts.length,
        areas_with_alerts: areas.filter((a) => a.active_alerts > 0).length,
      },
    });
    return () => clearContext();
  }, [setContext, clearContext, areas, alerts]);

  const resolveAlert = async (id: string) => {
    try {
      await supabase.from("grow_environmental_alerts").update({ resolved_at: new Date().toISOString() }).eq("id", id);
      setAlerts((xs) => xs.filter((a) => a.id !== id));
      toast.success("Alert resolved");
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  };

  const alertColumns: ColumnDef<any>[] = useMemo(() => [
    { id: "area", header: "Area", cell: ({ row }) => <button onClick={() => navigate(`/cultivation/areas/${row.original.area_id}?tab=environment`)} className="text-[12px] text-primary hover:underline">{row.original.area_name}</button> },
    { accessorKey: "alert_type", header: "Type", cell: ({ row }) => <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">{row.original.alert_type ?? "—"}</span> },
    { accessorKey: "severity", header: "Severity", cell: ({ row }) => {
      const s = row.original.severity ?? "info";
      return <StatusPill label={s} variant={s === "critical" ? "critical" : s === "warning" ? "warning" : "info"} />;
    } },
    { id: "value", header: "Value / Threshold", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.actual_value ?? "—"} / {row.original.threshold_value ?? "—"}</span> },
    { accessorKey: "created_at", header: "Duration", cell: ({ row }) => {
      if (!row.original.created_at) return "—";
      const hrs = Math.floor((Date.now() - new Date(row.original.created_at).getTime()) / 3600000);
      return <span className="text-[11px]">{hrs}h ago</span>;
    } },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => <Button size="sm" variant="outline" onClick={() => resolveAlert(row.original.id)} className="h-7 px-2 text-[11px] gap-1"><CheckCircle2 className="w-3 h-3" /> Resolve</Button>,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate]);

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title="Environmental Monitoring"
        description="Mission control for facility conditions"
        breadcrumbs={[{ label: "Operations" }, { label: "Environment" }]}
        actions={
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
            {(["temperature", "humidity", "vpd", "co2"] as const).map((m) => (
              <button key={m} onClick={() => setView(m)} className={cn("h-8 px-3 text-[12px] font-medium rounded-md uppercase transition-colors", view === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {m}
              </button>
            ))}
          </div>
        }
      />

      {areas.length === 0 ? (
        <EmptyState icon={Thermometer} title="No active areas" description="Add areas and environmental sensors to see data here." />
      ) : (
        <>
          <h3 className="text-[13px] font-semibold mb-3">Areas ({areas.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {areas.map((a) => <AreaCard key={a.id} area={a} view={view} onClick={() => navigate(`/cultivation/areas/${a.id}?tab=environment`)} />)}
          </div>

          {/* Heatmap */}
          <div className="rounded-xl border border-border bg-card p-5 mb-8">
            <h3 className="text-[13px] font-semibold mb-3">Facility heatmap · {view}</h3>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {areas.map((a) => {
                const val = view === "temperature" ? a.current.temperature_f
                  : view === "humidity" ? a.current.humidity_pct
                  : view === "vpd" ? a.current.vpd
                  : a.current.co2_ppm;
                const status = statusOf(view, val);
                return (
                  <button key={a.id} onClick={() => navigate(`/cultivation/areas/${a.id}?tab=environment`)}
                    className={cn("aspect-square rounded-lg border-2 flex flex-col items-center justify-center gap-1 p-2 hover:scale-105 transition-transform",
                      status === "ok" ? "border-emerald-500/40 bg-emerald-500/10" :
                      status === "warn" ? "border-destructive/40 bg-destructive/10" :
                      "border-border bg-muted/30")}
                    title={a.name}
                  >
                    <div className="text-[9px] font-semibold uppercase tracking-wider truncate w-full text-center">{a.name}</div>
                    <div className="text-[16px] font-bold font-mono tabular-nums">{val != null ? Number(val).toFixed(view === "co2" ? 0 : 1) : "—"}</div>
                    <div className="text-[8px] text-muted-foreground uppercase">{view === "temperature" ? "°F" : view === "humidity" ? "%" : view === "vpd" ? "kPa" : "ppm"}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <h3 className="text-[13px] font-semibold mb-3">Active alerts ({alerts.length})</h3>
      <DataTable
        columns={alertColumns}
        data={alerts}
        empty={{ icon: CheckCircle2, title: "No active alerts", description: "All areas are within optimal ranges." }}
      />
    </div>
  );
}

function AreaCard({ area, view, onClick }: { area: AreaEnv; view: MetricView; onClick: () => void }) {
  const tempStatus = statusOf("temperature", area.current.temperature_f);
  const humStatus = statusOf("humidity", area.current.humidity_pct);
  const vpdStatus = statusOf("vpd", area.current.vpd);
  const co2Status = statusOf("co2", area.current.co2_ppm);

  const sparkKey = view === "temperature" ? "temperature" : view === "humidity" ? "humidity" : view === "vpd" ? "vpd" : "co2";

  return (
    <button onClick={onClick} className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-[13px] font-semibold">{area.name}</h4>
          {area.canopy_type && <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{area.canopy_type}</div>}
        </div>
        {area.active_alerts > 0 && (
          <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold bg-destructive/20 text-destructive">
            <AlertTriangle className="w-2.5 h-2.5" /> {area.active_alerts}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <Metric label="Temp" value={area.current.temperature_f} unit="°F" status={tempStatus} icon={Thermometer} />
        <Metric label="Humidity" value={area.current.humidity_pct} unit="%" status={humStatus} icon={Droplets} />
        <Metric label="VPD" value={area.current.vpd} unit="kPa" status={vpdStatus} icon={Wind} />
        <Metric label="CO2" value={area.current.co2_ppm} unit="ppm" status={co2Status} icon={CloudLightning} />
      </div>

      {/* Sparkline */}
      {area.sparkline.length > 0 ? (
        <div className="h-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={area.sparkline}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line type="monotone" dataKey={sparkKey} stroke="hsl(168 100% 42%)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-10 flex items-center justify-center text-[10px] text-muted-foreground italic">No recent readings</div>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
        <span>{area.sensor_count} sensor{area.sensor_count === 1 ? "" : "s"}</span>
        {area.current.recorded_at && <DateTime value={area.current.recorded_at} />}
      </div>
    </button>
  );
}

function Metric({ label, value, unit, status, icon: Icon }: { label: string; value: number | null; unit: string; status: "ok" | "warn" | "none"; icon: any }) {
  const color = status === "ok" ? "text-emerald-500" : status === "warn" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="rounded-md bg-muted/20 p-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-2.5 h-2.5" /> {label}
      </div>
      <div className={cn("font-mono text-[14px] font-bold", color)}>
        {value != null ? Number(value).toFixed(unit === "ppm" ? 0 : 1) : "—"}
        <span className="text-[9px] text-muted-foreground ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

void Zap; void Gauge;
