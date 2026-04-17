import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { callEdgeFunction } from "@/lib/edge-function";

export interface AIEditPatch {
  patch: Record<string, unknown>;
  rationale: string;
  confidence: "high" | "medium" | "low";
}

interface InlineAIEditProps<T extends Record<string, unknown>> {
  open: boolean;
  onClose: () => void;
  /** Human label, e.g. "account", "plant", "batch" */
  entityType: string;
  /** Current entity data */
  entity: T;
  /** Whitelist of fields the AI can modify */
  editableFields: Array<keyof T & string>;
  /** Called with the final merged entity when the user clicks Apply */
  onApply: (merged: T, patch: Record<string, unknown>) => Promise<void> | void;
  /** Optional — override the placeholder on the instruction input */
  placeholder?: string;
}

export default function InlineAIEdit<T extends Record<string, unknown>>(props: InlineAIEditProps<T>) {
  const { open, onClose, entityType, entity, editableFields, onApply, placeholder } = props;
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AIEditPatch | null>(null);
  const [applying, setApplying] = useState(false);

  const reset = () => { setInstruction(""); setSuggestion(null); setLoading(false); };

  const requestEdit = async () => {
    if (!instruction.trim()) return;
    setLoading(true);
    setSuggestion(null);
    try {
      const res = await callEdgeFunction<{ edit: AIEditPatch }>("ask-cody", {
        intent: "edit_entity",
        entity_type: entityType,
        entity,
        editable_fields: editableFields,
        instruction: instruction.trim(),
      }, 60_000);
      setSuggestion(res.edit);
    } catch (err: any) {
      toast.error(err?.message ?? "AI edit failed");
    } finally {
      setLoading(false);
    }
  };

  const applyPatch = async () => {
    if (!suggestion) return;
    const patch = suggestion.patch ?? {};
    // Drop keys that aren't in the whitelist — defensive even though the
    // edge function is instructed to respect editable_fields.
    const whitelist = new Set(editableFields);
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (whitelist.has(k as any)) sanitized[k] = v;
    }
    if (Object.keys(sanitized).length === 0) {
      toast.error("No editable fields were changed");
      return;
    }
    setApplying(true);
    try {
      const merged = { ...entity, ...sanitized } as T;
      await onApply(merged, sanitized);
      toast.success("Applied Cody's edit");
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const closeAndReset = () => { reset(); onClose(); };

  const diffEntries = suggestion ? Object.entries(suggestion.patch ?? {}) : [];

  return (
    <ScrollableModal
      open={open}
      onClose={closeAndReset}
      size="md"
      header={<ModalHeader icon={<Sparkles className="w-4 h-4 text-primary" />} title={`Edit ${entityType} with Cody`} subtitle="Describe the change in plain English. Cody proposes a patch you can review before applying." />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={closeAndReset} disabled={loading || applying}>Cancel</Button>
          {suggestion ? (
            <Button onClick={applyPatch} disabled={applying || diffEntries.length === 0} className="gap-1.5 min-w-[120px]">
              {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Apply changes
            </Button>
          ) : (
            <Button onClick={requestEdit} disabled={loading || !instruction.trim()} className="gap-1.5 min-w-[120px]">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Generate patch
            </Button>
          )}
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">What would you like to change?</label>
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !suggestion) requestEdit(); }}
            placeholder={placeholder ?? "e.g. mark as high priority and push delivery to next Thursday"}
            autoFocus
          />
          <p className="text-[10px] text-muted-foreground">Cody will only modify: {editableFields.join(", ")}</p>
        </div>

        {suggestion && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-primary">Proposed changes</span>
              <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wider ${suggestion.confidence === "high" ? "text-emerald-500" : suggestion.confidence === "medium" ? "text-amber-500" : "text-destructive"}`}>
                {suggestion.confidence} confidence
              </span>
            </div>
            <p className="text-[12px] text-foreground leading-relaxed">{suggestion.rationale}</p>
            {diffEntries.length === 0 ? (
              <div className="flex items-center gap-2 text-[12px] text-amber-500">
                <AlertTriangle className="w-3.5 h-3.5" />
                No fields changed — try a more specific instruction.
              </div>
            ) : (
              <div className="rounded-lg bg-background/50 border border-border overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">Field</th>
                      <th className="text-left px-3 py-1.5 font-medium">Current</th>
                      <th className="px-1"></th>
                      <th className="text-left px-3 py-1.5 font-medium">New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffEntries.map(([field, newVal]) => {
                      const oldVal = (entity as any)[field];
                      return (
                        <tr key={field} className="border-t border-border">
                          <td className="px-3 py-1.5 font-mono font-medium">{field}</td>
                          <td className="px-3 py-1.5 font-mono text-rose-500 line-through max-w-[180px] truncate">{formatVal(oldVal)}</td>
                          <td className="px-1 text-center"><ArrowRight className="w-3 h-3 text-muted-foreground inline-block" /></td>
                          <td className="px-3 py-1.5 font-mono text-emerald-500 max-w-[180px] truncate">{formatVal(newVal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollableModal>
  );
}

function formatVal(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
