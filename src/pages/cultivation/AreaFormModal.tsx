import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, ChevronUp, Loader2, MapPin, ShieldAlert, Info,
  Thermometer, Droplets, Wind, Gauge,
} from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import {
  AREA_CANOPY_TYPES, AREA_CANOPY_TYPE_LABELS, AREA_CANOPY_TYPE_COLORS,
  AreaCanopyType,
  AREA_LIGHT_TYPES, AREA_LIGHT_TYPE_LABELS, AreaLightType,
} from "@/lib/schema-enums";
import { Area, AreaInput } from "@/hooks/useAreas";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: AreaInput, sensorIds: string[]) => Promise<Area>;
  editing?: Area | null;
  /** Sensors currently assigned — seeds the multi-select on open. */
  currentSensorIds?: string[];
}

interface FacilityOption { id: string; name: string }
interface SensorOption { id: string; manufacturer: string | null; model: string | null; connection_type: string | null; assigned_to_area_id: string | null }

export default function AreaFormModal({ open, onClose, onSave, editing, currentSensorIds }: Props) {
  const isEdit = !!editing;
  const { orgId } = useOrg();

  const [form, setForm] = useState<AreaInput>({
    name: "",
    facility_id: "",
    canopy_type: "flower",
    is_licensed_canopy: false,
    is_quarantine: false,
    is_active: true,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AreaInput, string>>>({});

  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [sensors, setSensors] = useState<SensorOption[]>([]);
  const [selectedSensorIds, setSelectedSensorIds] = useState<string[]>([]);
  const [defaultRanges, setDefaultRanges] = useState<{
    temp: [number, number] | null;
    humidity: [number, number] | null;
    vpd: [number, number] | null;
    co2: [number, number] | null;
  }>({ temp: null, humidity: null, vpd: null, co2: null });

  useEffect(() => {
    if (!open || !orgId) return;
    (async () => {
      const [facRes, devRes, settingsRes] = await Promise.all([
        supabase.from("grow_facilities").select("id, name").eq("org_id", orgId).order("name"),
        supabase.from("grow_hardware_devices")
          .select("id, manufacturer, model, connection_type, assigned_to_area_id")
          .eq("org_id", orgId)
          .eq("device_type", "environmental_sensor"),
        supabase.from("grow_org_settings").select("environmental_thresholds").eq("org_id", orgId).maybeSingle(),
      ]);
      setFacilities((facRes.data ?? []) as FacilityOption[]);
      setSensors((devRes.data ?? []) as SensorOption[]);

      const t = (settingsRes.data as any)?.environmental_thresholds;
      if (t) {
        setDefaultRanges({
          temp: t.temperature ? [Number(t.temperature.min), Number(t.temperature.max)] : null,
          humidity: t.humidity ? [Number(t.humidity.min), Number(t.humidity.max)] : null,
          vpd: t.vpd ? [Number(t.vpd.min), Number(t.vpd.max)] : null,
          co2: t.co2 ? [Number(t.co2.min), Number(t.co2.max)] : null,
        });
      }
    })();
  }, [open, orgId]);

  // Hydrate form on open
  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editing) {
      setForm({
        name: editing.name,
        facility_id: editing.facility_id ?? "",
        canopy_type: editing.canopy_type ?? "flower",
        is_quarantine: editing.is_quarantine,
        is_licensed_canopy: editing.is_licensed_canopy,
        canopy_sqft: editing.canopy_sqft,
        length_ft: editing.length_ft,
        width_ft: editing.width_ft,
        height_ft: editing.height_ft,
        max_plant_capacity: editing.max_plant_capacity,
        light_wattage: editing.light_wattage,
        light_type: editing.light_type,
        target_temp_min_f: editing.target_temp_min_f,
        target_temp_max_f: editing.target_temp_max_f,
        target_humidity_min_pct: editing.target_humidity_min_pct,
        target_humidity_max_pct: editing.target_humidity_max_pct,
        target_vpd_min: editing.target_vpd_min,
        target_vpd_max: editing.target_vpd_max,
        target_co2_min_ppm: editing.target_co2_min_ppm,
        target_co2_max_ppm: editing.target_co2_max_ppm,
        notes: editing.notes,
        ccrs_notes: editing.ccrs_notes,
        sort_order: editing.sort_order,
        is_active: editing.is_active,
      });
      setSelectedSensorIds(currentSensorIds ?? []);
      setShowAdvanced(true);
    } else {
      setForm({
        name: "",
        facility_id: facilities[0]?.id ?? "",
        canopy_type: "flower",
        is_licensed_canopy: true,
        is_quarantine: false,
        is_active: true,
      });
      setSelectedSensorIds([]);
      setShowAdvanced(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, currentSensorIds?.join(",")]);

  // Default facility to first one on load if not editing
  useEffect(() => {
    if (!editing && facilities.length > 0 && !form.facility_id) {
      setForm((f) => ({ ...f, facility_id: facilities[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilities.length, editing]);

  const set = <K extends keyof AreaInput>(field: K, value: AreaInput[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const availableSensors = useMemo(() => {
    const currentAreaId = editing?.id ?? null;
    return sensors.filter((s) => !s.assigned_to_area_id || s.assigned_to_area_id === currentAreaId);
  }, [sensors, editing]);

  const toggleSensor = (id: string) => {
    setSelectedSensorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Name is required";
    else if (form.name.length > 75) next.name = "CCRS spec limits name to 75 characters";
    if (!form.facility_id) next.facility_id = "Facility is required";
    if (!form.canopy_type) next.canopy_type = "Area type is required";
    if (form.canopy_sqft != null && form.canopy_sqft < 0) next.canopy_sqft = "Must be ≥ 0";
    if (form.target_temp_min_f != null && form.target_temp_max_f != null && form.target_temp_min_f > form.target_temp_max_f) {
      next.target_temp_max_f = "Max must be ≥ min";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({ ...form, name: form.name.trim() }, selectedSensorIds);
      toast.success(isEdit ? "Area updated" : "Area created");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const sensorLabel = (s: SensorOption) => {
    const parts = [s.manufacturer, s.model].filter(Boolean).join(" ");
    return parts || "Unnamed sensor";
  };

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="md"
      onSubmit={handleSubmit}
      header={
        <ModalHeader
          icon={<MapPin className="w-4 h-4 text-primary" />}
          title={isEdit ? "Edit area" : "New area"}
          subtitle="Grow rooms, drying rooms, and zones"
        />
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving} className="min-w-[100px]">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isEdit ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Name" required error={errors.name} helper={form.name.length > 60 ? `${form.name.length}/75 chars` : undefined}>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Flower Room 1" autoFocus maxLength={75} />
        </Field>

        <Field label="Facility" required error={errors.facility_id}>
          {facilities.length === 0 ? (
            <div className="h-10 px-3 flex items-center text-[12px] text-muted-foreground border border-dashed border-border rounded-lg">
              Add a facility in Settings → Facilities first
            </div>
          ) : (
            <select
              value={form.facility_id}
              onChange={(e) => set("facility_id", e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
        </Field>

        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
            Area Type <span className="text-destructive">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {AREA_CANOPY_TYPES.map((t) => {
              const color = AREA_CANOPY_TYPE_COLORS[t];
              const selected = form.canopy_type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("canopy_type", t)}
                  className={cn(
                    "inline-flex items-center h-8 px-3 rounded-full border text-[12px] font-medium transition-colors",
                    selected ? `${color.bg} ${color.text} border-transparent ring-2 ring-offset-1 ring-offset-background ring-${t === "flower" ? "purple" : t === "veg" ? "emerald" : "primary"}-500/40` : "bg-muted/30 border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {AREA_CANOPY_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 pt-2"
        >
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showAdvanced ? "Hide all fields" : "Show all fields"}
        </button>

        <AnimatePresence initial={false}>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-5 overflow-hidden"
            >
              {/* Space */}
              <Section title="Space">
                <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                  <Field label="Canopy Square Footage" error={errors.canopy_sqft}>
                    <div className="relative">
                      <Input
                        type="number" min="0"
                        value={form.canopy_sqft ?? ""}
                        onChange={(e) => set("canopy_sqft", e.target.value ? Number(e.target.value) : null)}
                        className="font-mono pr-12"
                        placeholder="500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">sqft</span>
                    </div>
                  </Field>
                  <label className="flex items-center gap-2 cursor-pointer select-none h-10 mb-0">
                    <input
                      type="checkbox"
                      checked={!!form.is_licensed_canopy}
                      onChange={(e) => set("is_licensed_canopy", e.target.checked)}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-[13px] text-foreground">Licensed canopy</span>
                  </label>
                </div>
                {form.is_licensed_canopy && (
                  <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 text-[11px] text-foreground">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                    Licensed canopy is reported to WSLCB and counts toward your tier canopy allotment.
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Length (ft)">
                    <Input type="number" step="0.5" min="0" value={form.length_ft ?? ""} onChange={(e) => set("length_ft", e.target.value ? Number(e.target.value) : null)} className="font-mono" />
                  </Field>
                  <Field label="Width (ft)">
                    <Input type="number" step="0.5" min="0" value={form.width_ft ?? ""} onChange={(e) => set("width_ft", e.target.value ? Number(e.target.value) : null)} className="font-mono" />
                  </Field>
                  <Field label="Height (ft)">
                    <Input type="number" step="0.5" min="0" value={form.height_ft ?? ""} onChange={(e) => set("height_ft", e.target.value ? Number(e.target.value) : null)} className="font-mono" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Max Plant Capacity" helper="Soft limit for overcrowding alerts">
                    <Input type="number" min="0" value={form.max_plant_capacity ?? ""} onChange={(e) => set("max_plant_capacity", e.target.value ? Number(e.target.value) : null)} className="font-mono" placeholder="100" />
                  </Field>
                  <Field label="Light Wattage" helper="Total watts — used for g/watt calcs">
                    <div className="relative">
                      <Input type="number" min="0" value={form.light_wattage ?? ""} onChange={(e) => set("light_wattage", e.target.value ? Number(e.target.value) : null)} className="font-mono pr-8" placeholder="2400" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">W</span>
                    </div>
                  </Field>
                </div>
                <Field label="Light Type">
                  <select
                    value={form.light_type ?? ""}
                    onChange={(e) => set("light_type", (e.target.value || null) as AreaLightType | null)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">—</option>
                    {AREA_LIGHT_TYPES.map((lt) => <option key={lt} value={lt}>{AREA_LIGHT_TYPE_LABELS[lt]}</option>)}
                  </select>
                </Field>
              </Section>

              {/* CCRS Compliance */}
              <Section title="CCRS Compliance">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!form.is_quarantine}
                    onChange={(e) => set("is_quarantine", e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <ShieldAlert className={cn("w-3.5 h-3.5", form.is_quarantine ? "text-red-500" : "text-muted-foreground")} />
                  <span className="text-[13px] text-foreground">Quarantine area</span>
                </label>
                {form.is_quarantine && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-[11px]">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                    Quarantine areas are for waste hold periods, QA quarantine, or transfer holds. CCRS requires this boolean on every Area record.
                  </div>
                )}
                <Field label="CCRS Notes">
                  <Input value={form.ccrs_notes ?? ""} onChange={(e) => set("ccrs_notes", e.target.value)} />
                </Field>
              </Section>

              {/* Environmental targets */}
              <Section title="Environmental Targets">
                <p className="text-[11px] text-muted-foreground/70 -mt-1">
                  Blank fields use your org-wide defaults. Override any range to customize for this area.
                </p>
                <RangeRow
                  icon={Thermometer} color="text-red-500" label="Temperature (°F)"
                  min={form.target_temp_min_f} max={form.target_temp_max_f}
                  setMin={(v) => set("target_temp_min_f", v)} setMax={(v) => set("target_temp_max_f", v)}
                  placeholder={defaultRanges.temp ? [defaultRanges.temp[0].toString(), defaultRanges.temp[1].toString()] : ["65", "85"]}
                  error={errors.target_temp_max_f}
                />
                <RangeRow
                  icon={Droplets} color="text-blue-500" label="Humidity (%)"
                  min={form.target_humidity_min_pct} max={form.target_humidity_max_pct}
                  setMin={(v) => set("target_humidity_min_pct", v)} setMax={(v) => set("target_humidity_max_pct", v)}
                  placeholder={defaultRanges.humidity ? [defaultRanges.humidity[0].toString(), defaultRanges.humidity[1].toString()] : ["40", "70"]}
                />
                <RangeRow
                  icon={Wind} color="text-teal-500" label="VPD (kPa)"
                  min={form.target_vpd_min} max={form.target_vpd_max}
                  setMin={(v) => set("target_vpd_min", v)} setMax={(v) => set("target_vpd_max", v)}
                  step="0.1"
                  placeholder={defaultRanges.vpd ? [defaultRanges.vpd[0].toString(), defaultRanges.vpd[1].toString()] : ["0.8", "1.5"]}
                />
                <RangeRow
                  icon={Gauge} color="text-emerald-500" label="CO₂ (ppm)"
                  min={form.target_co2_min_ppm} max={form.target_co2_max_ppm}
                  setMin={(v) => set("target_co2_min_ppm", v)} setMax={(v) => set("target_co2_max_ppm", v)}
                  placeholder={defaultRanges.co2 ? [defaultRanges.co2[0].toString(), defaultRanges.co2[1].toString()] : ["400", "1500"]}
                />
              </Section>

              {/* Sensors */}
              <Section title="Assigned Sensors">
                {sensors.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground italic">
                    No environmental sensors yet. Add them in Settings → Equipment.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {availableSensors.map((s) => {
                      const selected = selectedSensorIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSensor(s.id)}
                          className={cn(
                            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-medium transition-colors",
                            selected ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {sensorLabel(s)}
                          {s.connection_type && <span className="text-[10px] font-mono opacity-60">· {s.connection_type}</span>}
                        </button>
                      );
                    })}
                    {availableSensors.length === 0 && (
                      <p className="text-[12px] text-muted-foreground italic">All sensors are assigned to other areas. Reassign from their current areas first.</p>
                    )}
                  </div>
                )}
              </Section>

              {/* Other */}
              <Section title="Other">
                <Field label="Description">
                  <textarea
                    value={form.notes ?? ""}
                    onChange={(e) => set("notes", e.target.value)}
                    rows={3}
                    placeholder="Room layout notes, access instructions…"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Sort Order">
                    <Input type="number" value={form.sort_order ?? 0} onChange={(e) => set("sort_order", e.target.value ? Number(e.target.value) : 0)} className="font-mono w-32" />
                  </Field>
                  <label className="flex items-center gap-2 cursor-pointer select-none h-10 mt-auto">
                    <input
                      type="checkbox"
                      checked={form.is_active ?? true}
                      onChange={(e) => set("is_active", e.target.checked)}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-[13px] text-foreground">Active</span>
                  </label>
                </div>
              </Section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ScrollableModal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, error, helper, children }: { label: string; required?: boolean; error?: string; helper?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {!error && helper && <p className="text-[11px] text-muted-foreground/70">{helper}</p>}
    </div>
  );
}

function RangeRow({
  icon: Icon, color, label, min, max, setMin, setMax, placeholder, step = "1", error,
}: {
  icon: React.ComponentType<{ className?: string }>;
  color: string; label: string;
  min: number | null | undefined; max: number | null | undefined;
  setMin: (v: number | null) => void; setMax: (v: number | null) => void;
  placeholder: [string, string];
  step?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        {label}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number" step={step}
          value={min ?? ""}
          onChange={(e) => setMin(e.target.value ? Number(e.target.value) : null)}
          className="font-mono"
          placeholder={`min ${placeholder[0]}`}
        />
        <Input
          type="number" step={step}
          value={max ?? ""}
          onChange={(e) => setMax(e.target.value ? Number(e.target.value) : null)}
          className="font-mono"
          placeholder={`max ${placeholder[1]}`}
        />
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
