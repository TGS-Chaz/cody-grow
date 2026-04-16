import { useEffect, useMemo, useState } from "react";
import { Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSublotBatch, Batch } from "@/hooks/useBatches";
import { cn } from "@/lib/utils";

/**
 * Pack-to-order workflow modal.
 *
 * When a source batch has is_pack_to_order=true, allocating it to an order
 * triggers this modal: the operator packages a specific quantity into a new
 * sublot which becomes the allocated batch. The source batch's quantity is
 * decremented; the sublot carries the allocation.
 */

export interface PackagingModalProps {
  open: boolean;
  onClose: () => void;
  sourceBatch: Batch | null;
  /** Required quantity for the order item being fulfilled. */
  orderQuantity?: number;
  onSuccess?: (child: Batch) => void;
}

export function PackagingModal({ open, onClose, sourceBatch, orderQuantity, onSuccess }: PackagingModalProps) {
  const sublot = useSublotBatch();
  const [packageSize, setPackageSize] = useState("");
  const [numPackages, setNumPackages] = useState("");
  const [barcode, setBarcode] = useState("");
  const [packagedDate, setPackagedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPackageSize("");
    setBarcode(sourceBatch ? `${sourceBatch.barcode}-PKG${Date.now().toString().slice(-4)}` : "");
    setPackagedDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    if (orderQuantity != null) setNumPackages(String(Math.max(1, Math.round(orderQuantity))));
    else setNumPackages("1");
  }, [open, sourceBatch, orderQuantity]);

  const totalWeight = useMemo(() => {
    const size = Number(packageSize);
    const count = Number(numPackages);
    if (!size || !count) return 0;
    return size * count;
  }, [packageSize, numPackages]);

  const sourceCurrent = Number(sourceBatch?.current_quantity ?? 0);
  const sourceAfter = sourceCurrent - totalWeight;
  const valid = sourceBatch && totalWeight > 0 && totalWeight <= sourceCurrent && barcode.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceBatch || !valid) { toast.error("Check quantities"); return; }
    setSaving(true);
    try {
      const child = await sublot(sourceBatch.id, {
        quantity: totalWeight,
        newBarcode: barcode.trim(),
        inheritQa: true,
        notes: `Packaged: ${numPackages} × ${packageSize}g${notes ? ` · ${notes}` : ""}`,
      });
      toast.success(`Packaged ${numPackages} × ${packageSize}g into ${child.barcode}`, {
        description: "Sublot ready to allocate to the order.",
      });
      onSuccess?.(child);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Packaging failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="sm" onSubmit={handleSubmit}
      header={<ModalHeader icon={<Package className="w-4 h-4 text-primary" />} title="Package to order" subtitle="Pack a specific quantity into a labeled sublot" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
            Package
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        {sourceBatch && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[12px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Source:</span>
              <span className="font-mono font-semibold">{sourceBatch.barcode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Product:</span>
              <span>{sourceBatch.product?.name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Available:</span>
              <span className="font-mono">{sourceCurrent.toFixed(1)}g</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Package size (g)" required>
            <div className="relative">
              <Input type="number" step="0.1" min="0" value={packageSize} onChange={(e) => setPackageSize(e.target.value)} className="font-mono pr-10" placeholder="3.5" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">g</span>
            </div>
          </Field>
          <Field label="Number of packages" required>
            <Input type="number" min="1" value={numPackages} onChange={(e) => setNumPackages(e.target.value)} className="font-mono" />
          </Field>
        </div>

        {totalWeight > 0 && (
          <div className={cn("rounded-lg border p-3 text-[12px] font-mono",
            sourceAfter < 0 ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5")}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-muted-foreground">Total to package</span>
              <span className="font-semibold">{totalWeight.toFixed(1)}g</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Source remaining after</span>
              <span className={cn("font-semibold", sourceAfter < 0 ? "text-destructive" : "")}>{sourceAfter.toFixed(1)}g</span>
            </div>
          </div>
        )}

        <Field label="Sublot barcode" required>
          <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Packaged date">
          <Input type="date" value={packagedDate} onChange={(e) => setPackagedDate(e.target.value)} />
        </Field>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
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
