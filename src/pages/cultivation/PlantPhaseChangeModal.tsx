import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowRight, Flower2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CCRS_GROWTH_STAGES, CcrsGrowthStage,
  CCRS_PLANT_STATES, CcrsPlantState,
} from "@/lib/schema-enums";
import { Plant, PhaseChangeInput, usePhaseChange } from "@/hooks/usePlants";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** One or more plants being phase-changed. */
  plants: Plant[];
  onSuccess?: () => void;
}

/** Valid forward transitions only — you can't un-flower a plant by changing
 * stage alone. Use the destroy flow for terminal state changes. */
const VALID_NEXT_STAGES: Record<CcrsGrowthStage, CcrsGrowthStage[]> = {
  Immature: ["Vegetative"],
  Vegetative: ["Flowering"],
  Flowering: [], // use Harvest (board flow) or Destroy for terminal transitions
};

export default function PlantPhaseChangeModal({ open, onClose, plants, onSuccess }: Props) {
  const phaseChange = usePhaseChange();
  const [stage, setStage] = useState<CcrsGrowthStage>("Vegetative");
  const [state, setState] = useState<CcrsPlantState>("Growing");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const isBulk = plants.length > 1;

  // Detect mixed current stages — common when user bulk-selects across
  // cohorts. We still allow the change but warn.
  const currentStages = useMemo(() => new Set(plants.map((p) => p.ccrs_growth_stage).filter(Boolean)), [plants]);
  const mixedStages = currentStages.size > 1;

  // Valid next-stage options based on current stage. For bulk selections with
  // mixed stages, fall back to the full stage list and let the server sort it
  // out (validation warns the user).
  const currentSharedStage = currentStages.size === 1 ? Array.from(currentStages)[0] as CcrsGrowthStage : null;
  const nextStages = useMemo(() => {
    if (currentSharedStage) return VALID_NEXT_STAGES[currentSharedStage];
    return [...CCRS_GROWTH_STAGES];
  }, [currentSharedStage]);

  useEffect(() => {
    if (!open) return;
    // Default: next valid stage if there is one, else keep current
    if (nextStages.length > 0) setStage(nextStages[0]);
    else if (currentSharedStage) setStage(currentSharedStage);
    setState("Growing");
    setDate(new Date().toISOString().slice(0, 16));
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plants.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const input: PhaseChangeInput = {
        growth_stage: stage,
        plant_state: state,
        phase_changed_at: new Date(date).toISOString(),
        notes: notes.trim() || undefined,
      };
      await phaseChange(plants.map((p) => p.id), input);
      toast.success(
        isBulk
          ? `${plants.length} plants moved to ${stage}`
          : `${plants[0].plant_identifier ?? "Plant"} moved to ${stage}`,
      );
      onSuccess?.();
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
          icon={<Flower2 className="w-4 h-4 text-primary" />}
          title={isBulk ? `Change phase for ${plants.length} plants` : "Change plant phase"}
          subtitle={isBulk ? "Applied to all selected plants" : plants[0]?.plant_identifier ?? ""}
        />
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving || nextStages.length === 0} className="min-w-[100px]">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        {isBulk && mixedStages && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2 text-[12px]">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
            <div>
              These plants are in <span className="font-semibold">mixed current stages</span>
              ({Array.from(currentStages).join(", ")}). The phase change will apply uniformly — review carefully.
            </div>
          </div>
        )}

        {!isBulk && plants[0] && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Current</p>
              <p className="text-[14px] font-semibold text-foreground">{plants[0].ccrs_growth_stage ?? "—"}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">New</p>
              <p className={cn("text-[14px] font-semibold", stage === "Flowering" ? "text-purple-500" : stage === "Vegetative" ? "text-emerald-500" : "text-blue-500")}>
                {stage}
              </p>
            </div>
          </div>
        )}

        {nextStages.length === 0 ? (
          <div className="rounded-lg bg-muted/30 border border-border p-3 text-[12px] text-muted-foreground">
            No forward phase transitions remain — this plant should be harvested (use the Grow Board) or destroyed.
          </div>
        ) : (
          <>
            <Field label="New Growth Stage" required>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as CcrsGrowthStage)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {nextStages.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="New Plant State" helper="Usually stays 'Growing' for stage changes">
              <select
                value={state}
                onChange={(e) => setState(e.target.value as CcrsPlantState)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CCRS_PLANT_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Phase Change Date">
              <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Height, node count, observations…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </Field>
          </>
        )}
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
