import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  MapPin, Edit, Archive, Loader2, Activity, Leaf, ClipboardCheck,
  Ruler, Wifi, WifiOff, ShieldAlert, Star, Thermometer, Droplets, Wind, Gauge,
  ArrowUp, ArrowDown, ArrowRight, AlertTriangle, CheckCircle2, Info, Scissors,
  CalendarDays, Building2, Package,
} from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import EnvironmentChart, { EnvMetric } from "@/components/shared/EnvironmentChart";
import CodyInsightsPanel from "@/components/cody/CodyInsightsPanel";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useArea, useAreas, useAreaEnvironment, useAreaAlerts,
  useAreaPlants, useAreaCycles, useAreaHarvests, useAreaSensors,
  EnvTimeRange, Area, AreaInput,
} from "@/hooks/useAreas";
import {
  AREA_CANOPY_TYPE_LABELS, AREA_CANOPY_TYPE_COLORS, AreaCanopyType,
  AREA_LIGHT_TYPE_LABELS,
  HARDWARE_CONNECTION_TYPE_LABELS,
} from "@/lib/schema-enums";
import AreaFormModal from "./AreaFormModal";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const FRESH_SENSOR_MS = 15 * 60 * 1000;

export default function AreaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const setActiveTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const { data: area, loading, refresh } = useArea(id);
  const { updateArea, archiveArea, assignSensors } = useAreas();
  const [editOpen, setEditOpen] = useState(false);
  const [editingSensorIds, setEditingSensorIds] = useState<string[]>([]);

  useEffect(() => {
    if (!editOpen || !id) return;
    (async () => {
      const { data } = await supabase
        .from("grow_hardware_devices")
        .select("id")
        .eq("assigned_to_area_id", id);
      setEditingSensorIds((data ?? []).map((s: any) => s.id));
    })();
  }, [editOpen, id]);

  // Cody context
  const { setContext, clearContext } = useCodyContext();
  const sig = area ? `${area.id}:${area.updated_at}:${area.active_plant_count ?? 0}:${area.sensor_online_count ?? 0}` : "";
  const codyPayload = useMemo(() => {
    if (!area) return null;
    return {
      area: {
        name: area.name,
        type: area.canopy_type,
        facility: area.facility?.name,
        canopy_sqft: area.canopy_sqft,
        licensed: area.is_licensed_canopy,
        is_quarantine: area.is_quarantine,
        active_plants: area.active_plant_count,
        active_cycles: area.active_cycle_count,
        max_plant_capacity: area.max_plant_capacity,
        sensors: `${area.sensor_online_count ?? 0}/${area.sensor_count ?? 0}`,
        latest_reading: area.latest_reading,
        targets: {
          temp: [area.target_temp_min_f, area.target_temp_max_f],
          humidity: [area.target_humidity_min_pct, area.target_humidity_max_pct],
          vpd: [area.target_vpd_min, area.target_vpd_max],
          co2: [area.target_co2_min_ppm, area.target_co2_max_ppm],
        },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (!area || !codyPayload) return;
    setContext({ context_type: "area_detail", context_id: area.id, page_data: codyPayload });
    return () => clearContext();
  }, [setContext, clearContext, codyPayload, area?.id]);

  useShortcut(["e"], () => setEditOpen(true), { description: "Edit area", scope: "Area Detail", enabled: !!area && !editOpen });
  useShortcut(["s"], () => setActiveTab("environment"), { description: "Jump to Environment tab", scope: "Area Detail", enabled: !!area && !editOpen });

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!area) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState
          icon={MapPin}
          title="Area not found"
          description="This area may have been archived or does not exist."
          primaryAction={<Button onClick={() => navigate("/cultivation/areas")}>← Back to areas</Button>}
        />
      </div>
    );
  }

  const type = area.canopy_type ?? "flower";
  const color = AREA_CANOPY_TYPE_COLORS[type as AreaCanopyType];

  const handleSave = async (input: AreaInput, sensorIds: string[]) => {
    await updateArea(area.id, input);
    await assignSensors(area.id, sensorIds);
    refresh();
    return area;
  };

  const handleArchive = async () => {
    if (!confirm(`Archive "${area.name}"? Plants and cycles tied to it keep their references.`)) return;
    try {
      await archiveArea(area.id);
      toast.success("Area archived");
      navigate("/cultivation/areas");
    } catch (e: any) { toast.error(e?.message ?? "Archive failed"); }
  };

  const utilizationPct = area.max_plant_capacity && area.max_plant_capacity > 0
    ? Math.round(((area.active_plant_count ?? 0) / area.max_plant_capacity) * 100)
    : null;

  const sensorHealth = area.sensor_count === 0
    ? "none"
    : area.sensor_online_count === area.sensor_count ? "all_healthy"
    : area.sensor_online_count === 0 ? "all_offline" : "some_offline";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={area.name}
        breadcrumbs={[
          { label: "Cultivation" },
          { label: "Areas", to: "/cultivation/areas" },
          { label: area.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider", color.bg, color.text)}>
              {AREA_CANOPY_TYPE_LABELS[type as AreaCanopyType]}
            </span>
            {area.is_licensed_canopy && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-amber-500/10 text-amber-500 uppercase tracking-wider">
                <Star className="w-3 h-3 fill-amber-500" /> Licensed
              </span>
            )}
            {area.is_quarantine && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-red-500/10 text-red-500 uppercase tracking-wider">
                <ShieldAlert className="w-3 h-3" /> Quarantine
              </span>
            )}
            <Button variant="outline" onClick={() => navigate(`/cultivation/plants?area=${area.id}`)} className="gap-1.5">
              <Leaf className="w-3.5 h-3.5" /> View Plants
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Edit className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button variant="outline" onClick={handleArchive} className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10">
              <Archive className="w-3.5 h-3.5" /> Archive
            </Button>
          </div>
        }
      />

      {/* Hero subtitle — facility link */}
      {area.facility && (
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-6 -mt-4">
          <Building2 className="w-3.5 h-3.5" />
          <button
            onClick={() => navigate(`/settings/facilities/${area.facility!.id}`)}
            className="hover:text-primary hover:underline"
          >
            {area.facility.name}
          </button>
          {area.canopy_sqft != null && (
            <>
              <span>·</span>
              <span className="font-mono">{area.canopy_sqft.toLocaleString()} sqft</span>
            </>
          )}
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Canopy"
          value={area.canopy_sqft != null ? `${area.canopy_sqft}` : "—"}
          accentClass={area.is_licensed_canopy ? "stat-accent-amber" : "stat-accent-blue"}
          trend={area.canopy_sqft != null ? "sqft" : undefined}
        />
        <StatCard
          label="Active Plants"
          value={area.active_plant_count ?? 0}
          accentClass="stat-accent-emerald"
          delay={0.05}
          onClick={() => navigate(`/cultivation/plants?area=${area.id}`)}
        />
        <StatCard
          label="Active Cycles"
          value={area.active_cycle_count ?? 0}
          accentClass="stat-accent-teal"
          delay={0.1}
          onClick={() => setActiveTab("cycles")}
        />
        <StatCard
          label="Sensors"
          value={`${area.sensor_online_count ?? 0}/${area.sensor_count ?? 0}`}
          accentClass={sensorHealth === "all_healthy" ? "stat-accent-emerald" : sensorHealth === "all_offline" ? "stat-accent-rose" : "stat-accent-amber"}
          delay={0.15}
          onClick={() => setActiveTab("environment")}
        >
          {sensorHealth === "all_healthy" && <span className="text-[10px] text-emerald-500 flex items-center gap-1 mt-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> All healthy</span>}
          {sensorHealth === "some_offline" && <span className="text-[10px] text-amber-500 flex items-center gap-1 mt-1">Some offline</span>}
          {sensorHealth === "all_offline" && <span className="text-[10px] text-destructive flex items-center gap-1 mt-1">All offline</span>}
        </StatCard>
        <StatCard
          label="Utilization"
          value={utilizationPct != null ? `${utilizationPct}%` : "—"}
          accentClass={utilizationPct == null ? "stat-accent-blue" : utilizationPct >= 100 ? "stat-accent-rose" : utilizationPct >= 80 ? "stat-accent-amber" : "stat-accent-emerald"}
          delay={0.2}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="plants">Plants</TabsTrigger>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="harvests">Harvests</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewPanel area={area} /></TabsContent>
        <TabsContent value="environment"><EnvironmentPanel area={area} /></TabsContent>
        <TabsContent value="plants"><PlantsPanel areaId={area.id} /></TabsContent>
        <TabsContent value="cycles"><CyclesPanel areaId={area.id} /></TabsContent>
        <TabsContent value="harvests"><HarvestsPanel areaId={area.id} /></TabsContent>
        <TabsContent value="activity">
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[14px] font-semibold text-foreground mb-1">Audit log coming soon</p>
            <p className="text-[12px] text-muted-foreground">Area edits, sensor reassignments, and alerts will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>

      <AreaFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editing={area}
        currentSensorIds={editingSensorIds}
        onSave={handleSave}
      />
    </div>
  );
}

// ─── Overview panel ───────────────────────────────────────────────────────────

function OverviewPanel({ area }: { area: Area }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Space */}
        <Card title="Space">
          <dl className="divide-y divide-border">
            <Row label="Dimensions" value={area.length_ft && area.width_ft
              ? `${area.length_ft} × ${area.width_ft}${area.height_ft ? ` × ${area.height_ft}` : ""} ft`
              : "—"} />
            <Row label="Canopy" value={area.canopy_sqft != null
              ? <span className="font-mono">{area.canopy_sqft.toLocaleString()} sqft{area.is_licensed_canopy ? " · licensed" : ""}</span>
              : "—"} />
            <Row label="Max Plant Capacity" value={area.max_plant_capacity ?? "—"} />
            <Row label="Light Wattage" value={area.light_wattage != null ? <span className="font-mono">{area.light_wattage}W</span> : "—"} />
            <Row label="Light Type" value={area.light_type ? AREA_LIGHT_TYPE_LABELS[area.light_type] : "—"} />
          </dl>
        </Card>

        {/* CCRS */}
        <Card title="CCRS Compliance">
          <dl className="divide-y divide-border">
            <Row label="Quarantine" value={area.is_quarantine ? (
              <span className="inline-flex items-center gap-1 text-red-500">
                <ShieldAlert className="w-3.5 h-3.5" /> Yes
              </span>
            ) : "No"} />
            <Row label="External ID" value={<span className="font-mono">{area.external_id}</span>} />
            <Row label="CCRS Notes" value={area.ccrs_notes ?? "—"} />
            <Row label="Description" value={area.notes ?? "—"} />
          </dl>
        </Card>

        {/* Environmental targets */}
        <Card title="Environmental Targets">
          <dl className="divide-y divide-border">
            <TargetRow icon={Thermometer} color="text-red-500" label="Temperature" min={area.target_temp_min_f} max={area.target_temp_max_f} unit="°F" />
            <TargetRow icon={Droplets} color="text-blue-500" label="Humidity" min={area.target_humidity_min_pct} max={area.target_humidity_max_pct} unit="%" />
            <TargetRow icon={Wind} color="text-teal-500" label="VPD" min={area.target_vpd_min} max={area.target_vpd_max} unit="kPa" />
            <TargetRow icon={Gauge} color="text-emerald-500" label="CO₂" min={area.target_co2_min_ppm} max={area.target_co2_max_ppm} unit="ppm" />
          </dl>
        </Card>
      </div>

      <div className="lg:col-span-1 space-y-4">
        <CodyInsightsPanel />
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="text-[12px] font-semibold text-foreground mb-2">Ask Cody</h4>
          <div className="space-y-1.5">
            {[
              `How is ${area.name} trending on temperature and VPD?`,
              `Is ${area.name} on track for canopy utilization?`,
              `Any environmental anomalies in ${area.name} this week?`,
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  window.dispatchEvent(new Event("open-cody-chat"));
                  window.dispatchEvent(new CustomEvent("cody-prefill", { detail: q }));
                }}
                className="w-full text-left text-[11px] text-muted-foreground hover:text-primary hover:bg-accent/50 rounded p-2 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Environment panel — the signature tab ───────────────────────────────────

function EnvironmentPanel({ area }: { area: Area }) {
  const [range, setRange] = useState<EnvTimeRange>("24h");
  const { data: readings, latest, trend, loading } = useAreaEnvironment(area.id, range);
  const { data: alerts, resolve } = useAreaAlerts(area.id);
  const { data: sensors } = useAreaSensors(area.id);

  const unresolvedAlerts = alerts.filter((a) => !a.resolved_at);

  const targetFor = (metric: EnvMetric) => {
    switch (metric) {
      case "temperature": return { min: area.target_temp_min_f, max: area.target_temp_max_f };
      case "humidity": return { min: area.target_humidity_min_pct, max: area.target_humidity_max_pct };
      case "vpd": return { min: area.target_vpd_min, max: area.target_vpd_max };
      case "co2": return { min: area.target_co2_min_ppm, max: area.target_co2_max_ppm };
    }
  };

  const currentValue = (metric: EnvMetric): number | null => {
    if (!latest) return null;
    switch (metric) {
      case "temperature": return latest.temperature_f;
      case "humidity": return latest.humidity_pct;
      case "vpd": return latest.vpd;
      case "co2": return latest.co2_ppm;
    }
  };

  const inRange = (value: number | null, min: number | null, max: number | null) => {
    if (value == null || min == null || max == null) return null;
    return value >= min && value <= max;
  };

  const valueColor = (value: number | null, min: number | null, max: number | null) => {
    const ok = inRange(value, min, max);
    if (ok == null) return "text-foreground";
    if (ok) return "text-emerald-500";
    // Near-threshold: within 10% of range
    if (min != null && max != null) {
      const span = max - min;
      const buffer = span * 0.1;
      if (value! < min - buffer || value! > max + buffer) return "text-red-500";
      return "text-amber-500";
    }
    return "text-red-500";
  };

  const hasSensors = (area.sensor_count ?? 0) > 0;
  const hasData = !loading && readings.length > 0;

  if (!hasSensors) {
    return (
      <EmptyState
        icon={WifiOff}
        title="No environmental data yet"
        description="Assign sensors from the Equipment page or configure Aranet/TrolMaster integration in Settings → Integrations."
        primaryAction={<Button onClick={() => window.location.href = "/settings/equipment"} className="gap-1.5"><Wifi className="w-3.5 h-3.5" /> Go to Equipment</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Current conditions */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">Current Conditions</h3>
            {latest ? (
              <p className="text-[11px] text-muted-foreground">
                Last updated <DateTime value={latest.recorded_at} format="auto" />
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Awaiting first reading…</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCurrent icon={Thermometer} color="text-red-500" label="Temperature" value={currentValue("temperature")} unit="°F" trend={trend.temperature} digits={1} valueColor={valueColor(currentValue("temperature"), area.target_temp_min_f, area.target_temp_max_f)} />
          <MetricCurrent icon={Droplets} color="text-blue-500" label="Humidity" value={currentValue("humidity")} unit="%" trend={trend.humidity} digits={1} valueColor={valueColor(currentValue("humidity"), area.target_humidity_min_pct, area.target_humidity_max_pct)} />
          <MetricCurrent icon={Wind} color="text-teal-500" label="VPD" value={currentValue("vpd")} unit=" kPa" trend={trend.vpd} digits={2} valueColor={valueColor(currentValue("vpd"), area.target_vpd_min, area.target_vpd_max)} />
          <MetricCurrent icon={Gauge} color="text-emerald-500" label="CO₂" value={currentValue("co2")} unit=" ppm" trend={trend.co2} digits={0} valueColor={valueColor(currentValue("co2"), area.target_co2_min_ppm, area.target_co2_max_ppm)} />
        </div>
      </div>

      {/* Charts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-foreground">Trends</h3>
          <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
            {(["24h", "7d", "30d"] as EnvTimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn("px-2 h-7 text-[11px] font-medium rounded", range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : !hasData ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Wifi className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[13px] font-semibold text-foreground mb-1">No readings in this window</p>
            <p className="text-[12px] text-muted-foreground">Sensors are assigned but haven't pushed data for the selected range.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EnvironmentChart data={readings} metric="temperature" targetRange={targetFor("temperature")} timeRange={range} />
            <EnvironmentChart data={readings} metric="humidity" targetRange={targetFor("humidity")} timeRange={range} />
            <EnvironmentChart data={readings} metric="vpd" targetRange={targetFor("vpd")} timeRange={range} />
            <EnvironmentChart data={readings} metric="co2" targetRange={targetFor("co2")} timeRange={range} />
          </div>
        )}
      </div>

      {/* Alerts */}
      <Card title={`Alerts${unresolvedAlerts.length > 0 ? ` (${unresolvedAlerts.length} unresolved)` : ""}`}>
        {alerts.length === 0 ? (
          <div className="p-6 text-center">
            <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
            <p className="text-[12px] text-muted-foreground">No alerts recorded.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.slice(0, 10).map((a) => (
              <li key={a.id} className="px-5 py-3 flex items-start gap-3">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                  a.severity === "critical" ? "bg-red-500/15 text-red-500" :
                  a.severity === "warning" ? "bg-amber-500/15 text-amber-500" :
                  "bg-blue-500/15 text-blue-500",
                )}>
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-foreground">{a.alert_type.replaceAll("_", " ")}</p>
                    <StatusPill label={a.severity} variant={a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "info"} />
                    {a.resolved_at && <StatusPill label="Resolved" variant="success" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    <DateTime value={a.created_at} format="auto" />
                    {a.actual_value != null && <> · reading <span className="font-mono">{a.actual_value}</span></>}
                    {a.threshold_value != null && <> · threshold <span className="font-mono">{a.threshold_value}</span></>}
                    {a.duration_minutes && <> · {a.duration_minutes} min</>}
                  </p>
                  {a.resolution_notes && <p className="text-[11px] text-muted-foreground italic mt-1">"{a.resolution_notes}"</p>}
                </div>
                {!a.resolved_at && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const notes = prompt("Resolution notes (optional)") ?? undefined;
                      try {
                        await resolve(a.id, notes || undefined);
                        toast.success("Alert resolved");
                      } catch (e: any) { toast.error(e?.message ?? "Failed"); }
                    }}
                  >
                    Resolve
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Sensors */}
      <Card title={`Sensors (${sensors.length})`}>
        {sensors.length === 0 ? (
          <p className="text-[12px] text-muted-foreground italic p-6">No sensors assigned.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sensors.map((s) => {
              const fresh = s.last_ping_at && (Date.now() - new Date(s.last_ping_at).getTime()) < FRESH_SENSOR_MS;
              return (
                <li key={s.id} className="px-5 py-3 flex items-center gap-3">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", fresh ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground")}>
                    {fresh ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground">
                      {[s.manufacturer, s.model].filter(Boolean).join(" ") || "Unnamed sensor"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.connection_type ? HARDWARE_CONNECTION_TYPE_LABELS[s.connection_type as keyof typeof HARDWARE_CONNECTION_TYPE_LABELS] ?? s.connection_type : "—"}
                      {s.last_ping_at ? <> · last ping <DateTime value={s.last_ping_at} format="auto" /></> : <> · never pinged</>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ─── Sub-panels ──────────────────────────────────────────────────────────────

function PlantsPanel({ areaId }: { areaId: string }) {
  const navigate = useNavigate();
  const { data: plants, loading } = useAreaPlants(areaId);

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "plant_tag",
      header: "Plant",
      cell: ({ row }) => (
        <button onClick={() => navigate(`/cultivation/plants/${row.original.id}`)} className="text-[12px] font-mono text-primary hover:underline">
          {row.original.plant_tag ?? row.original.id.slice(0, 8)}
        </button>
      ),
    },
    {
      id: "strain",
      header: "Strain",
      cell: ({ row }) => row.original.strain
        ? <button onClick={() => navigate(`/cultivation/strains/${row.original.strain.id}`)} className="text-[12px] text-primary hover:underline">{row.original.strain.name}</button>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    { accessorKey: "phase", header: "Phase", cell: ({ row }) => <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium capitalize">{row.original.phase?.replaceAll("_", " ") ?? "—"}</span> },
    {
      id: "age", header: "Age",
      cell: ({ row }) => {
        const start = row.original.planted_date ?? row.original.created_at;
        if (!start) return "—";
        const d = Math.floor((Date.now() - new Date(start).getTime()) / 86400000);
        return <span className="text-[12px] font-mono">{d}d</span>;
      },
    },
    {
      id: "cycle", header: "Cycle",
      cell: ({ row }) => row.original.cycle_id
        ? <button onClick={() => navigate(`/cultivation/grow-cycles/${row.original.cycle_id}`)} className="text-[12px] text-primary hover:underline">View</button>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
  ];

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (plants.length === 0) {
    return <EmptyState icon={Leaf} title="No active plants" description="Plants in this area will appear here. Start a new cycle from Grow Cycles to populate this area." />;
  }
  return <DataTable columns={columns} data={plants} />;
}

function CyclesPanel({ areaId }: { areaId: string }) {
  const navigate = useNavigate();
  const { data: cycles, loading } = useAreaCycles(areaId);

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "cycle_name", header: "Cycle",
      cell: ({ row }) => (
        <button onClick={() => navigate(`/cultivation/grow-cycles/${row.original.id}`)} className="text-[12px] font-medium text-primary hover:underline">
          {row.original.cycle_name ?? row.original.id.slice(0, 8)}
        </button>
      ),
    },
    {
      id: "strain", header: "Strain",
      cell: ({ row }) => row.original.strain
        ? <button onClick={() => navigate(`/cultivation/strains/${row.original.strain.id}`)} className="text-[12px] text-primary hover:underline">{row.original.strain.name}</button>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    { accessorKey: "start_date", header: "Started", cell: ({ row }) => row.original.start_date ? <DateTime value={row.original.start_date} format="date-only" className="text-[12px]" /> : "—" },
    { accessorKey: "phase", header: "Phase", cell: ({ row }) => <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium capitalize">{row.original.phase?.replaceAll("_", " ") ?? "—"}</span> },
    { accessorKey: "plant_count", header: "Plants", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.plant_count ?? "—"}</span> },
    { accessorKey: "expected_harvest_date", header: "Expected Harvest", cell: ({ row }) => row.original.expected_harvest_date ? <DateTime value={row.original.expected_harvest_date} format="date-only" className="text-[12px]" /> : "—" },
  ];

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (cycles.length === 0) {
    return <EmptyState icon={CalendarDays} title="No cycles" description="Cycles run in this area will appear here." />;
  }
  return <DataTable columns={columns} data={cycles} />;
}

function HarvestsPanel({ areaId }: { areaId: string }) {
  const navigate = useNavigate();
  const { data: harvests, loading } = useAreaHarvests(areaId);

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "harvest_name", header: "Harvest",
      cell: ({ row }) => (
        <button onClick={() => navigate(`/cultivation/harvests/${row.original.id}`)} className="text-[12px] font-medium text-primary hover:underline">
          {row.original.harvest_name ?? row.original.id.slice(0, 8)}
        </button>
      ),
    },
    {
      id: "strain", header: "Strain",
      cell: ({ row }) => row.original.strain
        ? <span className="text-[12px]">{row.original.strain.name}</span>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    { accessorKey: "harvest_date", header: "Date", cell: ({ row }) => row.original.harvest_date ? <DateTime value={row.original.harvest_date} format="date-only" className="text-[12px]" /> : "—" },
    { accessorKey: "plant_count", header: "Plants", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.plant_count ?? "—"}</span> },
    { accessorKey: "total_wet_weight_grams", header: "Wet (g)", cell: ({ row }) => row.original.total_wet_weight_grams != null ? <span className="font-mono text-[12px]">{Number(row.original.total_wet_weight_grams).toFixed(0)}</span> : "—" },
    { accessorKey: "total_dry_weight_grams", header: "Dry (g)", cell: ({ row }) => row.original.total_dry_weight_grams != null ? <span className="font-mono text-[12px]">{Number(row.original.total_dry_weight_grams).toFixed(0)}</span> : "—" },
  ];

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (harvests.length === 0) {
    return <EmptyState icon={Scissors} title="No harvests" description="Harvests from cycles in this area will appear here." />;
  }
  return <DataTable columns={columns} data={harvests} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function MetricCurrent({
  icon: Icon, color, label, value, unit, trend, digits, valueColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  color: string; label: string;
  value: number | null; unit: string;
  trend: number; digits: number;
  valueColor: string;
}) {
  const TrendIcon = trend > 0.01 ? ArrowUp : trend < -0.01 ? ArrowDown : ArrowRight;
  return (
    <div className="rounded-lg border border-border bg-background/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
      </div>
      <div className={cn("text-[28px] font-bold font-mono tabular-nums leading-none", valueColor)}>
        {value != null ? `${value.toFixed(digits)}${unit}` : "—"}
      </div>
      {value != null && (
        <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
          <TrendIcon className={cn("w-3 h-3", trend > 0.01 ? "text-amber-500" : trend < -0.01 ? "text-blue-500" : "text-muted-foreground/50")} />
          <span>15m {trend >= 0 ? "+" : ""}{trend.toFixed(digits)}</span>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/20">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 px-5 py-2.5">
      <dt className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</dt>
      <dd className="text-[12px] text-foreground">{value}</dd>
    </div>
  );
}

function TargetRow({ icon: Icon, color, label, min, max, unit }: { icon: any; color: string; label: string; min: number | null; max: number | null; unit: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 px-5 py-2.5 items-center">
      <dt className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground flex items-center gap-1.5">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        {label}
      </dt>
      <dd className="text-[12px] text-foreground font-mono">
        {min != null && max != null ? `${min} – ${max} ${unit}` : <span className="text-muted-foreground italic">Uses org defaults</span>}
      </dd>
    </div>
  );
}

void Info; void Package; void Ruler; void ClipboardCheck;
