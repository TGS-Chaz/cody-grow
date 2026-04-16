import { useEffect, useState } from "react";
import { Loader2, Scissors, ArrowRight, Gauge } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHarvestCycle, HydratedBoardCard } from "@/hooks/useGrowBoard";

interface Props {
  open: boolean;
  onClose: () => void;
  card: HydratedBoardCard;
  onSuccess: () => void;
}

/** Flowering → Drying: creates a grow_harvests record and swaps the board card
 * from pointing at the cycle to pointing at the new harvest. */
export default function HarvestModal({ open, onClose, card, onSuccess }: Props) {
  const harvestCycle = useHarvestCycle();
  const cycle = card.entity as any;
  const plantCount = card.extras.plant_count ?? 0;

  const [name, setName] = useState("");
  const [harvestDate, setHarvestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recordWet, setRecordWet] = useState(false);
  const [wetWeight, setWetWeight] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const strain = card.strain?.name ?? "Harvest";
    setName(`${strain} Harvest - ${new Date().toISOString().slice(0, 10)}`);
    setHarvestDate(new Date().toISOString().slice(0, 10));
    setRecordWet(false);
    setWetWeight("");
    setNotes("");
  }, [open, card.strain?.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Harvest name is required"); return; }
    if (recordWet && !wetWeight) { toast.error("Enter wet weight or turn off Record wet weight"); return; }
    setSaving(true);
    try {
      const result = await harvestCycle(cycle.id, card.card.id, {
        name: name.trim(),
        harvest_date: harvestDate,
        wet_weight_grams: recordWet ? Number(wetWeight) || null : null,
        notes: notes.trim() || null,
      });
      toast.success(`Harvest "${name.trim()}" created`, {
        description: `${plantCount} plant${plantCount === 1 ? "" : "s"} marked as harvested — drying now`,
      });
      void result;
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Harvest failed");
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
          icon={<Scissors className="w-4 h-4 text-orange-500" />}
          title="Harvest Cycle"
          subtitle={cycle.name}
        />
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
            Create Harvest
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">From</p>
            <p className="text-[14px] font-semibold text-purple-500">Flowering</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">To</p>
            <p className="text-[14px] font-semibold text-orange-500">Drying</p>
          </div>
        </div>

        <Field label="Harvest Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>

        <Field label="Harvest Date" required>
          <Input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
        </Field>

        <div className="rounded-lg border border-border bg-card p-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={recordWet}
              onChange={(e) => setRecordWet(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            <Gauge className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[13px] font-medium text-foreground">Record wet weight now</span>
          </label>
          {recordWet && (
            <div className="pl-6 space-y-1.5">
              <div className="relative">
                <Input
                  type="number" step="0.1" min="0"
                  value={wetWeight}
                  onChange={(e) => setWetWeight(e.target.value)}
                  placeholder="0.0"
                  className="font-mono pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">grams</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">
                  Weigh fresh-cut + stems. Dry weight gets recorded when you move to Inventory.
                </span>
                <button
                  type="button"
                  disabled
                  title="Bluetooth scale integration — coming soon"
                  className="text-primary/60 cursor-not-allowed"
                >
                  📡 Read from scale
                </button>
              </div>
            </div>
          )}
        </div>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Harvest conditions, trim team, observations…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </Field>

        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-foreground">
          Plants in this cycle will be flipped to <span className="font-mono font-semibold">ccrs_plant_state = Harvested</span>.
          The cycle enters the <span className="font-semibold">harvesting</span> phase until you finalize the harvest in the Inventory column.
        </div>
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
