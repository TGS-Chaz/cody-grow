import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, ArrowRight, Barcode, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import { useFinishHarvest, HydratedBoardCard } from "@/hooks/useGrowBoard";

interface Props {
  open: boolean;
  onClose: () => void;
  card: HydratedBoardCard;
  onSuccess: () => void;
}

interface ProductOption { id: string; name: string; ccrs_inventory_category: string | null; ccrs_inventory_type: string | null }
interface AreaOption { id: string; name: string }

/**
 * Drying → Inventory: finalizes a harvest by recording final weights, creating
 * a grow_batches row, and swapping the board card to point at the new batch.
 * Only valid when the harvest's status is 'cured' (validated in the parent).
 */
export default function FinishHarvestModal({ open, onClose, card, onSuccess }: Props) {
  const finish = useFinishHarvest();
  const { orgId } = useOrg();
  const harvest = card.entity as any;

  const [dryWeight, setDryWeight] = useState<string>("");
  const [wasteWeight, setWasteWeight] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [areaId, setAreaId] = useState<string>("");
  const [barcode, setBarcode] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    (async () => {
      // Only HarvestedMaterial products are appropriate here — that's what
      // a newly-finished flower harvest becomes. Users can still pick any
      // product; we just surface the relevant ones first.
      const [pRes, aRes] = await Promise.all([
        supabase
          .from("grow_products")
          .select("id, name, ccrs_inventory_category, ccrs_inventory_type")
          .eq("org_id", orgId)
          .eq("is_active", true)
          .order("ccrs_inventory_category", { ascending: true })
          .order("name"),
        supabase.from("grow_areas").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
      ]);
      setProducts((pRes.data ?? []) as ProductOption[]);
      setAreas((aRes.data ?? []) as AreaOption[]);
    })();
  }, [open, orgId]);

  useEffect(() => {
    if (!open) return;
    setDryWeight("");
    setWasteWeight("");
    setProductId("");
    setAreaId(harvest.area_id ?? "");
    setBarcode(`B-${Date.now()}`);
    setNotes("");
  }, [open, harvest.area_id]);

  const harvestedProducts = useMemo(
    () => products.filter((p) => p.ccrs_inventory_category === "HarvestedMaterial"),
    [products],
  );
  const otherProducts = useMemo(
    () => products.filter((p) => p.ccrs_inventory_category !== "HarvestedMaterial"),
    [products],
  );

  const isCured = harvest.status === "cured";
  const wetWeight = harvest.wet_weight_grams != null ? Number(harvest.wet_weight_grams) : null;

  const yieldPct = useMemo(() => {
    const dry = Number(dryWeight) || 0;
    if (!wetWeight || dry <= 0) return null;
    return (dry / wetWeight) * 100;
  }, [dryWeight, wetWeight]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dryWeight || Number(dryWeight) <= 0) { toast.error("Dry weight is required"); return; }
    if (!productId) { toast.error("Pick a product"); return; }
    setSaving(true);
    try {
      const result = await finish(harvest.id, card.card.id, {
        dry_weight_grams: Number(dryWeight),
        waste_weight_grams: wasteWeight ? Number(wasteWeight) : null,
        product_id: productId,
        area_id: areaId || null,
        barcode: barcode.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success(`Batch ${result.barcode} created`, {
        description: `${Number(dryWeight).toFixed(0)}g added to Inventory`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Finalize failed");
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
          icon={<Package className="w-4 h-4 text-teal-500" />}
          title="Finalize to Inventory"
          subtitle={harvest.name}
        />
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving || !isCured} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
            Create Batch
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">From</p>
            <p className="text-[14px] font-semibold text-orange-500">Drying / Curing</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">To</p>
            <p className="text-[14px] font-semibold text-teal-500">Inventory</p>
          </div>
        </div>

        {!isCured && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2 text-[12px]">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
            <div>
              This harvest is <span className="font-semibold">{harvest.status}</span>. Finalize only once it's <span className="font-mono">cured</span> — edit the harvest first (click the card and open full detail).
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Final Dry Weight" required>
            <div className="relative">
              <Input
                type="number" step="0.1" min="0"
                value={dryWeight}
                onChange={(e) => setDryWeight(e.target.value)}
                className="font-mono pr-12"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">grams</span>
            </div>
          </Field>
          <Field label="Waste Weight">
            <div className="relative">
              <Input
                type="number" step="0.1" min="0"
                value={wasteWeight}
                onChange={(e) => setWasteWeight(e.target.value)}
                className="font-mono pr-12"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">grams</span>
            </div>
          </Field>
        </div>

        {/* Yield summary */}
        {wetWeight != null && (
          <div className="rounded-lg bg-muted/30 border border-border p-3 text-[11px] grid grid-cols-3 gap-3">
            <div>
              <p className="uppercase tracking-wider font-medium text-muted-foreground text-[10px]">Wet</p>
              <p className="font-mono font-semibold text-foreground mt-0.5">{wetWeight.toFixed(0)}g</p>
            </div>
            <div>
              <p className="uppercase tracking-wider font-medium text-muted-foreground text-[10px]">Dry</p>
              <p className="font-mono font-semibold text-foreground mt-0.5">{dryWeight ? `${Number(dryWeight).toFixed(0)}g` : "—"}</p>
            </div>
            <div>
              <p className="uppercase tracking-wider font-medium text-muted-foreground text-[10px]">Yield</p>
              <p className={`font-mono font-semibold mt-0.5 ${yieldPct != null && yieldPct > 28 ? "text-emerald-500" : yieldPct != null && yieldPct < 18 ? "text-amber-500" : "text-foreground"}`}>
                {yieldPct != null ? `${yieldPct.toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        )}

        <Field label="Product" required>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Select product —</option>
            {harvestedProducts.length > 0 && (
              <optgroup label="Harvested Material">
                {harvestedProducts.map((p) => <option key={p.id} value={p.id}>{p.name}{p.ccrs_inventory_type ? ` (${p.ccrs_inventory_type})` : ""}</option>)}
              </optgroup>
            )}
            {otherProducts.length > 0 && (
              <optgroup label="Other">
                {otherProducts.map((p) => <option key={p.id} value={p.id}>{p.name}{p.ccrs_inventory_type ? ` (${p.ccrs_inventory_type})` : ""}</option>)}
              </optgroup>
            )}
          </select>
          {products.length === 0 && (
            <p className="text-[11px] text-muted-foreground/70">Add a product in Cultivation → Products first.</p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Storage Area">
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— None —</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Batch Barcode">
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono pl-9" />
            </div>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Batch characteristics, aroma notes, quality observations…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </Field>
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
