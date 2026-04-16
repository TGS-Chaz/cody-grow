import { useEffect, useState } from "react";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CCRS_DESTRUCTION_REASONS, CcrsDestructionReason,
  CCRS_DESTRUCTION_METHODS, CcrsDestructionMethod,
} from "@/lib/schema-enums";
import { Plant, useDestroyPlant, DestroyInput } from "@/hooks/usePlants";

interface Props {
  open: boolean;
  onClose: () => void;
  plants: Plant[];
  onSuccess?: () => void;
}

const REASON_LABELS: Record<CcrsDestructionReason, string> = {
  PlantDied: "Plant died",
  Contamination: "Contamination",
  TooMuchWater: "Too much water",
  TooLittleWater: "Too little water",
  MalePlant: "Male plant",
  Mites: "Mites / pests",
  Other: "Other",
};

/** Plant destruction — writes a grow_disposals row with CCRS-exact reason
 * + method, then flips the plants' ccrs_plant_state to 'Destroyed'. */
export default function DestroyPlantModal({ open, onClose, plants, onSuccess }: Props) {
  const destroy = useDestroyPlant();
  const [reason, setReason] = useState<CcrsDestructionReason>("PlantDied");
  const [method, setMethod] = useState<CcrsDestructionMethod>("Grind");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const isBulk = plants.length > 1;

  useEffect(() => {
    if (!open) return;
    setReason("PlantDied");
    setMethod("Grind");
    setDate(new Date().toISOString().slice(0, 10));
    setWeight("");
    setNotes("");
    setConfirm("");
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirm !== "DESTROY") { toast.error('Type "DESTROY" to confirm'); return; }
    setSaving(true);
    try {
      const input: DestroyInput = {
        reason,
        method,
        destroyed_at: new Date(`${date}T12:00:00`).toISOString(),
        pre_disposal_weight_grams: weight ? Number(weight) : null,
        notes: notes.trim() || null,
      };
      await destroy(plants.map((p) => p.id), input);
      toast.success(
        isBulk ? `${plants.length} plants destroyed` : `Plant destroyed`,
        { description: `CCRS reason: ${REASON_LABELS[reason]} · Method: ${method}` },
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Destruction failed");
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
      header={
        <ModalHeader
          icon={<Trash2 className="w-4 h-4 text-destructive" />}
          title={isBulk ? `Destroy ${plants.length} plants` : "Destroy plant"}
          subtitle={isBulk ? "Creates one CCRS disposal record for all" : plants[0]?.plant_identifier ?? ""}
        />
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={saving || confirm !== "DESTROY"}
            className="min-w-[120px]"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Destroy"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2 text-[12px]">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-destructive" />
          <div>
            <p className="text-foreground font-medium mb-0.5">This is a CCRS-reportable destruction event.</p>
            <p className="text-muted-foreground">
              Plants will be flipped to <span className="font-mono">ccrs_plant_state = Destroyed</span> and a grow_disposals
              row will be written with the CCRS reason + method. This cannot be undone.
            </p>
          </div>
        </div>

        {isBulk && (
          <div className="rounded-lg bg-muted/30 border border-border p-3 text-[11px] text-muted-foreground">
            Destroying: {plants.slice(0, 5).map((p) => p.plant_identifier ?? p.id.slice(0, 8)).join(", ")}
            {plants.length > 5 && <> · +{plants.length - 5} more</>}
          </div>
        )}

        <Field label="Destruction Reason" required>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as CcrsDestructionReason)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CCRS_DESTRUCTION_REASONS.map((r) => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}
          </select>
        </Field>

        <Field label="Destruction Method" required>
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 w-full">
            {CCRS_DESTRUCTION_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`flex-1 h-9 text-[12px] font-medium rounded-md transition-colors ${
                  method === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Destruction Date" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Weight Destroyed" helper="Pre-disposal weight in grams">
            <div className="relative">
              <Input
                type="number" step="0.1" min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="font-mono pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">g</span>
            </div>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Circumstances, witness info, etc."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </Field>

        <Field label={`Type "DESTROY" to confirm`} required>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DESTROY"
            className="font-mono"
            autoFocus
          />
        </Field>
      </div>
    </ScrollableModal>
  );
}

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
