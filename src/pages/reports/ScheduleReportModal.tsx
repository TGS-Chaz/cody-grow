import { useEffect, useState } from "react";
import { Mail, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateSchedule, SavedReport } from "@/hooks/useReports";
import { cn } from "@/lib/utils";

const SCHEDULE_PRESETS = [
  { label: "Daily at 8am", cron: "0 8 * * *" },
  { label: "Every Monday at 8am", cron: "0 8 * * 1" },
  { label: "1st of each month at 8am", cron: "0 8 1 * *" },
  { label: "Custom", cron: "" },
];

export function ScheduleReportModal({ open, onClose, reports, initialReportId, onSuccess }: {
  open: boolean; onClose: () => void; reports: SavedReport[]; initialReportId?: string; onSuccess?: () => void;
}) {
  const createSchedule = useCreateSchedule();
  const [reportId, setReportId] = useState("");
  const [name, setName] = useState("");
  const [scheduleCron, setScheduleCron] = useState(SCHEDULE_PRESETS[1].cron);
  const [customCron, setCustomCron] = useState(false);
  const [format, setFormat] = useState<"csv" | "xlsx" | "pdf">("csv");
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReportId(initialReportId ?? "");
    setName("");
    setScheduleCron(SCHEDULE_PRESETS[1].cron);
    setCustomCron(false);
    setFormat("csv");
    setEmails([]); setEmailInput("");
    setIsActive(true);
  }, [open, initialReportId]);

  useEffect(() => {
    const r = reports.find((x) => x.id === reportId);
    if (r && !name) setName(`${r.name} (scheduled)`);
  }, [reportId, reports, name]);

  const addEmail = () => {
    const e = emailInput.trim();
    if (!e || emails.includes(e)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("Invalid email"); return; }
    setEmails((list) => [...list, e]);
    setEmailInput("");
  };
  const removeEmail = (e: string) => setEmails((list) => list.filter((x) => x !== e));

  const valid = !!reportId && !!name.trim() && !!scheduleCron.trim() && emails.length > 0;
  const canSchedule = !reportId.startsWith("prebuilt:");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { toast.error("Complete all required fields"); return; }
    if (!canSchedule) { toast.error("Favorite or customize this prebuilt report first to enable scheduling"); return; }
    setSaving(true);
    try {
      await createSchedule({
        name: name.trim(),
        report_id: reportId,
        schedule_cron: scheduleCron.trim(),
        format, recipient_emails: emails, is_active: isActive,
      });
      toast.success("Report scheduled");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Schedule failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<Mail className="w-4 h-4 text-primary" />} title="Schedule report" subtitle="Auto-email reports to recipients" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            Schedule
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Report" required>
          <select value={reportId} onChange={(e) => setReportId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Select report —</option>
            {reports.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {reportId.startsWith("prebuilt:") && (
            <p className="text-[11px] text-amber-500">Prebuilt reports must be favorited or customized before scheduling. Click the star on the card to materialize.</p>
          )}
        </Field>
        <Field label="Schedule name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly Monday report" />
        </Field>
        <Field label="Frequency" required>
          <div className="space-y-2">
            {SCHEDULE_PRESETS.map((p) => (
              <label key={p.label} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 cursor-pointer">
                <input type="radio" checked={!customCron && scheduleCron === p.cron} onChange={() => { setCustomCron(p.label === "Custom"); setScheduleCron(p.cron); }} className="accent-primary" />
                <span className="text-[12px] flex-1">{p.label}</span>
                {p.cron && <span className="font-mono text-[10px] text-muted-foreground">{p.cron}</span>}
              </label>
            ))}
            {customCron && (
              <Input value={scheduleCron} onChange={(e) => setScheduleCron(e.target.value)} className="font-mono mt-2" placeholder="0 8 * * *" />
            )}
          </div>
        </Field>
        <Field label="Format" required>
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 w-full">
            {(["csv", "xlsx", "pdf"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFormat(f)} className={cn("flex-1 h-9 text-[12px] font-medium rounded-md transition-colors uppercase", format === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {f}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Recipient emails" required>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }} placeholder="email@company.com" />
              <Button type="button" variant="outline" onClick={addEmail} disabled={!emailInput.trim()}><Plus className="w-3.5 h-3.5" /></Button>
            </div>
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {emails.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] bg-primary/10 text-primary">
                    {e}
                    <button type="button" onClick={() => removeEmail(e)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
          <span className="text-[12px] font-medium">Active (start immediately)</span>
        </label>
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
