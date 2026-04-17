import { useState, useEffect } from "react";
import { AlertTriangle, Sparkles, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { callEdgeFunction } from "@/lib/edge-function";

export interface CCRSFixSuggestion {
  root_cause: string;
  fix_instructions: string[];
  fields_to_correct: string[];
  suggested_values: Record<string, unknown>;
}

interface CCRSDiffViewerProps {
  open: boolean;
  onClose: () => void;
  /** The record that was submitted to CCRS (raw JSON). */
  submittedRecord: Record<string, unknown>;
  /** The error payload returned by CCRS. */
  errorDetails: unknown;
  /** Optional human-readable status label. */
  submissionStatus?: string | null;
}

/**
 * Side-by-side viewer for a rejected CCRS submission. Left pane shows the
 * submitted record, right pane shows the CCRS error + AI-generated fix. Fields
 * flagged by the AI as needing correction are highlighted in both panes.
 */
export default function CCRSDiffViewer(props: CCRSDiffViewerProps) {
  const { open, onClose, submittedRecord, errorDetails, submissionStatus } = props;
  const [suggestion, setSuggestion] = useState<CCRSFixSuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setSuggestion(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await callEdgeFunction<{ suggestion: CCRSFixSuggestion }>("ask-cody", {
          intent: "suggest_ccrs_fix",
          entity: submittedRecord,
          error_details: errorDetails,
        }, 60_000);
        if (cancelled) return;
        setSuggestion(res.suggestion);
      } catch (err: any) {
        if (!cancelled) toast.error(err?.message ?? "AI suggestion failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, submittedRecord, errorDetails]);

  const errorFields = new Set(suggestion?.fields_to_correct ?? []);
  const submittedEntries = Object.entries(submittedRecord ?? {});

  const errorText = typeof errorDetails === "string"
    ? errorDetails
    : JSON.stringify(errorDetails, null, 2);

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="lg"
      header={<ModalHeader icon={<AlertTriangle className="w-4 h-4 text-destructive" />} title="CCRS submission rejected" subtitle={`Status: ${submissionStatus ?? "rejected"}. Compare the submitted record against WSLCB's rejection and Cody's suggested fix.`} />}
      footer={<Button type="button" variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left — submitted record */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">Submitted record</h3>
          {submittedEntries.length === 0 ? (
            <p className="text-[12px] text-muted-foreground italic">No submitted record attached.</p>
          ) : (
            <div className="space-y-1">
              {submittedEntries.map(([k, v]) => {
                const flagged = errorFields.has(k);
                return (
                  <div
                    key={k}
                    className={`grid grid-cols-[120px_1fr] gap-2 py-1 px-2 rounded text-[11px] ${flagged ? "bg-destructive/10 border border-destructive/30" : ""}`}
                  >
                    <span className="font-mono text-muted-foreground">{k}</span>
                    <span className="font-mono truncate" title={String(v ?? "")}>{formatValue(v)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right — error + AI suggestion */}
        <div className="space-y-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              <h3 className="text-[11px] uppercase tracking-wider font-semibold text-destructive">CCRS error</h3>
            </div>
            <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-foreground">{errorText}</pre>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-[11px] uppercase tracking-wider font-semibold text-primary">Cody's fix suggestion</h3>
              {loading && <Loader2 className="w-3 h-3 animate-spin text-primary ml-auto" />}
            </div>
            {loading ? (
              <p className="text-[12px] text-muted-foreground italic">Analyzing the rejection…</p>
            ) : suggestion ? (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Root cause</div>
                  <p className="text-[12px]">{suggestion.root_cause}</p>
                </div>
                {suggestion.fix_instructions.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Fix steps</div>
                    <ol className="text-[12px] space-y-1 list-decimal list-inside">
                      {suggestion.fix_instructions.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </div>
                )}
                {Object.keys(suggestion.suggested_values ?? {}).length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Suggested values</div>
                    <div className="rounded-lg bg-background/60 border border-border overflow-hidden">
                      <table className="w-full text-[11px]">
                        <tbody>
                          {Object.entries(suggestion.suggested_values).map(([field, val]) => {
                            const oldV = (submittedRecord as any)[field];
                            return (
                              <tr key={field} className="border-t border-border first:border-0">
                                <td className="px-2 py-1 font-mono font-semibold">{field}</td>
                                <td className="px-2 py-1 font-mono text-rose-500 line-through max-w-[120px] truncate">{formatValue(oldV)}</td>
                                <td className="px-1 text-muted-foreground"><ArrowRight className="w-3 h-3 inline" /></td>
                                <td className="px-2 py-1 font-mono text-emerald-500 max-w-[140px] truncate">{formatValue(val)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-border/50 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Apply the fix on the source record, then re-upload the CSV.
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground italic">Cody couldn't generate a suggestion for this rejection.</p>
            )}
          </div>
        </div>
      </div>
    </ScrollableModal>
  );
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
