import { useEffect, useState } from "react";
import { Loader2, MapPin, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import { Plant, useMovePlantArea } from "@/hooks/usePlants";

interface Props {
  open: boolean;
  onClose: () => void;
  plants: Plant[];
  onSuccess?: () => void;
}

interface AreaOption { id: string; name: string }

export default function MoveToAreaModal({ open, onClose, plants, onSuccess }: Props) {
  const move = useMovePlantArea();
  const { orgId } = useOrg();
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [target, setTarget] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !orgId) return;
    (async () => {
      const { data } = await supabase
        .from("grow_areas").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name");
      setAreas((data ?? []) as AreaOption[]);
    })();
  }, [open, orgId]);

  useEffect(() => {
    if (!open) return;
    setTarget("");
  }, [open]);

  const currentAreas = new Set(plants.map((p) => p.area?.name).filter(Boolean));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) { toast.error("Select a target area"); return; }
    setSaving(true);
    try {
      await move(plants.map((p) => p.id), target);
      const areaName = areas.find((a) => a.id === target)?.name ?? "new area";
      toast.success(
        plants.length > 1 ? `${plants.length} plants moved to ${areaName}` : `Plant moved to ${areaName}`,
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Move failed");
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
          icon={<MapPin className="w-4 h-4 text-primary" />}
          title={plants.length > 1 ? `Move ${plants.length} plants` : "Move plant"}
          subtitle="Reassign to a different area"
        />
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving || !target} className="min-w-[100px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
            Move
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        {currentAreas.size > 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-[12px]">
            <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground mb-1">Currently in</p>
            <p className="text-foreground">{Array.from(currentAreas).join(", ")}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
            Target Area <span className="text-destructive">*</span>
          </label>
          {areas.length === 0 ? (
            <div className="h-10 px-3 flex items-center text-[12px] text-muted-foreground border border-dashed border-border rounded-lg">
              No areas available
            </div>
          ) : (
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              autoFocus
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Select target area —</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
      </div>
    </ScrollableModal>
  );
}
