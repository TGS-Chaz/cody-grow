import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin, CheckCircle2, Ruler, Leaf, Wifi, WifiOff, Plus,
  MoreHorizontal, Edit, Archive, Eye, ShieldAlert, Star,
  Thermometer, Droplets, Wind, Gauge, Table2, LayoutGrid,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import StatusPill from "@/components/shared/StatusPill";
import DateTime from "@/components/shared/DateTime";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import { supabase } from "@/lib/supabase";
import { useAreas, useAreaStats, Area, AreaInput } from "@/hooks/useAreas";
import {
  AREA_CANOPY_TYPES, AREA_CANOPY_TYPE_LABELS, AREA_CANOPY_TYPE_COLORS,
  AreaCanopyType,
} from "@/lib/schema-enums";
import AreaFormModal from "./AreaFormModal";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "floor";

export default function AreasPage() {
  const navigate = useNavigate();
  const { data: areas, loading, createArea, updateArea, archiveArea, assignSensors } = useAreas();
  const stats = useAreaStats(areas);
  const { setContext, clearContext } = useCodyContext();

  const [searchValue, setSearchValue] = useState("");
  const [facilityFilter, setFacilityFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<AreaCanopyType | "">("");
  const [licensedFilter, setLicensedFilter] = useState<"yes" | "no" | "">("");
  const [sensorFilter, setSensorFilter] = useState<"yes" | "no" | "">("");
  const [occupancyFilter, setOccupancyFilter] = useState<"empty" | "partial" | "full" | "">("");
  const [view, setView] = useState<ViewMode>("table");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);
  const [editingSensorIds, setEditingSensorIds] = useState<string[]>([]);

  const facilities = useMemo(() => {
    const map = new Map<string, string>();
    areas.forEach((a) => { if (a.facility) map.set(a.facility.id, a.facility.name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [areas]);

  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return areas.filter((a) => {
      if (q) {
        const hay = `${a.name} ${a.notes ?? ""} ${a.facility?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (facilityFilter && a.facility_id !== facilityFilter) return false;
      if (typeFilter && a.canopy_type !== typeFilter) return false;
      if (licensedFilter === "yes" && !a.is_licensed_canopy) return false;
      if (licensedFilter === "no" && a.is_licensed_canopy) return false;
      if (sensorFilter === "yes" && (a.sensor_count ?? 0) === 0) return false;
      if (sensorFilter === "no" && (a.sensor_count ?? 0) > 0) return false;
      if (occupancyFilter) {
        const plants = a.active_plant_count ?? 0;
        const max = a.max_plant_capacity ?? 0;
        if (occupancyFilter === "empty" && plants > 0) return false;
        if (occupancyFilter === "full" && (max === 0 || plants < max)) return false;
        if (occupancyFilter === "partial" && (plants === 0 || (max > 0 && plants >= max))) return false;
      }
      return true;
    });
  }, [areas, searchValue, facilityFilter, typeFilter, licensedFilter, sensorFilter, occupancyFilter]);

  // Cody context
  const sig = useMemo(() => areas.map((a) => `${a.id}:${a.active_plant_count ?? 0}:${a.sensor_online_count ?? 0}`).join(","), [areas]);
  const payload = useMemo(() => ({
    counts: stats,
    areas: areas.map((a) => ({
      name: a.name,
      type: a.canopy_type,
      facility: a.facility?.name,
      canopy_sqft: a.canopy_sqft,
      licensed: a.is_licensed_canopy,
      is_quarantine: a.is_quarantine,
      active_plants: a.active_plant_count,
      sensors_online: `${a.sensor_online_count ?? 0}/${a.sensor_count ?? 0}`,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sig, stats.total]);

  useEffect(() => {
    setContext({ context_type: "areas_list", page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload]);

  useShortcut(["n"], () => { setEditing(null); setEditingSensorIds([]); setModalOpen(true); }, { description: "Add area", scope: "Areas", enabled: !modalOpen });
  useShortcut(["/"], () => document.querySelector<HTMLInputElement>("[data-filters-search]")?.focus(), { description: "Focus search", scope: "Areas", enabled: !modalOpen });

  const handleSave = async (input: AreaInput, sensorIds: string[]) => {
    let savedId = editing?.id;
    if (editing) {
      await updateArea(editing.id, input);
    } else {
      const created = await createArea(input);
      savedId = created.id;
    }
    if (savedId) await assignSensors(savedId, sensorIds);
    return (editing ?? { id: savedId }) as Area;
  };

  const openEdit = async (a: Area) => {
    setEditing(a);
    const { data: assigned } = await supabase
      .from("grow_hardware_devices")
      .select("id")
      .eq("assigned_to_area_id", a.id);
    setEditingSensorIds((assigned ?? []).map((s: any) => s.id));
    setModalOpen(true);
  };

  const columns: ColumnDef<Area>[] = useMemo(() => [
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => {
        const a = row.original;
        const color = a.canopy_type ? AREA_CANOPY_TYPE_COLORS[a.canopy_type] : null;
        return (
          <button
            onClick={() => navigate(`/cultivation/areas/${a.id}`)}
            className={cn(
              "flex items-center text-left pl-3 -ml-3 py-1 border-l-4",
              color?.border ?? "border-l-border",
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium text-primary hover:underline truncate">{a.name}</span>
                {a.is_quarantine && <ShieldAlert className="w-3 h-3 text-red-500" />}
              </div>
              {a.facility?.name && <div className="text-[11px] text-muted-foreground truncate">{a.facility.name}</div>}
            </div>
          </button>
        );
      },
    },
    {
      accessorKey: "canopy_type",
      header: "Type",
      cell: ({ row }) => {
        const t = row.original.canopy_type;
        if (!t) return <span className="text-muted-foreground text-[12px]">—</span>;
        const c = AREA_CANOPY_TYPE_COLORS[t];
        return <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium", c.bg, c.text)}>{AREA_CANOPY_TYPE_LABELS[t]}</span>;
      },
    },
    {
      accessorKey: "canopy_sqft",
      header: "Canopy",
      cell: ({ row }) => {
        const a = row.original;
        if (a.canopy_sqft == null) return <span className="text-muted-foreground text-[12px]">—</span>;
        return (
          <span className={cn("font-mono text-[12px] tabular-nums", a.is_licensed_canopy ? "font-semibold text-foreground" : "")}>
            {a.canopy_sqft.toLocaleString()} sqft
          </span>
        );
      },
    },
    {
      id: "licensed",
      header: "Licensed",
      cell: ({ row }) => row.original.is_licensed_canopy
        ? <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
        : <span className="text-muted-foreground text-[11px]">—</span>,
    },
    {
      id: "active_plants",
      header: "Plants",
      cell: ({ row }) => {
        const n = row.original.active_plant_count ?? 0;
        const max = row.original.max_plant_capacity;
        if (n === 0 && !max) return <span className="text-muted-foreground text-[12px]">0</span>;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/cultivation/plants?area=${row.original.id}`); }}
            className="text-[12px] text-primary hover:underline tabular-nums font-mono"
          >
            {n}{max ? `/${max}` : ""}
          </button>
        );
      },
    },
    {
      id: "active_cycles",
      header: "Cycles",
      cell: ({ row }) => {
        const n = row.original.active_cycle_count ?? 0;
        if (n === 0) return <span className="text-muted-foreground text-[12px]">0</span>;
        return <span className="text-[12px] font-mono tabular-nums">{n}</span>;
      },
    },
    {
      id: "environment",
      header: "Environment",
      cell: ({ row }) => <EnvironmentInline area={row.original} />,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => row.original.is_active
        ? <StatusPill label="Active" variant="success" />
        : <StatusPill label="Archived" variant="muted" />,
    },
    {
      id: "actions",
      enableSorting: false,
      header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/cultivation/areas/${row.original.id}`)}>
                <Eye className="w-3.5 h-3.5" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEdit(row.original)}>
                <Edit className="w-3.5 h-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/cultivation/areas/${row.original.id}?tab=environment`)}>
                <Wifi className="w-3.5 h-3.5" /> Sensors & Environment
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => { if (confirm(`Archive "${row.original.name}"? Plants and cycles already tied to it keep their references.`)) await archiveArea(row.original.id); }}
                className="text-destructive"
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate, archiveArea]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Areas"
        description="Grow rooms, drying rooms, and zones at your facilities"
        breadcrumbs={[{ label: "Cultivation" }, { label: "Areas" }]}
        actions={
          <div className="flex items-center gap-2">
            <ViewToggle view={view} setView={setView} />
            <Button onClick={() => { setEditing(null); setEditingSensorIds([]); setModalOpen(true); }} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Area
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Areas" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Active" value={stats.active} accentClass="stat-accent-emerald" delay={0.05} />
        <StatCard label="Licensed Canopy" value={`${stats.licensedCanopy.toLocaleString()} sqft`} accentClass="stat-accent-purple" delay={0.1} />
        <StatCard label="Occupied" value={stats.occupied} accentClass="stat-accent-teal" delay={0.15} />
        <StatCard label="Sensors Online" value={stats.sensorsOnline} accentClass={stats.sensorsOnline > 0 ? "stat-accent-amber" : "stat-accent-rose"} delay={0.2} />
      </div>

      <FiltersBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search name, description…"
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border" disabled={facilities.length === 0}>
              <option value="">All facilities</option>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as AreaCanopyType | "")} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All types</option>
              {AREA_CANOPY_TYPES.map((t) => <option key={t} value={t}>{AREA_CANOPY_TYPE_LABELS[t]}</option>)}
            </select>
            <select value={licensedFilter} onChange={(e) => setLicensedFilter(e.target.value as any)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">Any canopy</option>
              <option value="yes">Licensed</option>
              <option value="no">Unlicensed</option>
            </select>
            <select value={sensorFilter} onChange={(e) => setSensorFilter(e.target.value as any)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">Any sensors</option>
              <option value="yes">Has sensors</option>
              <option value="no">No sensors</option>
            </select>
            <select value={occupancyFilter} onChange={(e) => setOccupancyFilter(e.target.value as any)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">Any occupancy</option>
              <option value="empty">Empty</option>
              <option value="partial">Partial</option>
              <option value="full">Full (at capacity)</option>
            </select>
          </div>
        }
      />

      {view === "floor" ? (
        <FloorPlanStub onSwitchToTable={() => setView("table")} />
      ) : filtered.length === 0 ? (
        <EmptyBlock hasAreas={areas.length > 0} onAdd={() => { setEditing(null); setEditingSensorIds([]); setModalOpen(true); }} />
      ) : (
        <DataTable columns={columns} data={filtered} loading={loading} />
      )}

      <AreaFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); setEditingSensorIds([]); }}
        editing={editing}
        currentSensorIds={editingSensorIds}
        onSave={handleSave}
      />
    </div>
  );
}

// ─── Inline environment strip for the list ────────────────────────────────────

function EnvironmentInline({ area }: { area: Area }) {
  const r = area.latest_reading;
  if ((area.sensor_count ?? 0) === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <WifiOff className="w-3 h-3" /> No sensors
      </span>
    );
  }
  if (!r) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Wifi className="w-3 h-3" /> Awaiting readings
      </span>
    );
  }

  const inRange = (val: number | null, min: number | null, max: number | null) => {
    if (val == null || min == null || max == null) return true;
    return val >= min && val <= max;
  };

  const tempOk = inRange(r.temperature_f, area.target_temp_min_f, area.target_temp_max_f);
  const humOk = inRange(r.humidity_pct, area.target_humidity_min_pct, area.target_humidity_max_pct);
  const vpdOk = inRange(r.vpd, area.target_vpd_min, area.target_vpd_max);
  const co2Ok = inRange(r.co2_ppm, area.target_co2_min_ppm, area.target_co2_max_ppm);

  const cls = (ok: boolean) => ok ? "text-muted-foreground" : "text-destructive font-semibold";

  return (
    <div className="flex items-center gap-2 text-[11px] font-mono">
      {r.temperature_f != null && (
        <span className={cn("inline-flex items-center gap-0.5", cls(tempOk))} title="Temperature">
          <Thermometer className="w-3 h-3 text-red-500" />
          {Number(r.temperature_f).toFixed(1)}°
        </span>
      )}
      {r.humidity_pct != null && (
        <span className={cn("inline-flex items-center gap-0.5", cls(humOk))} title="Humidity">
          <Droplets className="w-3 h-3 text-blue-500" />
          {Number(r.humidity_pct).toFixed(0)}%
        </span>
      )}
      {r.vpd != null && (
        <span className={cn("inline-flex items-center gap-0.5", cls(vpdOk))} title="VPD">
          <Wind className="w-3 h-3 text-teal-500" />
          {Number(r.vpd).toFixed(2)}
        </span>
      )}
      {r.co2_ppm != null && (
        <span className={cn("inline-flex items-center gap-0.5", cls(co2Ok))} title="CO₂">
          <Gauge className="w-3 h-3 text-emerald-500" />
          {r.co2_ppm}
        </span>
      )}
    </div>
  );
}

// ─── Placeholder floor plan view ──────────────────────────────────────────────

function FloorPlanStub({ onSwitchToTable }: { onSwitchToTable: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      {/* Blueprint-style grid illustration */}
      <div className="relative mx-auto w-full max-w-md aspect-[3/2] rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 overflow-hidden mb-5">
        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <div className="absolute inset-6 flex flex-wrap gap-2">
          <div className="h-20 w-28 rounded bg-purple-500/20 border border-purple-500/40" title="Flower" />
          <div className="h-20 w-20 rounded bg-emerald-500/20 border border-emerald-500/40" title="Veg" />
          <div className="h-14 w-20 rounded bg-blue-500/20 border border-blue-500/40" title="Mother" />
          <div className="h-14 w-20 rounded bg-orange-500/20 border border-orange-500/40" title="Drying" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-background/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border shadow-sm">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Preview</span>
          </div>
        </div>
      </div>
      <h3 className="text-[15px] font-semibold text-foreground mb-1">Visual Floor Plan — Coming Soon</h3>
      <p className="text-[12px] text-muted-foreground max-w-md mx-auto mb-4">
        Drag-and-drop room layout with live sensor overlays, plant-density heatmaps, and canopy
        utilization. On the roadmap.
      </p>
      <button
        type="button"
        onClick={onSwitchToTable}
        className="text-[12px] font-medium text-primary hover:text-primary/80 inline-flex items-center gap-1"
      >
        Switch to Table View →
      </button>
    </div>
  );
}

function ViewToggle({ view, setView }: { view: ViewMode; setView: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
      <button
        type="button"
        onClick={() => setView("table")}
        className={cn("px-2 h-8 text-[11px] font-medium rounded inline-flex items-center gap-1", view === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
      >
        <Table2 className="w-3.5 h-3.5" /> Table
      </button>
      <button
        type="button"
        onClick={() => setView("floor")}
        title="Floor plan preview"
        className={cn("px-2 h-8 text-[11px] font-medium rounded inline-flex items-center gap-1", view === "floor" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
      >
        <LayoutGrid className="w-3.5 h-3.5" /> Floor plan
      </button>
    </div>
  );
}

function EmptyBlock({ hasAreas, onAdd }: { hasAreas: boolean; onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-12 text-center">
      <MapPin className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
      <p className="text-[15px] font-semibold text-foreground mb-1">
        {hasAreas ? "No matches" : "Define your grow spaces"}
      </p>
      <p className="text-[12px] text-muted-foreground mb-5 max-w-md mx-auto">
        {hasAreas
          ? "No areas match your current filters. Clear them or adjust the search."
          : "Areas map to physical rooms and zones at your facility. They're required for CCRS reporting, canopy tracking, and environmental monitoring."}
      </p>
      {!hasAreas && (
        <Button onClick={onAdd} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add First Area
        </Button>
      )}
    </div>
  );
}

void Leaf; void CheckCircle2; void Ruler; void DateTime;
