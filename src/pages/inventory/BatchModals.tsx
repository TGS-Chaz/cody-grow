import { useEffect, useMemo, useState } from "react";
import { Loader2, Scissors, ArrowLeft, Sliders, Package, Plus, Minus, Info, ChevronDown, ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import {
  Batch, useSublotBatch, useReturnToParent, useAdjustInventory, useCreateBatch,
} from "@/hooks/useBatches";
import {
  CCRS_ADJUSTMENT_REASONS, CcrsAdjustmentReason,
  CCRS_INVENTORY_CATEGORIES, CCRS_INVENTORY_CATEGORY_LABELS, CcrsInventoryCategory,
} from "@/lib/schema-enums";
import { generateExternalId } from "@/lib/ccrs-id";
import { cn } from "@/lib/utils";

// ─── Sublot Modal ────────────────────────────────────────────────────────────

interface SublotModalProps {
  open: boolean;
  onClose: () => void;
  parent: Batch | null;
  onSuccess?: (child: Batch) => void;
}

export function SublotModal({ open, onClose, parent, onSuccess }: SublotModalProps) {
  const { orgId } = useOrg();
  const sublot = useSublotBatch();
  const [quantity, setQuantity] = useState("");
  const [barcode, setBarcode] = useState("");
  const [areaId, setAreaId] = useState<string>("");
  const [inheritQa, setInheritQa] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    setQuantity("");
    setBarcode(parent ? `${parent.barcode}-S${Date.now().toString().slice(-4)}` : "");
    setAreaId(parent?.area_id ?? "");
    setInheritQa(true);
    setNotes("");
    (async () => {
      const { data } = await supabase.from("grow_areas").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name");
      setAreas((data ?? []) as any);
    })();
  }, [open, orgId, parent]);

  const parentCurrent = Number(parent?.current_quantity ?? 0);
  const qtyNum = Number(quantity || 0);
  const parentAfter = parentCurrent - qtyNum;
  const valid = qtyNum > 0 && qtyNum <= parentCurrent && barcode.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parent) return;
    if (!valid) { toast.error("Invalid quantity"); return; }
    setSaving(true);
    try {
      const child = await sublot(parent.id, {
        quantity: qtyNum,
        newBarcode: barcode.trim(),
        areaId: areaId || null,
        inheritQa,
        notes: notes.trim() || null,
      });
      toast.success(`Sublot ${child.barcode} created with ${qtyNum}g`);
      onSuccess?.(child);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Sublot failed");
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
      header={<ModalHeader icon={<Scissors className="w-4 h-4 text-purple-500" />} title="Create sublot" subtitle={parent ? `Split off from ${parent.barcode}` : ""} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
            Create Sublot
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        {parent && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[12px]">
            <div className="text-muted-foreground text-[11px] uppercase tracking-wider font-semibold mb-1">Parent batch</div>
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold">{parent.barcode}</span>
              <span className="font-mono">{parentCurrent.toFixed(1)}g available</span>
            </div>
          </div>
        )}
        <Field label="Quantity to split off (g)" required>
          <div className="relative">
            <Input type="number" step="0.1" min="0" max={parentCurrent} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="font-mono pr-12" placeholder="0.0" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">g</span>
          </div>
        </Field>
        {qtyNum > 0 && parent && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-[12px] font-mono flex items-center justify-between">
            <span className="text-muted-foreground">{qtyNum.toFixed(1)}g →</span>
            <span>Parent: <span className={cn("font-semibold", parentAfter < 0 && "text-destructive")}>{parentAfter.toFixed(1)}g</span></span>
            <span className="text-muted-foreground">+</span>
            <span>Sublot: <span className="font-semibold text-primary">{qtyNum.toFixed(1)}g</span></span>
          </div>
        )}
        <Field label="New barcode" required helper="Auto-generated from parent. Edit if needed.">
          <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Area" helper="Where is the sublot stored?">
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Same as parent —</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={inheritQa} onChange={(e) => setInheritQa(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-border accent-primary" />
          <div className="text-[12px]">
            <span className="font-medium">Inherit QA results</span>
            <p className="text-muted-foreground text-[11px]">QA results from the parent batch apply to this sublot — no retesting required.</p>
          </div>
        </label>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </Field>
      </div>
    </ScrollableModal>
  );
}

// ─── Return to Parent Modal ─────────────────────────────────────────────────

interface ReturnToParentModalProps {
  open: boolean;
  onClose: () => void;
  child: Batch | null;
  onSuccess?: () => void;
}

export function ReturnToParentModal({ open, onClose, child, onSuccess }: ReturnToParentModalProps) {
  const ret = useReturnToParent();
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuantity("");
    setReason("");
  }, [open]);

  const childCurrent = Number(child?.current_quantity ?? 0);
  const qtyNum = Number(quantity || 0);
  const valid = qtyNum > 0 && qtyNum <= childCurrent && !!child?.parent_batch_id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!child) return;
    if (!valid) { toast.error("Invalid quantity"); return; }
    setSaving(true);
    try {
      await ret(child.id, qtyNum, reason.trim() || undefined);
      toast.success(`Returned ${qtyNum}g to parent`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Return failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="sm"
      onSubmit={handleSubmit}
      header={<ModalHeader icon={<ArrowLeft className="w-4 h-4 text-amber-500" />} title="Return to parent" subtitle={child ? `${child.barcode} → parent batch` : ""} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeft className="w-3.5 h-3.5" />}
            Return
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        {child && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[12px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Child:</span>
              <span className="font-mono font-semibold">{child.barcode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Parent:</span>
              <span className="font-mono font-semibold">{child.parent_batch?.barcode ?? "—"}</span>
            </div>
          </div>
        )}
        <Field label="Quantity to return (g)" required>
          <div className="relative">
            <Input type="number" step="0.1" min="0" max={childCurrent} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="font-mono pr-12" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">g</span>
          </div>
        </Field>
        {qtyNum > 0 && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-[12px] font-mono flex items-center justify-between">
            <span>Child: <span className="font-semibold">{(childCurrent - qtyNum).toFixed(1)}g</span></span>
            <span className="text-muted-foreground">→</span>
            <span>Parent: <span className="font-semibold text-primary">+{qtyNum.toFixed(1)}g</span></span>
          </div>
        )}
        <Field label="Reason">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Unsold, returned to bulk" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </Field>
      </div>
    </ScrollableModal>
  );
}

// ─── Adjust Inventory Modal ─────────────────────────────────────────────────

interface AdjustInventoryModalProps {
  open: boolean;
  onClose: () => void;
  batch: Batch | null;
  onSuccess?: () => void;
}

export function AdjustInventoryModal({ open, onClose, batch, onSuccess }: AdjustInventoryModalProps) {
  const adjust = useAdjustInventory();
  const [reason, setReason] = useState<CcrsAdjustmentReason>("Reconciliation");
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("Reconciliation");
    setDetail("");
    setAmount("");
    setDirection("remove");
    setDate(new Date().toISOString().slice(0, 10));
  }, [open]);

  const current = Number(batch?.current_quantity ?? 0);
  const amountNum = Number(amount || 0);
  const signed = direction === "add" ? amountNum : -amountNum;
  const next = current + signed;
  const valid = amountNum > 0 && next >= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch) return;
    if (!valid) { toast.error(next < 0 ? "Would leave negative quantity" : "Invalid quantity"); return; }
    setSaving(true);
    try {
      await adjust(batch.id, {
        reason,
        quantity: signed,
        detail: detail.trim() || null,
        adjustment_date: new Date(date).toISOString(),
      });
      toast.success(`Inventory ${direction === "add" ? "increased" : "decreased"} by ${amountNum}g`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Adjustment failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="sm"
      onSubmit={handleSubmit}
      header={<ModalHeader icon={<Sliders className="w-4 h-4 text-blue-500" />} title="Adjust inventory" subtitle={batch?.barcode} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sliders className="w-3.5 h-3.5" />}
            Record
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        {batch && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[12px] flex items-center justify-between">
            <span className="font-mono font-semibold">{batch.barcode}</span>
            <span className="font-mono text-muted-foreground">current: {current.toFixed(1)}g</span>
          </div>
        )}
        <Field label="Reason" required>
          <select value={reason} onChange={(e) => setReason(e.target.value as CcrsAdjustmentReason)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {CCRS_ADJUSTMENT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Direction</label>
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 w-full">
            {(["remove", "add"] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDirection(d)} className={cn(
                "flex-1 h-9 text-[12px] font-medium rounded-md transition-colors flex items-center justify-center gap-1.5",
                direction === d ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}>
                {d === "add" ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {d === "add" ? "Add to inventory" : "Remove from inventory"}
              </button>
            ))}
          </div>
        </div>
        <Field label={`Quantity (g) to ${direction}`} required>
          <div className="relative">
            <Input type="number" step="0.1" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono pr-12" placeholder="0.0" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">g</span>
          </div>
        </Field>
        {amountNum > 0 && (
          <div className={cn("rounded-lg border p-3 text-[12px] font-mono flex items-center justify-between",
            next < 0 ? "border-destructive/30 bg-destructive/5" : "border-primary/20 bg-primary/5")}>
            <span>{current.toFixed(1)}g</span>
            <span className="text-muted-foreground">{signed > 0 ? "+" : ""}{signed.toFixed(1)}g =</span>
            <span className={cn("font-semibold", next < 0 ? "text-destructive" : "text-primary")}>{next.toFixed(1)}g</span>
          </div>
        )}
        <Field label="Adjustment date" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Detail">
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </Field>
      </div>
    </ScrollableModal>
  );
}

// ─── Create Batch Modal ─────────────────────────────────────────────────────

interface CreateBatchModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (batch: Batch) => void;
}

export function CreateBatchModal({ open, onClose, onSuccess }: CreateBatchModalProps) {
  const { orgId } = useOrg();
  const create = useCreateBatch();
  const [productId, setProductId] = useState("");
  const [strainId, setStrainId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [initialQty, setInitialQty] = useState("");
  const [areaId, setAreaId] = useState("");
  const [sourceType, setSourceType] = useState<"manual" | "harvest" | "production" | "inbound_transfer">("manual");
  const [harvestId, setHarvestId] = useState("");
  const [isAvailable, setIsAvailable] = useState(false);
  const [isMedical, setIsMedical] = useState(false);
  const [isDoh, setIsDoh] = useState(false);
  const [isTradeSample, setIsTradeSample] = useState(false);
  const [isEmployeeSample, setIsEmployeeSample] = useState(false);
  const [isNonCannabis, setIsNonCannabis] = useState(false);
  const [isPackToOrder, setIsPackToOrder] = useState(false);
  const [unitCost, setUnitCost] = useState("");
  const [procurementFarm, setProcurementFarm] = useState("");
  const [procurementLicense, setProcurementLicense] = useState("");
  const [externalId, setExternalId] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [packagedDate, setPackagedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<Array<{ id: string; name: string; category: string; ccrs_inventory_category: CcrsInventoryCategory | null; strain_id: string | null; sku: string | null }>>([]);
  const [strains, setStrains] = useState<Array<{ id: string; name: string }>>([]);
  const [areas, setAreas] = useState<Array<{ id: string; name: string }>>([]);
  const [harvests, setHarvests] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    setProductId(""); setStrainId(""); setBarcode(""); setInitialQty(""); setAreaId("");
    setSourceType("manual"); setHarvestId(""); setIsAvailable(false); setIsMedical(false);
    setIsDoh(false); setIsTradeSample(false); setIsEmployeeSample(false); setIsNonCannabis(false);
    setIsPackToOrder(false); setUnitCost(""); setProcurementFarm(""); setProcurementLicense("");
    setExternalId(generateExternalId()); setExpirationDate(""); setPackagedDate("");
    setNotes(""); setImageUrl(""); setShowAdvanced(false);
    (async () => {
      const [pRes, sRes, aRes, hRes] = await Promise.all([
        supabase.from("grow_products").select("id, name, category, ccrs_inventory_category, strain_id, sku").eq("org_id", orgId).eq("is_active", true).order("name"),
        supabase.from("grow_strains").select("id, name").eq("org_id", orgId).order("name"),
        supabase.from("grow_areas").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
        supabase.from("grow_harvests").select("id, name").eq("org_id", orgId).eq("status", "cured").order("created_at", { ascending: false }),
      ]);
      setProducts((pRes.data ?? []) as any);
      setStrains((sRes.data ?? []) as any);
      setAreas((aRes.data ?? []) as any);
      setHarvests((hRes.data ?? []) as any);
    })();
  }, [open, orgId]);

  const selectedProduct = useMemo(() => products.find((p) => p.id === productId), [products, productId]);

  useEffect(() => {
    if (selectedProduct?.strain_id && !strainId) setStrainId(selectedProduct.strain_id);
  }, [selectedProduct, strainId]);

  useEffect(() => {
    if (selectedProduct && !barcode) {
      const prefix = selectedProduct.sku ?? "BATCH";
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      setBarcode(`${prefix}-${date}-${Date.now().toString().slice(-4)}`);
    }
  }, [selectedProduct, barcode]);

  const valid = !!productId && !!barcode.trim() && Number(initialQty) > 0 && !!areaId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { toast.error("Fill required fields"); return; }
    setSaving(true);
    try {
      const batch = await create({
        product_id: productId,
        strain_id: strainId || null,
        barcode: barcode.trim(),
        initial_quantity: Number(initialQty),
        area_id: areaId,
        source_type: sourceType,
        harvest_id: sourceType === "harvest" ? (harvestId || null) : null,
        external_id: externalId.trim() || undefined,
        is_available: isAvailable,
        is_medical: isMedical,
        is_doh_compliant: isDoh,
        is_trade_sample: isTradeSample,
        is_employee_sample: isEmployeeSample,
        is_non_cannabis: isNonCannabis,
        is_pack_to_order: isPackToOrder,
        unit_cost: unitCost ? Number(unitCost) : null,
        procurement_farm: procurementFarm.trim() || null,
        procurement_license: procurementLicense.trim() || null,
        expiration_date: expirationDate || null,
        packaged_date: packagedDate || null,
        notes: notes.trim() || null,
        image_url: imageUrl.trim() || null,
      } as any);
      toast.success(`Batch ${batch.barcode} created`);
      onSuccess?.(batch);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const productsByCategory = useMemo(() => {
    const groups = new Map<string, typeof products>();
    for (const p of products) {
      const k = p.ccrs_inventory_category ?? "Other";
      const arr = groups.get(k) ?? [];
      arr.push(p);
      groups.set(k, arr);
    }
    return Array.from(groups.entries());
  }, [products]);

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="md"
      onSubmit={handleSubmit}
      header={<ModalHeader icon={<Package className="w-4 h-4 text-teal-500" />} title="Create batch" subtitle="Most batches are auto-created from harvests. Manual creation supported." />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
            Create Batch
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Product" required>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Select product —</option>
            {productsByCategory.map(([cat, list]) => (
              <optgroup key={cat} label={CCRS_INVENTORY_CATEGORY_LABELS[cat as CcrsInventoryCategory] ?? cat}>
                {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Strain" required>
          <select value={strainId} onChange={(e) => setStrainId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— None —</option>
            {strains.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Barcode" required>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Initial quantity" required>
            <div className="relative">
              <Input type="number" step="0.1" min="0" value={initialQty} onChange={(e) => setInitialQty(e.target.value)} className="font-mono pr-12" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">g / units</span>
            </div>
          </Field>
        </div>
        <Field label="Area" required helper="Where is this stored?">
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Select area —</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>

        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 pt-1">
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showAdvanced ? "Hide all fields" : "Show all fields"}
        </button>

        <AnimatePresence initial={false}>
          {showAdvanced && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="space-y-5 overflow-hidden">
              <Section title="Source">
                <Field label="Source type">
                  <select value={sourceType} onChange={(e) => setSourceType(e.target.value as any)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="manual">Manual</option>
                    <option value="harvest">Harvest</option>
                    <option value="production">Production Run</option>
                    <option value="inbound_transfer">Inbound Transfer</option>
                  </select>
                </Field>
                {sourceType === "harvest" && (
                  <Field label="Harvest">
                    <select value={harvestId} onChange={(e) => setHarvestId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">— None —</option>
                      {harvests.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </Field>
                )}
              </Section>

              <Section title="Compliance">
                <div className="grid grid-cols-2 gap-2">
                  <Toggle label="Is Available" checked={isAvailable} onChange={setIsAvailable} />
                  <Toggle label="Medical" checked={isMedical} onChange={setIsMedical} />
                  <Toggle label="DOH Compliant" checked={isDoh} onChange={setIsDoh} />
                  <Toggle label="Trade Sample" checked={isTradeSample} onChange={setIsTradeSample} />
                  <Toggle label="Employee Sample" checked={isEmployeeSample} onChange={setIsEmployeeSample} />
                  <Toggle label="Non-Cannabis" checked={isNonCannabis} onChange={setIsNonCannabis} />
                  <Toggle label="Pack to Order" checked={isPackToOrder} onChange={setIsPackToOrder} />
                </div>
                {!isAvailable && (
                  <div className="flex items-start gap-2 rounded-lg bg-muted/30 border border-border p-3 text-[11px]">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                    <span>This batch will be created quarantined. Mark available after QA passes.</span>
                  </div>
                )}
              </Section>

              <Section title="Costs">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Unit cost">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
                      <Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="font-mono pl-6" />
                    </div>
                  </Field>
                  <Field label="Total cost" helper="auto from unit × quantity">
                    <Input value={unitCost && initialQty ? (Number(unitCost) * Number(initialQty)).toFixed(2) : ""} readOnly className="font-mono bg-muted/30" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Procurement farm"><Input value={procurementFarm} onChange={(e) => setProcurementFarm(e.target.value)} /></Field>
                  <Field label="Procurement license"><Input value={procurementLicense} onChange={(e) => setProcurementLicense(e.target.value)} /></Field>
                </div>
              </Section>

              <Section title="CCRS">
                <Field label="External identifier" helper="Auto-generated">
                  <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} className="font-mono" />
                </Field>
              </Section>

              <Section title="Dates">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Packaged date"><Input type="date" value={packagedDate} onChange={(e) => setPackagedDate(e.target.value)} /></Field>
                  <Field label="Expiration date"><Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} /></Field>
                </div>
              </Section>

              <Field label="Notes">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </Field>

              <Field label="Batch image URL" helper="Optional. Overrides the product image on the public marketplace.">
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className="font-mono" />
                {imageUrl && (
                  <img src={imageUrl} alt="" className="mt-2 w-24 h-24 rounded-lg object-cover border border-border" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
              </Field>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ScrollableModal>
  );
}

// ─── shared helpers ─────────────────────────────────────────────────────────
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
      <span className="text-[12px] font-medium">{label}</span>
    </label>
  );
}

void CCRS_INVENTORY_CATEGORIES;
