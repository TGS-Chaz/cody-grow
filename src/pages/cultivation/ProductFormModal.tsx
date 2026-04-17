import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, ChevronUp, Loader2, Package, Info, Leaf, Baby, ShieldCheck,
  FlaskConical, Plus, X as XIcon,
} from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import {
  CCRS_INVENTORY_CATEGORIES, CCRS_INVENTORY_CATEGORY_LABELS, CCRS_INVENTORY_CATEGORY_COLORS,
  CCRS_CATEGORY_TYPE_MAP, CCRS_INVENTORY_EDIBLE_TYPES, CCRS_INVENTORY_TYPE_WARNING_TEXT,
  CcrsInventoryCategory, CcrsInventoryType,
  UNITS_OF_MEASURE, UNIT_OF_MEASURE_LABELS, UnitOfMeasure,
  WEIGHT_DISPLAY_FORMATS, WEIGHT_DISPLAY_FORMAT_LABELS, WeightDisplayFormat,
} from "@/lib/schema-enums";
import { Product, ProductInput, suggestSku } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (input: ProductInput) => Promise<Product>;
  editing?: Product | null;
}

interface ProductLineOption { id: string; name: string }
interface StrainOption { id: string; name: string; type: string | null }

/** Default compliance flags for a given CCRS category. These populate when
 * the user first picks a category; they can still override. */
function complianceDefaultsForCategory(c: CcrsInventoryCategory) {
  if (c === "PropagationMaterial") {
    return { requires_lab_testing: false, requires_child_resistant_packaging: false };
  }
  return { requires_lab_testing: true, requires_child_resistant_packaging: true };
}

export default function ProductFormModal({ open, onClose, onSave, editing }: Props) {
  const isEdit = !!editing;
  const { orgId } = useOrg();

  const [form, setForm] = useState<ProductInput>({
    name: "",
    ccrs_inventory_category: "HarvestedMaterial",
    ccrs_inventory_type: "Flower Lot",
    is_taxable: true,
    is_medical: false,
    is_doh_compliant: false,
    is_trade_sample: false,
    is_employee_sample: false,
    requires_lab_testing: true,
    requires_child_resistant_packaging: true,
    is_active: true,
    tags: [],
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const [productLines, setProductLines] = useState<ProductLineOption[]>([]);
  const [strains, setStrains] = useState<StrainOption[]>([]);
  const [existingSkus, setExistingSkus] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");

  useEffect(() => {
    if (!open || !orgId) return;
    (async () => {
      const [lineRes, strainRes, skuRes] = await Promise.all([
        supabase.from("grow_product_lines").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
        supabase.from("grow_strains").select("id, name, type").eq("org_id", orgId).eq("is_active", true).order("name"),
        supabase.from("grow_products").select("sku").eq("org_id", orgId),
      ]);
      setProductLines((lineRes.data ?? []) as ProductLineOption[]);
      setStrains((strainRes.data ?? []) as StrainOption[]);
      setExistingSkus(((skuRes.data ?? []) as any[]).map((r) => r.sku).filter(Boolean));
    })();
  }, [open, orgId]);

  // Hydrate form on open
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setCustomTag("");
    if (editing) {
      setForm({
        name: editing.name,
        ccrs_inventory_category: editing.ccrs_inventory_category ?? "HarvestedMaterial",
        ccrs_inventory_type: editing.ccrs_inventory_type ?? "Flower Lot",
        product_line_id: editing.product_line_id,
        strain_id: editing.strain_id,
        sku: editing.sku,
        upc: editing.upc,
        description: editing.description,
        image_url: editing.image_url,
        unit_price: editing.unit_price,
        cost_per_unit: editing.cost_per_unit,
        unit_of_measure: editing.unit_of_measure,
        default_package_size: editing.default_package_size,
        unit_weight_grams: editing.unit_weight_grams,
        package_size: editing.package_size,
        servings_per_unit: editing.servings_per_unit,
        is_taxable: editing.is_taxable ?? true,
        tax_rate_override: editing.tax_rate_override,
        is_medical: editing.is_medical ?? false,
        is_doh_compliant: editing.is_doh_compliant ?? false,
        is_trade_sample: editing.is_trade_sample ?? false,
        is_employee_sample: editing.is_employee_sample ?? false,
        requires_lab_testing: editing.requires_lab_testing ?? true,
        requires_child_resistant_packaging: editing.requires_child_resistant_packaging ?? true,
        warning_text: editing.warning_text,
        weight_display_format: editing.weight_display_format,
        custom_label_notes: editing.custom_label_notes,
        tags: editing.tags ?? [],
        sort_order: editing.sort_order,
        is_active: editing.is_active ?? true,
      });
      setShowAdvanced(true);
    } else {
      setForm({
        name: "",
        ccrs_inventory_category: "HarvestedMaterial",
        ccrs_inventory_type: "Flower Lot",
        is_taxable: true,
        is_medical: false,
        is_doh_compliant: false,
        is_trade_sample: false,
        is_employee_sample: false,
        requires_lab_testing: true,
        requires_child_resistant_packaging: true,
        is_active: true,
        tags: [],
      });
      setShowAdvanced(false);
    }
  }, [open, editing]);

  const validTypes = useMemo(() =>
    form.ccrs_inventory_category ? CCRS_CATEGORY_TYPE_MAP[form.ccrs_inventory_category] : [],
  [form.ccrs_inventory_category]);

  // If the selected type isn't valid for the current category, snap to the first valid one.
  useEffect(() => {
    if (!form.ccrs_inventory_type || !form.ccrs_inventory_category) return;
    if (!validTypes.includes(form.ccrs_inventory_type)) {
      setForm((f) => ({ ...f, ccrs_inventory_type: validTypes[0] as CcrsInventoryType }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ccrs_inventory_category, validTypes.join(",")]);

  // Auto-suggest SKU for new products when category changes and SKU is blank.
  useEffect(() => {
    if (isEdit || !open) return;
    if (form.sku) return;
    if (!form.ccrs_inventory_category) return;
    setForm((f) => ({ ...f, sku: suggestSku(f.ccrs_inventory_category!, existingSkus) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ccrs_inventory_category, existingSkus.length, open]);

  const set = <K extends keyof ProductInput>(field: K, value: ProductInput[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  /** User just picked a category. Reset type + auto-apply sensible compliance defaults. */
  const handleCategoryChange = (c: CcrsInventoryCategory) => {
    const firstType = CCRS_CATEGORY_TYPE_MAP[c][0] as CcrsInventoryType;
    const compliance = complianceDefaultsForCategory(c);
    setForm((f) => ({
      ...f,
      ccrs_inventory_category: c,
      ccrs_inventory_type: firstType,
      ...compliance,
    }));
  };

  /** User picked a type. Populate warning_text from WAC 314-55-105 template
   * if the user hasn't already customized it. */
  const handleTypeChange = (t: CcrsInventoryType) => {
    setForm((f) => {
      const existingWarning = f.warning_text?.trim();
      const prevType = f.ccrs_inventory_type;
      const prevTemplate = prevType ? CCRS_INVENTORY_TYPE_WARNING_TEXT[prevType] : undefined;
      // Only overwrite the warning text if the user hasn't customized it
      // (i.e. it's empty or still equals the previous type's template).
      const shouldReplace = !existingWarning || existingWarning === prevTemplate;
      return {
        ...f,
        ccrs_inventory_type: t,
        warning_text: shouldReplace ? (CCRS_INVENTORY_TYPE_WARNING_TEXT[t] ?? null) : f.warning_text,
      };
    });
  };

  const isEdible = form.ccrs_inventory_type && CCRS_INVENTORY_EDIBLE_TYPES.includes(form.ccrs_inventory_type);

  const addTag = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return;
    const current = form.tags ?? [];
    if (!current.includes(trimmed)) set("tags", [...current, trimmed]);
    setCustomTag("");
  };
  const removeTag = (v: string) => set("tags", (form.tags ?? []).filter((t) => t !== v));

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Name is required";
    else if (form.name.length > 75) next.name = "CCRS spec limits name to 75 characters";
    if (!form.ccrs_inventory_category) next.ccrs_inventory_category = "Category is required";
    if (!form.ccrs_inventory_type) next.ccrs_inventory_type = "Type is required";
    else if (!validTypes.includes(form.ccrs_inventory_type)) next.ccrs_inventory_type = "Type isn't valid for this category";
    if (form.description && form.description.length > 250) next.description = "CCRS spec limits description to 250 characters";
    if (form.unit_price != null && form.unit_price < 0) next.unit_price = "Must be ≥ 0";
    if (form.cost_per_unit != null && form.cost_per_unit < 0) next.cost_per_unit = "Must be ≥ 0";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({ ...form, name: form.name.trim() });
      toast.success(isEdit ? "Product updated" : "Product created");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const categoryColor = form.ccrs_inventory_category ? CCRS_INVENTORY_CATEGORY_COLORS[form.ccrs_inventory_category] : null;

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="md"
      onSubmit={handleSubmit}
      header={
        <ModalHeader
          icon={<Package className="w-4 h-4 text-primary" />}
          title={isEdit ? "Edit product" : "New product"}
          subtitle="CCRS-aligned catalog entry — category drives type & compliance"
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
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Blue Dream Flower Lot" autoFocus maxLength={75} />
        </Field>

        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
            CCRS Inventory Category <span className="text-destructive">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CCRS_INVENTORY_CATEGORIES.map((c) => {
              const color = CCRS_INVENTORY_CATEGORY_COLORS[c];
              const selected = form.ccrs_inventory_category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleCategoryChange(c)}
                  className={cn(
                    "inline-flex items-center h-8 px-3 rounded-full border text-[12px] font-medium transition-all",
                    selected ? `${color.bg} ${color.text} border-transparent ring-2 ring-offset-1 ring-offset-background` : "bg-muted/30 border-border text-muted-foreground hover:text-foreground",
                  )}
                  style={selected ? { boxShadow: `0 0 0 2px ${color.hex}40` } : undefined}
                >
                  {CCRS_INVENTORY_CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="CCRS Inventory Type" required error={errors.ccrs_inventory_type} helper="Options are filtered by the category above">
          <select
            value={form.ccrs_inventory_type ?? ""}
            onChange={(e) => handleTypeChange(e.target.value as CcrsInventoryType)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {validTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        {/* Compliance summary badges */}
        {form.ccrs_inventory_category && form.ccrs_inventory_type && (
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
              <Info className="w-3 h-3" /> Compliance rules for this selection
            </div>
            <div className="flex flex-wrap gap-1.5">
              <ComplianceBadge
                icon={FlaskConical} label="Lab testing"
                active={!!form.requires_lab_testing}
                color="emerald"
              />
              <ComplianceBadge
                icon={Baby} label="Child-resistant pkg"
                active={!!form.requires_child_resistant_packaging}
                color="amber"
              />
              <ComplianceBadge
                icon={ShieldCheck} label="Universal cannabis symbol"
                active={form.ccrs_inventory_category !== "PropagationMaterial"}
                color="purple"
                note="retail"
              />
              {isEdible && (
                <ComplianceBadge
                  icon={Leaf} label="Not For Kids symbol"
                  active color="red"
                  note="edibles"
                />
              )}
            </div>
            {categoryColor && (
              <p className={cn("text-[11px] leading-relaxed", categoryColor.text)}>
                Auto-applied per <span className="font-medium">{CCRS_INVENTORY_CATEGORY_LABELS[form.ccrs_inventory_category]}</span>. Override any rule in "Show all fields" below.
              </p>
            )}
          </div>
        )}

        <Field label="Product Line">
          <select
            value={form.product_line_id ?? ""}
            onChange={(e) => set("product_line_id", e.target.value || null)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— None —</option>
            {productLines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>

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
              {/* Identity */}
              <Section title="Identity">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="SKU" helper={isEdit ? undefined : `Auto-suggested from ${form.ccrs_inventory_category} prefix`}>
                    <Input value={form.sku ?? ""} onChange={(e) => set("sku", e.target.value)} className="font-mono" />
                  </Field>
                  <Field label="UPC / Barcode">
                    <Input value={form.upc ?? ""} onChange={(e) => set("upc", e.target.value)} className="font-mono" />
                  </Field>
                </div>
                <Field label="Description" error={errors.description} helper={form.description && form.description.length > 200 ? `${form.description.length}/250 chars` : undefined}>
                  <textarea
                    value={form.description ?? ""}
                    onChange={(e) => set("description", e.target.value)}
                    rows={3}
                    maxLength={250}
                    placeholder="Maps to CCRS Product.Description — max 250 chars"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </Field>
                <Field label="Strain" helper={form.ccrs_inventory_category === "EndProduct" ? "Optional for end products" : "Link to your genetics library"}>
                  <select
                    value={form.strain_id ?? ""}
                    onChange={(e) => set("strain_id", e.target.value || null)}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— None —</option>
                    {strains.map((s) => <option key={s.id} value={s.id}>{s.name}{s.type ? ` (${s.type})` : ""}</option>)}
                  </select>
                </Field>
                <Field label="Product image URL" helper="Shown on marketplace and public menu. Paste a CDN/storage URL.">
                  <Input value={form.image_url ?? ""} onChange={(e) => set("image_url", e.target.value || null)} placeholder="https://…" className="font-mono" />
                  {form.image_url && (
                    <img src={form.image_url} alt="" className="mt-2 w-24 h-24 rounded-lg object-cover border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                </Field>
              </Section>

              {/* Pricing */}
              <Section title="Pricing">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Default Unit Price" error={errors.unit_price}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">$</span>
                      <Input
                        type="number" step="0.01" min="0"
                        value={form.unit_price ?? ""}
                        onChange={(e) => set("unit_price", e.target.value ? Number(e.target.value) : null)}
                        className="font-mono pl-6"
                        placeholder="0.00"
                      />
                    </div>
                  </Field>
                  <Field label="Cost per Unit" error={errors.cost_per_unit} helper="For COGS calculations">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">$</span>
                      <Input
                        type="number" step="0.01" min="0"
                        value={form.cost_per_unit ?? ""}
                        onChange={(e) => set("cost_per_unit", e.target.value ? Number(e.target.value) : null)}
                        className="font-mono pl-6"
                        placeholder="0.00"
                      />
                    </div>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Unit of Measure">
                    <select
                      value={form.unit_of_measure ?? ""}
                      onChange={(e) => set("unit_of_measure", (e.target.value || null) as UnitOfMeasure | null)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">—</option>
                      {UNITS_OF_MEASURE.map((u) => <option key={u} value={u}>{UNIT_OF_MEASURE_LABELS[u]}</option>)}
                    </select>
                  </Field>
                  <Field label="Default Package Size" helper="3.5 for eighth, 1.0 for gram">
                    <Input
                      type="number" step="0.01" min="0"
                      value={form.default_package_size ?? ""}
                      onChange={(e) => set("default_package_size", e.target.value ? Number(e.target.value) : null)}
                      className="font-mono"
                      placeholder="3.5"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <label className="flex items-center gap-2 cursor-pointer select-none h-10">
                    <input
                      type="checkbox"
                      checked={!!form.is_taxable}
                      onChange={(e) => set("is_taxable", e.target.checked)}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-[13px] text-foreground">Taxable</span>
                  </label>
                  <Field label="Tax Rate Override %" helper="Leave blank for standard rate">
                    <Input
                      type="number" step="0.01" min="0" max="100"
                      value={form.tax_rate_override ?? ""}
                      onChange={(e) => set("tax_rate_override", e.target.value ? Number(e.target.value) : null)}
                      className="font-mono"
                      placeholder=""
                    />
                  </Field>
                </div>
              </Section>

              {/* Compliance flags */}
              <Section title="Compliance">
                <div className="grid grid-cols-2 gap-2">
                  <Checkbox label="Is Medical" checked={!!form.is_medical} onChange={(v) => set("is_medical", v)} />
                  <Checkbox label="DOH Compliant" checked={!!form.is_doh_compliant} onChange={(v) => set("is_doh_compliant", v)} />
                  <Checkbox label="Trade Sample" checked={!!form.is_trade_sample} onChange={(v) => set("is_trade_sample", v)} />
                  <Checkbox label="Employee Sample" checked={!!form.is_employee_sample} onChange={(v) => set("is_employee_sample", v)} />
                  <Checkbox label="Requires Lab Testing" checked={!!form.requires_lab_testing} onChange={(v) => set("requires_lab_testing", v)} />
                  <Checkbox label="Child-Resistant Pkg" checked={!!form.requires_child_resistant_packaging} onChange={(v) => set("requires_child_resistant_packaging", v)} />
                </div>
              </Section>

              {/* Labeling */}
              <Section title="Labeling">
                <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-[11px] text-foreground">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
                  <div>
                    Warning text + symbols below auto-fill per WAC 314-55-105 based on your category
                    and type. Override in the fields below if your compliance counsel directs you to.
                  </div>
                </div>
                <Field label="Warning Text" helper="Auto-filled from CCRS type template — edit if needed">
                  <textarea
                    value={form.warning_text ?? ""}
                    onChange={(e) => set("warning_text", e.target.value)}
                    rows={3}
                    placeholder="Populated from the selected CCRS InventoryType"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[11px] shadow-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Weight Display Format">
                    <select
                      value={form.weight_display_format ?? ""}
                      onChange={(e) => set("weight_display_format", (e.target.value || null) as WeightDisplayFormat | null)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">—</option>
                      {WEIGHT_DISPLAY_FORMATS.map((f) => <option key={f} value={f}>{WEIGHT_DISPLAY_FORMAT_LABELS[f]}</option>)}
                    </select>
                  </Field>
                  <Field label="Unit Weight (grams)" helper="For edibles/concentrates — used on labels">
                    <Input
                      type="number" step="0.01" min="0"
                      value={form.unit_weight_grams ?? ""}
                      onChange={(e) => set("unit_weight_grams", e.target.value ? Number(e.target.value) : null)}
                      className="font-mono"
                    />
                  </Field>
                </div>
                <Field label="Custom Label Notes">
                  <Input value={form.custom_label_notes ?? ""} onChange={(e) => set("custom_label_notes", e.target.value)} />
                </Field>
              </Section>

              {/* Other */}
              <Section title="Other">
                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {(form.tags ?? []).map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-primary/15 text-primary text-[11px] font-medium">
                        {t}
                        <button type="button" onClick={() => removeTag(t)} className="p-0.5 rounded hover:bg-primary/20">
                          <XIcon className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(customTag); } }}
                      placeholder="Add tag…"
                      className="h-8 text-[12px]"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => addTag(customTag)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <Field label="Sort Order">
                    <Input
                      type="number"
                      value={form.sort_order ?? 0}
                      onChange={(e) => set("sort_order", e.target.value ? Number(e.target.value) : 0)}
                      className="font-mono w-32"
                    />
                  </Field>
                  <label className="flex items-center gap-2 cursor-pointer select-none h-10">
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-border accent-primary"
      />
      <span className="text-[12px] text-foreground">{label}</span>
    </label>
  );
}

function ComplianceBadge({
  icon: Icon, label, active, color, note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  color: "emerald" | "amber" | "purple" | "red" | "blue";
  note?: string;
}) {
  const palette: Record<string, { on: string; off: string }> = {
    emerald: { on: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", off: "bg-muted/30 text-muted-foreground border-border" },
    amber:   { on: "bg-amber-500/15 text-amber-500 border-amber-500/30",       off: "bg-muted/30 text-muted-foreground border-border" },
    purple:  { on: "bg-purple-500/15 text-purple-500 border-purple-500/30",    off: "bg-muted/30 text-muted-foreground border-border" },
    red:     { on: "bg-red-500/15 text-red-500 border-red-500/30",             off: "bg-muted/30 text-muted-foreground border-border" },
    blue:    { on: "bg-blue-500/15 text-blue-500 border-blue-500/30",          off: "bg-muted/30 text-muted-foreground border-border" },
  };
  const p = palette[color];
  return (
    <span className={cn("inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[10px] font-semibold uppercase tracking-wider", active ? p.on : p.off)}>
      <Icon className="w-3 h-3" />
      {label}
      {active && note && <span className="opacity-70 normal-case">· {note}</span>}
    </span>
  );
}
