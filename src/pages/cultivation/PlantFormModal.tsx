import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2, Leaf, GitFork, Info } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import { useProfile } from "@/lib/profile";
import {
  CCRS_GROWTH_STAGES, CcrsGrowthStage,
  CCRS_PLANT_STATES, CcrsPlantState,
  PLANT_SOURCE_TYPES, PlantSourceType,
  HARVEST_CYCLE_MONTHS,
} from "@/lib/schema-enums";
import { Plant, PlantInput } from "@/hooks/usePlants";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: PlantInput) => Promise<Plant>;
  editing?: Plant | null;
}

interface StrainOption { id: string; name: string; type: string | null }
interface AreaOption { id: string; name: string }
interface CycleOption { id: string; name: string | null; phase: string | null; strain_id: string | null }
interface SourceOption { id: string; external_id: string; source_type: string; strain_id: string | null }
interface PhenoOption { id: string; pheno_number: string; pheno_name: string | null; strain_id: string | null }
interface MotherOption { id: string; plant_identifier: string | null; strain_id: string | null }

export default function PlantFormModal({ open, onClose, onSave, editing }: Props) {
  const isEdit = !!editing;
  const { orgId } = useOrg();
  const { profile } = useProfile();

  const [form, setForm] = useState<PlantInput>({
    strain_id: "",
    area_id: "",
    ccrs_growth_stage: "Vegetative",
    source_type: "seed",
    ccrs_plant_state: "Growing",
    is_mother_plant: false,
  });
  const [plantIdentifier, setPlantIdentifier] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const [strains, setStrains] = useState<StrainOption[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [cycles, setCycles] = useState<CycleOption[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [phenos, setPhenos] = useState<PhenoOption[]>([]);
  const [mothers, setMothers] = useState<MotherOption[]>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    (async () => {
      const [sRes, aRes, cRes, srcRes, pRes, mRes] = await Promise.all([
        supabase.from("grow_strains").select("id, name, type").eq("org_id", orgId).eq("is_active", true).order("name"),
        supabase.from("grow_areas").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
        supabase.from("grow_cycles").select("id, name, phase, strain_id").eq("org_id", orgId).not("phase", "in", "(completed,cancelled)").order("start_date", { ascending: false }),
        supabase.from("grow_sources").select("id, external_id, source_type, strain_id").eq("org_id", orgId).eq("status", "available"),
        supabase.from("grow_phenotypes").select("id, pheno_number, pheno_name, strain_id").eq("org_id", orgId).eq("is_retired", false),
        supabase.from("grow_plants").select("id, plant_identifier, strain_id").eq("org_id", orgId).eq("is_mother_plant", true),
      ]);
      setStrains((sRes.data ?? []) as StrainOption[]);
      setAreas((aRes.data ?? []) as AreaOption[]);
      setCycles((cRes.data ?? []) as CycleOption[]);
      setSources((srcRes.data ?? []) as SourceOption[]);
      setPhenos((pRes.data ?? []) as PhenoOption[]);
      setMothers((mRes.data ?? []) as MotherOption[]);
    })();
  }, [open, orgId]);

  // Hydrate form on open
  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editing) {
      setPlantIdentifier(editing.plant_identifier ?? "");
      setForm({
        plant_identifier: editing.plant_identifier,
        strain_id: editing.strain_id ?? "",
        area_id: editing.area_id ?? "",
        ccrs_growth_stage: (editing.ccrs_growth_stage ?? "Vegetative") as CcrsGrowthStage,
        source_type: (editing.source_type ?? "seed") as PlantSourceType,
        ccrs_plant_state: (editing.ccrs_plant_state ?? "Growing") as CcrsPlantState,
        grow_cycle_id: editing.grow_cycle_id,
        mother_plant_id: editing.mother_plant_id,
        source_id: editing.source_id,
        phenotype_id: editing.phenotype_id,
        harvest_cycle_months: editing.harvest_cycle_months,
        harvest_date: editing.harvest_date,
        is_mother_plant: editing.is_mother_plant ?? false,
        notes: editing.notes,
        ccrs_created_by_username: editing.ccrs_created_by_username,
      });
      setShowAdvanced(true);
    } else {
      setPlantIdentifier("");
      setForm({
        strain_id: "",
        area_id: areas[0]?.id ?? "",
        ccrs_growth_stage: "Vegetative",
        source_type: "seed",
        ccrs_plant_state: "Growing",
        is_mother_plant: false,
        ccrs_created_by_username: profile?.full_name ?? null,
      });
      setShowAdvanced(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, profile?.full_name]);

  const set = <K extends keyof PlantInput>(field: K, value: PlantInput[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const filteredMothers = useMemo(
    () => mothers.filter((m) => !form.strain_id || m.strain_id === form.strain_id),
    [mothers, form.strain_id],
  );
  const filteredPhenos = useMemo(
    () => phenos.filter((p) => !form.strain_id || p.strain_id === form.strain_id),
    [phenos, form.strain_id],
  );
  const filteredSources = useMemo(
    () => sources.filter((s) => !form.strain_id || s.strain_id === form.strain_id),
    [sources, form.strain_id],
  );
  const filteredCycles = useMemo(
    () => cycles.filter((c) => !form.strain_id || c.strain_id === form.strain_id),
    [cycles, form.strain_id],
  );

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.strain_id) next.strain_id = "Strain is required";
    if (!form.area_id) next.area_id = "Area is required";
    if (!form.ccrs_growth_stage) next.ccrs_growth_stage = "Growth stage is required";
    if (!form.source_type) next.source_type = "Source type is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({ ...form, plant_identifier: plantIdentifier.trim() || null });
      toast.success(isEdit ? "Plant updated" : "Plant added");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="md"
      onSubmit={handleSubmit}
      header={
        <ModalHeader
          icon={<Leaf className="w-4 h-4 text-emerald-500" />}
          title={isEdit ? "Edit plant" : "New plant"}
          subtitle="Individual plant record for CCRS tracking"
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
        <Field label="Plant Identifier" helper={isEdit ? undefined : "Leave blank to auto-generate (e.g. BDR-0001)"}>
          <Input
            value={plantIdentifier}
            onChange={(e) => setPlantIdentifier(e.target.value)}
            className="font-mono"
            placeholder="Auto"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Strain" required error={errors.strain_id}>
            {strains.length === 0 ? (
              <div className="h-10 px-3 flex items-center text-[12px] text-muted-foreground border border-dashed border-border rounded-lg">
                Add a strain first
              </div>
            ) : (
              <select
                value={form.strain_id}
                onChange={(e) => {
                  set("strain_id", e.target.value);
                  // Clear strain-dependent pickers
                  set("mother_plant_id", null);
                  set("phenotype_id", null);
                  set("source_id", null);
                  set("grow_cycle_id", null);
                }}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Select —</option>
                {strains.map((s) => <option key={s.id} value={s.id}>{s.name}{s.type ? ` (${s.type})` : ""}</option>)}
              </select>
            )}
          </Field>
          <Field label="Area" required error={errors.area_id}>
            {areas.length === 0 ? (
              <div className="h-10 px-3 flex items-center text-[12px] text-muted-foreground border border-dashed border-border rounded-lg">
                Add an area first
              </div>
            ) : (
              <select
                value={form.area_id}
                onChange={(e) => set("area_id", e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Select —</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Growth Stage" required>
            <select
              value={form.ccrs_growth_stage}
              onChange={(e) => set("ccrs_growth_stage", e.target.value as CcrsGrowthStage)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CCRS_GROWTH_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Source" required>
            <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 w-full">
              {PLANT_SOURCE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("source_type", t)}
                  className={cn(
                    "flex-1 h-8 text-[12px] font-medium rounded-md capitalize transition-colors",
                    form.source_type === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.replace("_", " ")}
                </button>
              ))}
            </div>
          </Field>
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
              <Section title="Growth">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Plant State">
                    <select
                      value={form.ccrs_plant_state ?? "Growing"}
                      onChange={(e) => set("ccrs_plant_state", e.target.value as CcrsPlantState)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {CCRS_PLANT_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Harvest Cycle Months">
                    <select
                      value={form.harvest_cycle_months ?? ""}
                      onChange={(e) => set("harvest_cycle_months", e.target.value ? (Number(e.target.value) as any) : null)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">—</option>
                      {HARVEST_CYCLE_MONTHS.map((m) => <option key={m} value={m}>{m} months</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Phenotype" helper={filteredPhenos.length === 0 ? "No phenotypes tracked for this strain" : undefined}>
                  <select
                    value={form.phenotype_id ?? ""}
                    onChange={(e) => set("phenotype_id", e.target.value || null)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={filteredPhenos.length === 0}
                  >
                    <option value="">— None —</option>
                    {filteredPhenos.map((p) => <option key={p.id} value={p.id}>{p.pheno_number}{p.pheno_name ? ` — ${p.pheno_name}` : ""}</option>)}
                  </select>
                </Field>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!form.is_mother_plant}
                    onChange={(e) => set("is_mother_plant", e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <GitFork className={cn("w-3.5 h-3.5", form.is_mother_plant ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-[13px] text-foreground">Designate as mother plant</span>
                </label>
              </Section>

              <Section title="Lineage">
                <Field label="Mother Plant" helper={filteredMothers.length === 0 ? "No mother plants for this strain" : undefined}>
                  <select
                    value={form.mother_plant_id ?? ""}
                    onChange={(e) => set("mother_plant_id", e.target.value || null)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={filteredMothers.length === 0}
                  >
                    <option value="">— None —</option>
                    {filteredMothers.map((m) => <option key={m.id} value={m.id}>{m.plant_identifier ?? m.id.slice(0, 8)}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Grow Source">
                    <select
                      value={form.source_id ?? ""}
                      onChange={(e) => set("source_id", e.target.value || null)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      disabled={filteredSources.length === 0}
                    >
                      <option value="">— None —</option>
                      {filteredSources.map((s) => <option key={s.id} value={s.id}>{s.source_type} · {s.external_id.slice(-6)}</option>)}
                    </select>
                  </Field>
                  <Field label="Grow Cycle">
                    <select
                      value={form.grow_cycle_id ?? ""}
                      onChange={(e) => set("grow_cycle_id", e.target.value || null)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      disabled={filteredCycles.length === 0}
                    >
                      <option value="">— None —</option>
                      {filteredCycles.map((c) => <option key={c.id} value={c.id}>{c.name ?? c.id.slice(0, 8)}{c.phase ? ` · ${c.phase}` : ""}</option>)}
                    </select>
                  </Field>
                </div>
              </Section>

              <Section title="CCRS">
                <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-[11px] text-foreground">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
                  <div>External ID auto-generates on save. CCRS username defaults to your profile name.</div>
                </div>
                <Field label="CCRS Created By Username">
                  <Input
                    value={form.ccrs_created_by_username ?? ""}
                    onChange={(e) => set("ccrs_created_by_username", e.target.value)}
                    placeholder="Auto-filled from profile"
                  />
                </Field>
                {form.ccrs_plant_state === "Harvested" && (
                  <Field label="Harvest Date">
                    <Input
                      type="date"
                      value={form.harvest_date ?? ""}
                      onChange={(e) => set("harvest_date", e.target.value || null)}
                    />
                  </Field>
                )}
              </Section>

              <Section title="Other">
                <Field label="Notes">
                  <textarea
                    value={form.notes ?? ""}
                    onChange={(e) => set("notes", e.target.value)}
                    rows={3}
                    placeholder="Observations, conditions, anything worth remembering…"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </Field>
              </Section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ScrollableModal>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
