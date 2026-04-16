import { useState, useEffect } from "react";
import { Loader2, Flower2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMoveCycleToFlowering, HydratedBoardCard } from "@/hooks/useGrowBoard";

interface Props {
  open: boolean;
  onClose: () => void;
  card: HydratedBoardCard;
  onSuccess: () => void;
}

/** Confirms moving a vegetative cycle into the flowering column.
 * Optionally lets the grower set / update the target harvest date here. */
export default function PhaseChangeModal({ open, onClose, card, onSuccess }: Props) {
  const moveToFlower = useMoveCycleToFlowering();
  const cycle = card.entity as any;
  const plantCount = card.extras.plant_count ?? 0;
  const [targetDate, setTargetDate] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Preload target harvest date: current value, or auto-compute from strain
    // average_flower_days. Flowering typically runs from today + avg flower days.
    if (cycle.target_harvest_date) {
      setTargetDate(cycle.target_harvest_date);
    } else if (card.strain?.average_flower_days) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + card.strain.average_flower_days);
      setTargetDate(d.toISOString().slice(0, 10));
    } else {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 65);
      setTargetDate(d.toISOString().slice(0, 10));
    }
  }, [open, cycle.target_harvest_date, card.strain?.average_flower_days]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await moveToFlower(cycle.id, card.card.id, { targetHarvestDate: targetDate || null });
      toast.success(`${cycle.name} moved to Flowering`, {
        description: `${plantCount} plant${plantCount === 1 ? "" : "s"} switched to CCRS Growth Stage "Flowering"`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Phase change failed");
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
          icon={<Flower2 className="w-4 h-4 text-purple-500" />}
          title="Move to Flowering"
          subtitle={cycle.name}
        />
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
            Confirm
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">From</p>
            <p className="text-[14px] font-semibold text-emerald-500">Vegetative</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">To</p>
            <p className="text-[14px] font-semibold text-purple-500">Flowering</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[12px] text-foreground mb-1">
            <span className="font-mono font-semibold">{plantCount}</span> plant{plantCount === 1 ? "" : "s"} will
            have <span className="font-mono">ccrs_growth_stage</span> flipped to{" "}
            <span className="font-mono font-semibold text-purple-500">Flowering</span>.
          </p>
          {card.strain && (
            <p className="text-[11px] text-muted-foreground">
              Strain: <span className="text-foreground font-medium">{card.strain.name}</span>
              {card.strain.average_flower_days && <> · avg flower {card.strain.average_flower_days}d</>}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
            Target Harvest Date
          </label>
          <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          <p className="text-[11px] text-muted-foreground/70">
            {card.strain?.average_flower_days
              ? `Auto-computed from strain's ${card.strain.average_flower_days}-day flower average. Override if needed.`
              : "Used for upcoming-harvest alerts on the board."}
          </p>
        </div>
      </div>
    </ScrollableModal>
  );
}
