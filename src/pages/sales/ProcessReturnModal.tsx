import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { generateExternalId } from "@/lib/ccrs-id";

const RETURN_REASONS = [
  { value: "quality_issue", label: "Quality Issue" },
  { value: "wrong_product", label: "Wrong Product" },
  { value: "damaged", label: "Damaged" },
  { value: "overshipment", label: "Overshipment" },
  { value: "other", label: "Other" },
];

/**
 * Process a return of items from a previously-shipped outbound manifest.
 * Creates a return-type manifest and adds returned quantities back to each
 * batch's current_quantity via inventory adjustments.
 */
export function ProcessReturnModal({ open, onClose, sourceManifestId, onSuccess }: {
  open: boolean; onClose: () => void; sourceManifestId: string | null; onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [items, setItems] = useState<any[]>([]);
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("quality_issue");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [sourceManifest, setSourceManifest] = useState<any | null>(null);

  useEffect(() => {
    if (!open || !sourceManifestId) return;
    setReason("quality_issue"); setNotes(""); setReturnQtys({});
    (async () => {
      const { data: m } = await supabase.from("grow_manifests").select("*").eq("id", sourceManifestId).maybeSingle();
      setSourceManifest(m);
      const { data: manifestItems } = await supabase.from("grow_manifest_items")
        .select("*").eq("manifest_id", sourceManifestId);
      const batchIds = Array.from(new Set(((manifestItems ?? []) as any[]).map((i) => i.batch_id).filter(Boolean)));
      const { data: batches } = batchIds.length > 0
        ? await supabase.from("grow_batches").select("id, barcode, product_id").in("id", batchIds)
        : { data: [] };
      const bById = new Map<string, any>((batches ?? []).map((b: any) => [b.id, b]));
      setItems(((manifestItems ?? []) as any[]).map((i) => ({ ...i, batch: i.batch_id ? bById.get(i.batch_id) ?? null : null })));
    })();
  }, [open, sourceManifestId]);

  const valid = Object.values(returnQtys).some((v) => Number(v) > 0);

  const totalReturnedWeight = useMemo(() => {
    return Object.entries(returnQtys).reduce((s, [, v]) => s + Number(v || 0), 0);
  }, [returnQtys]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !sourceManifest || !valid) return;
    setSaving(true);
    try {
      // Create return manifest
      const { data: retManifest, error: mErr } = await supabase.from("grow_manifests").insert({
        org_id: orgId,
        external_id: generateExternalId(),
        manifest_type: "return",
        status: "accepted",
        // Flip origin/destination — returner is origin, we are destination
        origin_license_number: sourceManifest.destination_license_number,
        origin_license_name: sourceManifest.destination_license_name,
        origin_address: sourceManifest.destination_address,
        destination_license_number: sourceManifest.origin_license_number,
        destination_license_name: sourceManifest.origin_license_name,
        destination_address: sourceManifest.origin_address,
        order_id: sourceManifest.order_id,
        departure_datetime: new Date().toISOString(),
        arrival_datetime: new Date().toISOString(),
        notes: `Return of manifest ${sourceManifest.external_id}. Reason: ${reason}.${notes ? `\n\n${notes}` : ""}`,
        created_by: user?.id ?? null,
      }).select("id").single();
      if (mErr) throw mErr;

      for (const item of items) {
        const qty = Number(returnQtys[item.id] ?? 0);
        if (qty <= 0) continue;

        // Return-manifest item
        await supabase.from("grow_manifest_items").insert({
          manifest_id: retManifest!.id,
          batch_id: item.batch_id,
          plant_id: item.plant_id,
          quantity: qty,
          unit_price: item.unit_price,
          accepted_quantity: qty,
        });

        // Restore to batch
        if (item.batch_id) {
          const { data: batch } = await supabase.from("grow_batches")
            .select("current_quantity").eq("id", item.batch_id).maybeSingle();
          if (batch) {
            const next = Number((batch as any).current_quantity ?? 0) + qty;
            await supabase.from("grow_batches").update({
              current_quantity: next, current_weight_grams: next,
            }).eq("id", item.batch_id);
          }
          // Log an adjustment
          await supabase.from("grow_inventory_adjustments").insert({
            org_id: orgId,
            external_id: generateExternalId(),
            batch_id: item.batch_id,
            adjustment_reason: "Reconciliation",
            adjustment_detail: `Return from manifest ${sourceManifest.external_id} (${reason})`,
            quantity_delta: qty,
            adjustment_date: new Date().toISOString(),
            adjusted_by: user?.id ?? null,
          });
        }
      }

      toast.success(`Return processed · ${totalReturnedWeight.toFixed(1)}g restored to inventory`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Return failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<RotateCcw className="w-4 h-4 text-amber-500" />} title="Process return" subtitle={sourceManifest ? `From ${sourceManifest.destination_license_name ?? sourceManifest.destination_license_number}` : ""} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Process Return
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {RETURN_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Items being returned</label>
          {items.length === 0 ? (
            <p className="text-[12px] text-muted-foreground italic">No items on source manifest.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              {items.map((i) => (
                <div key={i.id} className="flex items-center gap-2 px-3 py-2 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[12px] truncate">{i.batch?.barcode ?? i.plant_id ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">Originally shipped: {Number(i.quantity).toFixed(1)}g</div>
                  </div>
                  <div className="relative w-28">
                    <Input type="number" step="0.1" min="0" max={i.quantity} value={returnQtys[i.id] ?? ""} onChange={(e) => setReturnQtys((q) => ({ ...q, [i.id]: e.target.value }))} className="font-mono h-8 pr-8" placeholder="0" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">g</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </div>
        {totalReturnedWeight > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[12px] font-mono">
            Returning <span className="font-semibold">{totalReturnedWeight.toFixed(1)}g</span> — will restore to inventory and create a return manifest.
          </div>
        )}
      </div>
    </ScrollableModal>
  );
}
