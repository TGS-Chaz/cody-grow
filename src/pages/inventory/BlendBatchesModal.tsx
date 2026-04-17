import { useEffect, useMemo, useState } from "react";
import { Combine, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { generateExternalId } from "@/lib/ccrs-id";
import { Batch } from "@/hooks/useBatches";

/**
 * Blend/consolidate multiple source batches into a single new batch.
 *
 * Constraints enforced by the picker: same strain + same product category.
 * The new batch is created as a synthetic "parent" (source_type='blend'); all
 * source batches get their current_quantity zeroed out since their full mass
 * has been rolled up into the blend.
 */
export function BlendBatchesModal({ open, onClose, initialBatches, onSuccess }: {
  open: boolean; onClose: () => void; initialBatches?: Batch[]; onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Batch[]>([]);
  const [productId, setProductId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [areaId, setAreaId] = useState("");
  const [requiresQa, setRequiresQa] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [potencyData, setPotencyData] = useState<Map<string, { thc: number | null; cbd: number | null }>>(new Map());

  useEffect(() => {
    if (!open || !orgId) return;
    setSelectedIds((initialBatches ?? []).map((b) => b.id));
    setBarcode(`BLEND-${Date.now().toString().slice(-8)}`);
    setProductId("");
    setAreaId("");
    setRequiresQa(true);
    setNotes("");
    (async () => {
      const { data: batchesRes } = await supabase.from("grow_batches")
        .select("*").eq("org_id", orgId).eq("is_available", true).gt("current_quantity", 0)
        .order("created_at", { ascending: false });
      const productIds = Array.from(new Set(((batchesRes ?? []) as any[]).map((b) => b.product_id).filter(Boolean)));
      const strainIds = Array.from(new Set(((batchesRes ?? []) as any[]).map((b) => b.strain_id).filter(Boolean)));
      const batchIds = ((batchesRes ?? []) as any[]).map((b) => b.id);
      const [pRes, sRes, aRes, qaLotsRes] = await Promise.all([
        productIds.length > 0 ? supabase.from("grow_products").select("id, name, category, ccrs_inventory_category").in("id", productIds) : Promise.resolve({ data: [] }),
        strainIds.length > 0 ? supabase.from("grow_strains").select("id, name, type").in("id", strainIds) : Promise.resolve({ data: [] }),
        supabase.from("grow_areas").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
        batchIds.length > 0 ? supabase.from("grow_qa_lots").select("id, parent_batch_id").in("parent_batch_id", batchIds) : Promise.resolve({ data: [] }),
      ]);
      const pById = new Map<string, any>((pRes.data ?? []).map((p: any) => [p.id, p]));
      const sById = new Map<string, any>((sRes.data ?? []).map((s: any) => [s.id, s]));
      const lotIds = ((qaLotsRes.data ?? []) as any[]).map((l) => l.id);
      const { data: results } = lotIds.length > 0
        ? await supabase.from("grow_qa_results").select("qa_lot_id, thc_total_pct, cbd_total_pct").in("qa_lot_id", lotIds)
        : { data: [] };
      const lotToBatch = new Map<string, string>(((qaLotsRes.data ?? []) as any[]).map((l) => [l.id, l.parent_batch_id]));
      const potency = new Map<string, { thc: number | null; cbd: number | null }>();
      ((results ?? []) as any[]).forEach((r) => {
        const batchId = lotToBatch.get(r.qa_lot_id);
        if (batchId && !potency.has(batchId)) potency.set(batchId, { thc: r.thc_total_pct, cbd: r.cbd_total_pct });
      });
      setCandidates(((batchesRes ?? []) as any[]).map((b) => ({
        ...b, product: b.product_id ? pById.get(b.product_id) ?? null : null, strain: b.strain_id ? sById.get(b.strain_id) ?? null : null,
      })));
      setPotencyData(potency);
      setProducts((pRes.data ?? []) as any[]);
      setAreas((aRes.data ?? []) as any[]);
    })();
  }, [open, orgId, initialBatches]);

  const selected = useMemo(() => candidates.filter((c) => selectedIds.includes(c.id)), [candidates, selectedIds]);

  // Constraint: all selected must share strain_id + product category
  const constraintError = useMemo(() => {
    if (selected.length < 2) return null;
    const strains = new Set(selected.map((b) => b.strain_id));
    const categories = new Set(selected.map((b) => b.product?.ccrs_inventory_category).filter(Boolean));
    if (strains.size > 1) return "All source batches must share the same strain.";
    if (categories.size > 1) return "All source batches must share the same product category.";
    return null;
  }, [selected]);

  const filteredCandidates = useMemo(() => {
    if (selected.length === 0) return candidates;
    const strainId = selected[0].strain_id;
    const category = selected[0].product?.ccrs_inventory_category;
    return candidates.filter((c) => c.strain_id === strainId && c.product?.ccrs_inventory_category === category);
  }, [candidates, selected]);

  const sameCategoryProducts = useMemo(() => {
    if (selected.length === 0) return products;
    const category = selected[0].product?.ccrs_inventory_category;
    return products.filter((p: any) => p.ccrs_inventory_category === category);
  }, [products, selected]);

  const totals = useMemo(() => {
    let weight = 0;
    const weightedThc: number[] = [];
    const weightedCbd: number[] = [];
    let totalWeightForPotency = 0;
    for (const b of selected) {
      const w = Number(b.current_quantity ?? 0);
      weight += w;
      const p = potencyData.get(b.id);
      if (p?.thc != null) { weightedThc.push(Number(p.thc) * w); totalWeightForPotency += w; }
      if (p?.cbd != null) weightedCbd.push(Number(p.cbd) * w);
    }
    const avgThc = totalWeightForPotency > 0 ? weightedThc.reduce((s, v) => s + v, 0) / totalWeightForPotency : null;
    const avgCbd = totalWeightForPotency > 0 ? weightedCbd.reduce((s, v) => s + v, 0) / totalWeightForPotency : null;
    return { weight, avgThc, avgCbd };
  }, [selected, potencyData]);

  const toggle = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const valid = selected.length >= 2 && !constraintError && !!productId && !!areaId && !!barcode.trim() && totals.weight > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !valid) { toast.error("Pick 2+ compatible batches, product, and area"); return; }
    setSaving(true);
    try {
      const strainId = selected[0].strain_id;
      const { data: blend, error } = await supabase.from("grow_batches").insert({
        org_id: orgId,
        external_id: generateExternalId(),
        barcode: barcode.trim(),
        product_id: productId,
        strain_id: strainId,
        area_id: areaId,
        source_type: "blend",
        initial_quantity: totals.weight,
        current_quantity: totals.weight,
        initial_weight_grams: totals.weight,
        current_weight_grams: totals.weight,
        is_available: !requiresQa,
        notes: `Blended from ${selected.length} batches (${selected.map((s) => s.barcode).join(", ")}).${notes ? `\n\n${notes}` : ""}`,
        created_by: user?.id ?? null,
      }).select("id, barcode").single();
      if (error) throw error;

      // Zero out source batches
      for (const src of selected) {
        await supabase.from("grow_batches").update({
          current_quantity: 0, current_weight_grams: 0,
        }).eq("id", src.id);
      }
      toast.success(`Blend batch ${blend!.barcode} created (${totals.weight.toFixed(0)}g)`, {
        description: requiresQa ? "Quarantined — QA required." : undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Blend failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="lg" onSubmit={handleSubmit}
      header={<ModalHeader icon={<Combine className="w-4 h-4 text-primary" />} title="Blend batches" subtitle="Consolidate compatible lots into a single batch" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Combine className="w-3.5 h-3.5" />}
            Create Blend
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-muted/30 border border-border p-3 text-[11px]">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
          <span>Source batches must share the same strain AND product category. Source batches are zeroed out — their full quantity rolls up into the blend.</span>
        </div>

        <Field label={`Source batches (${selected.length} selected${selected.length > 0 ? ` · ${totals.weight.toFixed(0)}g total` : ""})`} required>
          <div className="rounded-lg border border-border max-h-64 overflow-y-auto">
            {filteredCandidates.length === 0 ? (
              <div className="p-4 text-[12px] text-muted-foreground italic">No available batches.</div>
            ) : (
              filteredCandidates.map((b) => (
                <label key={b.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/30 cursor-pointer border-b border-border/50 last:border-0">
                  <input type="checkbox" checked={selectedIds.includes(b.id)} onChange={() => toggle(b.id)} className="w-4 h-4 rounded border-border accent-primary" />
                  <span className="font-mono text-[12px] flex-1">{b.barcode}</span>
                  <span className="text-[11px] text-muted-foreground">{b.strain?.name ?? "—"}</span>
                  <span className="text-[11px] text-muted-foreground">{b.product?.name ?? "—"}</span>
                  <span className="font-mono text-[11px]">{Number(b.current_quantity ?? 0).toFixed(0)}g</span>
                </label>
              ))
            )}
          </div>
          {constraintError && <p className="text-[11px] text-destructive mt-1">{constraintError}</p>}
        </Field>

        {selected.length >= 2 && !constraintError && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Total weight</div>
              <div className="text-[18px] font-bold font-mono tabular-nums">{totals.weight.toFixed(0)}g</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Weighted THC</div>
              <div className="text-[18px] font-bold font-mono tabular-nums text-emerald-500">{totals.avgThc != null ? `${totals.avgThc.toFixed(2)}%` : "—"}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Weighted CBD</div>
              <div className="text-[18px] font-bold font-mono tabular-nums text-blue-500">{totals.avgCbd != null ? `${totals.avgCbd.toFixed(2)}%` : "—"}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Output product" required>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— Select —</option>
              {sameCategoryProducts.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Storage area" required>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— Select —</option>
              {areas.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Blend barcode" required><Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" /></Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={requiresQa} onChange={(e) => setRequiresQa(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
          <span className="text-[12px] font-medium">Requires new QA testing (quarantine until passed)</span>
        </label>
        <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" /></Field>
      </div>
    </ScrollableModal>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
