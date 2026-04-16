import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Factory, Loader2, FileStack, Play, CheckCircle2, Plus, X, ChevronDown, ChevronUp, Info, Package,
} from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import {
  useCreateBOM, useCreateProductionRun, useFinalizeProductionRun,
  BOM, ProductionRun, ProductionInput,
} from "@/hooks/useProduction";
import {
  CCRS_INVENTORY_CATEGORIES, CCRS_INVENTORY_CATEGORY_LABELS, CcrsInventoryCategory,
  CCRS_INVENTORY_TYPES,
} from "@/lib/schema-enums";
import { cn } from "@/lib/utils";

interface ProductOption { id: string; name: string; category: string; ccrs_inventory_category: CcrsInventoryCategory | null }
interface BatchOption { id: string; barcode: string; product_id: string | null; ccrs_category: CcrsInventoryCategory | null; product_name: string | null; current_quantity: number; current_weight_grams: number | null }
interface BOMOption { id: string; name: string; output_product_id: string | null; inputs: Array<{ id: string; input_category: string; notes: string | null }> }
interface AreaOption { id: string; name: string }

// ─── Create BOM ─────────────────────────────────────────────────────────────

export function CreateBOMModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess?: (bom: BOM) => void;
}) {
  const { orgId } = useOrg();
  const createBOM = useCreateBOM();
  const [name, setName] = useState("");
  const [productId, setProductId] = useState("");
  const [inputs, setInputs] = useState<Array<{ input_category: string; notes: string }>>([{ input_category: `${CCRS_INVENTORY_CATEGORIES[1]}:Flower Lot`, notes: "" }]);
  const [byproductCategory, setByproductCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    setName(""); setProductId("");
    setInputs([{ input_category: `${CCRS_INVENTORY_CATEGORIES[1]}:Flower Lot`, notes: "" }]);
    setByproductCategory(""); setNotes(""); setIsActive(true);
    (async () => {
      const { data } = await supabase.from("grow_products").select("id, name, category, ccrs_inventory_category").eq("org_id", orgId).eq("is_active", true).order("name");
      setProducts((data ?? []) as any);
    })();
  }, [open, orgId]);

  const selectedProduct = useMemo(() => products.find((p) => p.id === productId), [products, productId]);

  const addInput = () => setInputs((xs) => [...xs, { input_category: `${CCRS_INVENTORY_CATEGORIES[1]}:Flower Lot`, notes: "" }]);
  const removeInput = (i: number) => setInputs((xs) => xs.filter((_, idx) => idx !== i));
  const updateInput = (i: number, patch: Partial<{ input_category: string; notes: string }>) => {
    setInputs((xs) => xs.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  };

  const valid = name.trim().length > 0 && productId && inputs.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { toast.error("Name, output product, and at least one input required"); return; }
    setSaving(true);
    try {
      const bom = await createBOM({
        name: name.trim(),
        output_product_id: productId,
        output_category: selectedProduct?.ccrs_inventory_category ?? null,
        byproduct_category: byproductCategory || null,
        notes: notes.trim() || null,
        is_active: isActive,
        inputs: inputs.map((x, idx) => ({
          input_category: x.input_category,
          notes: x.notes.trim() || null,
          sort_order: idx,
        })),
      });
      toast.success(`BOM "${bom.name}" created`);
      onSuccess?.(bom);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Create failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="md"
      onSubmit={handleSubmit}
      header={<ModalHeader icon={<FileStack className="w-4 h-4 text-purple-500" />} title="Create Bill of Materials" subtitle="Define how inputs transform into an output product" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileStack className="w-3.5 h-3.5" />}
            Create BOM
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pre-Roll Production" />
        </Field>
        <Field label="Output product" required>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Select product —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.ccrs_inventory_category ?? "—"}</option>)}
          </select>
          {selectedProduct?.ccrs_inventory_category && (
            <p className="text-[11px] text-muted-foreground">CCRS category: <span className="font-semibold">{CCRS_INVENTORY_CATEGORY_LABELS[selectedProduct.ccrs_inventory_category]}</span></p>
          )}
        </Field>

        <Section title="Inputs">
          <div className="space-y-2">
            {inputs.map((x, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground w-20">Input {i + 1}</span>
                  <select value={x.input_category} onChange={(e) => updateInput(i, { input_category: e.target.value })} className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-[12px]">
                    {CCRS_INVENTORY_CATEGORIES.map((cat) => (
                      <optgroup key={cat} label={CCRS_INVENTORY_CATEGORY_LABELS[cat]}>
                        {CCRS_INVENTORY_TYPES.map((t) => <option key={`${cat}:${t}`} value={`${cat}:${t}`}>{cat}: {t}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  {inputs.length > 1 && (
                    <button type="button" onClick={() => removeInput(i)} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <Input value={x.notes} onChange={(e) => updateInput(i, { notes: e.target.value })} placeholder="Notes (e.g. minimum 20% THC)" className="text-[12px]" />
              </div>
            ))}
          </div>
          <button type="button" onClick={addInput} className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80">
            <Plus className="w-3.5 h-3.5" /> Add input
          </button>
        </Section>

        <Field label="Byproduct category" helper="What waste or secondary output does this produce?">
          <select value={byproductCategory} onChange={(e) => setByproductCategory(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— None —</option>
            {CCRS_INVENTORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
          <span className="text-[12px] font-medium">Active (available for new production runs)</span>
        </label>
      </div>
    </ScrollableModal>
  );
}

// ─── Create Production Run ──────────────────────────────────────────────────

interface RunInputRow {
  input_category: string | null; // from BOM
  bom_notes: string | null;
  batches: Array<{ batch_id: string; quantity: string }>;
}

export function CreateProductionRunModal({ open, onClose, onSuccess, initialBomId }: {
  open: boolean; onClose: () => void; onSuccess?: (run: ProductionRun) => void; initialBomId?: string;
}) {
  const { orgId } = useOrg();
  const createRun = useCreateProductionRun();
  const [bomId, setBomId] = useState("");
  const [name, setName] = useState("");
  const [plannedDate, setPlannedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [productId, setProductId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [requiresQa, setRequiresQa] = useState(true);
  const [notes, setNotes] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inputRows, setInputRows] = useState<RunInputRow[]>([]);

  const [boms, setBoms] = useState<BOMOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    setBomId(initialBomId ?? "");
    setName(""); setPlannedDate(new Date().toISOString().slice(0, 10));
    setProductId(""); setAreaId(""); setRequiresQa(true); setNotes("");
    setShowAdvanced(true);
    setInputRows([]);
    (async () => {
      const [bomsRes, productsRes, areasRes, batchesRes] = await Promise.all([
        supabase.from("grow_boms").select("id, name, output_product_id").eq("org_id", orgId).eq("is_active", true).order("name"),
        supabase.from("grow_products").select("id, name, category, ccrs_inventory_category").eq("org_id", orgId).eq("is_active", true).order("name"),
        supabase.from("grow_areas").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
        supabase.from("grow_batches").select("id, barcode, product_id, current_quantity, current_weight_grams").eq("org_id", orgId).gt("current_quantity", 0).order("created_at", { ascending: false }),
      ]);
      const bomIds = ((bomsRes.data ?? []) as any[]).map((b) => b.id);
      const { data: bomInputs } = bomIds.length > 0 ? await supabase.from("grow_bom_inputs").select("id, bom_id, input_category, notes").in("bom_id", bomIds) : { data: [] };
      const inputsByBom = new Map<string, any[]>();
      (bomInputs ?? []).forEach((i: any) => {
        const arr = inputsByBom.get(i.bom_id) ?? [];
        arr.push(i);
        inputsByBom.set(i.bom_id, arr);
      });
      setBoms(((bomsRes.data ?? []) as any[]).map((b) => ({ ...b, inputs: inputsByBom.get(b.id) ?? [] })));
      setProducts((productsRes.data ?? []) as any);
      setAreas((areasRes.data ?? []) as any);
      const productById = new Map<string, any>(((productsRes.data ?? []) as any[]).map((p) => [p.id, p]));
      setBatches(((batchesRes.data ?? []) as any[]).map((b) => {
        const product = productById.get(b.product_id);
        return {
          id: b.id, barcode: b.barcode, product_id: b.product_id,
          ccrs_category: product?.ccrs_inventory_category ?? null,
          product_name: product?.name ?? null,
          current_quantity: Number(b.current_quantity ?? 0),
          current_weight_grams: b.current_weight_grams,
        };
      }));
    })();
  }, [open, orgId, initialBomId]);

  const selectedBom = useMemo(() => boms.find((b) => b.id === bomId), [boms, bomId]);

  useEffect(() => {
    if (!selectedBom) { setInputRows([]); return; }
    setProductId(selectedBom.output_product_id ?? "");
    const today = plannedDate || new Date().toISOString().slice(0, 10);
    setName(`${selectedBom.name} - ${today}`);
    setInputRows(selectedBom.inputs.map((i) => ({
      input_category: i.input_category,
      bom_notes: i.notes,
      batches: [{ batch_id: "", quantity: "" }],
    })));
  }, [selectedBom]); // eslint-disable-line react-hooks/exhaustive-deps

  const addBatchToInput = (rowIdx: number) => setInputRows((rs) => rs.map((r, i) => i === rowIdx ? { ...r, batches: [...r.batches, { batch_id: "", quantity: "" }] } : r));
  const removeBatchFromInput = (rowIdx: number, batchIdx: number) => setInputRows((rs) => rs.map((r, i) => i === rowIdx ? { ...r, batches: r.batches.filter((_, j) => j !== batchIdx) } : r));
  const updateBatch = (rowIdx: number, batchIdx: number, patch: Partial<{ batch_id: string; quantity: string }>) => setInputRows((rs) => rs.map((r, i) => i === rowIdx ? {
    ...r, batches: r.batches.map((b, j) => j === batchIdx ? { ...b, ...patch } : b),
  } : r));
  const addExtraInput = () => setInputRows((rs) => [...rs, { input_category: null, bom_notes: null, batches: [{ batch_id: "", quantity: "" }] }]);

  const batchesForCategory = (cat: string | null): BatchOption[] => {
    if (!cat) return batches;
    const [category] = cat.split(":");
    return batches.filter((b) => b.ccrs_category === category);
  };

  const allBatchInputs = inputRows.flatMap((r) => r.batches).filter((b) => b.batch_id && Number(b.quantity) > 0);
  const valid = !!productId && !!name.trim() && allBatchInputs.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { toast.error("Pick output product and at least one input batch"); return; }
    setSaving(true);
    try {
      const run = await createRun({
        bom_id: bomId || null,
        name: name.trim(),
        output_product_id: productId,
        planned_date: plannedDate || null,
        area_id: areaId || null,
        requires_new_qa: requiresQa,
        notes: notes.trim() || null,
        inputs: allBatchInputs.map((b) => ({
          batch_id: b.batch_id,
          quantity_used: Number(b.quantity),
          weight_used_grams: Number(b.quantity),
        })),
      });
      toast.success(`Production run "${run.name}" created`);
      onSuccess?.(run);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Create failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="md"
      onSubmit={handleSubmit}
      header={<ModalHeader icon={<Factory className="w-4 h-4 text-teal-500" />} title="Create production run" subtitle="Transform input batches into an output product" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Factory className="w-3.5 h-3.5" />}
            Create Run
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="BOM" helper="Optional — select to auto-fill inputs and output product">
          <select value={bomId} onChange={(e) => setBomId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Ad-hoc (no BOM) —</option>
            {boms.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Run name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pre-Roll Run - 2026-04-16" />
          </Field>
          <Field label="Planned date">
            <Input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Output product" required>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" disabled={!!selectedBom?.output_product_id}>
            <option value="">— Select product —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedBom?.output_product_id && <p className="text-[11px] text-muted-foreground">Locked from BOM</p>}
        </Field>

        <Section title="Inputs — select actual batches">
          {inputRows.length === 0 ? (
            <div className="text-[12px] text-muted-foreground italic">Select a BOM or add an ad-hoc input below.</div>
          ) : (
            <div className="space-y-3">
              {inputRows.map((row, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      {row.input_category ?? "Ad-hoc input"}
                    </div>
                    {row.bom_notes && <div className="text-[11px] text-muted-foreground italic">{row.bom_notes}</div>}
                  </div>
                  {row.batches.map((b, j) => {
                    const batch = batches.find((x) => x.id === b.batch_id);
                    const remaining = batch ? Math.max(0, Number(batch.current_quantity) - Number(b.quantity || 0)) : null;
                    return (
                      <div key={j} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <select value={b.batch_id} onChange={(e) => updateBatch(i, j, { batch_id: e.target.value })} className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-[12px]">
                            <option value="">— Select batch —</option>
                            {batchesForCategory(row.input_category).map((x) => (
                              <option key={x.id} value={x.id}>{x.barcode} · {x.product_name ?? "?"} · {Number(x.current_quantity).toFixed(0)}g</option>
                            ))}
                          </select>
                          <div className="relative w-28">
                            <Input type="number" step="0.1" min="0" max={batch?.current_quantity ?? undefined} value={b.quantity} onChange={(e) => updateBatch(i, j, { quantity: e.target.value })} className="font-mono h-9 pr-8" placeholder="0" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">g</span>
                          </div>
                          {row.batches.length > 1 && (
                            <button type="button" onClick={() => removeBatchFromInput(i, j)} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                        {batch && Number(b.quantity) > 0 && (
                          <div className="text-[11px] font-mono text-muted-foreground ml-1">
                            Using {Number(b.quantity).toFixed(1)}g from {batch.barcode} ({remaining?.toFixed(1)}g remaining after)
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => addBatchToInput(i)} className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80">
                    <Plus className="w-3 h-3" /> Add batch to this input
                  </button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={addExtraInput} className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80">
            <Plus className="w-3.5 h-3.5" /> Add additional input
          </button>
        </Section>

        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 pt-1">
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showAdvanced ? "Hide output options" : "Show output options"}
        </button>

        <AnimatePresence initial={false}>
          {showAdvanced && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="space-y-3 overflow-hidden">
              <Field label="Storage area" helper="Where will the output batch be stored?">
                <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">— Choose on finalize —</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={requiresQa} onChange={(e) => setRequiresQa(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
                <span className="text-[12px] font-medium">Output batch requires new QA testing</span>
              </label>
              <Field label="Notes">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ScrollableModal>
  );
}

// ─── Finalize Run ───────────────────────────────────────────────────────────

export function FinalizeRunModal({ open, onClose, run, inputs, onSuccess }: {
  open: boolean; onClose: () => void; run: ProductionRun | null; inputs: ProductionInput[]; onSuccess?: (result: { batch_id: string; barcode: string }) => void;
}) {
  const { orgId } = useOrg();
  const finalize = useFinalizeProductionRun();
  const [yieldQty, setYieldQty] = useState("");
  const [yieldWeight, setYieldWeight] = useState("");
  const [waste, setWaste] = useState("");
  const [barcode, setBarcode] = useState("");
  const [areaId, setAreaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState<AreaOption[]>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    setYieldQty(""); setYieldWeight(""); setWaste("");
    setBarcode(`PROD-${Date.now().toString().slice(-8)}`);
    setAreaId(run?.area_id ?? "");
    (async () => {
      const { data } = await supabase.from("grow_areas").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name");
      setAreas((data ?? []) as any);
    })();
  }, [open, orgId, run]);

  const totalInputs = useMemo(() => inputs.reduce((sum, i) => sum + Number(i.quantity_used ?? 0), 0), [inputs]);
  const qtyNum = Number(yieldQty || 0);
  const weightNum = Number(yieldWeight || 0);
  const valid = !!run && qtyNum > 0 && weightNum > 0 && !!barcode.trim() && !!areaId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!run || !valid) { toast.error("Yield + area + barcode required"); return; }
    setSaving(true);
    try {
      const result = await finalize(run.id, {
        yield_quantity: qtyNum,
        yield_weight_grams: weightNum,
        waste_weight_grams: waste ? Number(waste) : null,
        output_batch_barcode: barcode.trim(),
        area_id: areaId,
      });
      toast.success(`Output batch ${result.barcode} created`, {
        action: { label: "View Output Batch →", onClick: () => window.location.assign(`/inventory/batches/${result.batch_id}`) },
      });
      onSuccess?.(result);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Finalize failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="md"
      onSubmit={handleSubmit}
      header={<ModalHeader icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} title="Finalize production run" subtitle={run?.name} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[140px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Finalize & Create Batch
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        {run && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[12px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Run</span>
              <span className="font-semibold">{run.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Output product</span>
              <span className="font-semibold">{run.output_product?.name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Input batches</span>
              <span className="font-mono">{inputs.length} batch{inputs.length === 1 ? "" : "es"} · {totalInputs.toFixed(1)}g total</span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Yield quantity" required>
            <div className="relative">
              <Input type="number" step="0.1" min="0" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} className="font-mono pr-12" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">units</span>
            </div>
          </Field>
          <Field label="Yield weight" required>
            <div className="relative">
              <Input type="number" step="0.1" min="0" value={yieldWeight} onChange={(e) => setYieldWeight(e.target.value)} className="font-mono pr-12" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">g</span>
            </div>
          </Field>
        </div>
        <Field label="Waste weight">
          <div className="relative">
            <Input type="number" step="0.1" min="0" value={waste} onChange={(e) => setWaste(e.target.value)} className="font-mono pr-12" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">g</span>
          </div>
        </Field>
        <Field label="Output batch barcode" required>
          <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Storage area" required>
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Select area —</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        {run && qtyNum > 0 && weightNum > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-[12px] flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
            <span>
              This will create batch <span className="font-mono font-semibold">{barcode}</span> with <span className="font-mono font-semibold">{weightNum.toFixed(1)}g</span> of <span className="font-semibold">{run.output_product?.name}</span> and deduct <span className="font-mono font-semibold">{totalInputs.toFixed(1)}g</span> total from {inputs.length} input batch{inputs.length === 1 ? "" : "es"}.
            </span>
          </div>
        )}
      </div>
    </ScrollableModal>
  );
}

// ─── primitives ─────────────────────────────────────────────────────────────

function Field({ label, required, helper, children }: { label: string; required?: boolean; helper?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {helper && <p className="text-[11px] text-muted-foreground/70">{helper}</p>}
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

void Package; void Play; void cn;
