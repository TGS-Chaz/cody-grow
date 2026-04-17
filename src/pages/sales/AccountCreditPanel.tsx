import { useEffect, useState } from "react";
import { CreditCard, AlertOctagon, Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import { useCreditAccount, useUpsertCreditAccount, CreditAccount } from "@/hooks/useCredit";
import { cn } from "@/lib/utils";

const PAYMENT_TERMS = ["COD", "Net 15", "Net 30", "Net 45", "Net 60"];

export default function AccountCreditPanel({ accountId }: { accountId: string }) {
  const { data: credit, loading, refresh } = useCreditAccount(accountId);
  const [modalOpen, setModalOpen] = useState(false);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const limit = Number(credit?.credit_limit ?? 0);
  const balance = Number(credit?.current_balance ?? 0);
  const available = Math.max(0, limit - balance);
  const utilization = limit > 0 ? Math.min(1, balance / limit) : 0;
  const utilColor = utilization > 0.8 ? "bg-destructive" : utilization > 0.5 ? "bg-amber-500" : "bg-emerald-500";
  const utilTextColor = utilization > 0.8 ? "text-destructive" : utilization > 0.5 ? "text-amber-500" : "text-emerald-500";

  if (!credit || limit === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={CreditCard}
          title="No credit terms set"
          description="Assign a credit limit and payment terms for this account to track their line of credit."
          action={<Button onClick={() => setModalOpen(true)} className="gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Set Credit Limit</Button>}
        />
        <CreditModal open={modalOpen} onClose={() => setModalOpen(false)} accountId={accountId} existing={credit} onSuccess={() => refresh()} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {credit.credit_hold && (
        <div className="rounded-xl border-2 border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-[13px] font-bold text-destructive">Credit Hold</div>
            {credit.credit_hold_reason && <div className="text-[12px] mt-1">{credit.credit_hold_reason}</div>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Credit Limit" value={`$${limit.toLocaleString()}`} />
        <Metric label="Current Balance" value={`$${balance.toFixed(2)}`} color={utilTextColor} />
        <Metric label="Available Credit" value={`$${available.toFixed(2)}`} color={available > 0 ? "text-emerald-500" : "text-destructive"} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Utilization</span>
          <span className={cn("text-[12px] font-mono font-bold", utilTextColor)}>{Math.round(utilization * 100)}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full transition-all", utilColor)} style={{ width: `${Math.max(2, utilization * 100)}%` }} />
        </div>
        {utilization > 0.8 && <p className="text-[11px] text-destructive mt-2">This account is near or over their credit limit. Review before accepting new orders.</p>}
        {(credit.past_due_balance ?? 0) > 0 && <p className="text-[11px] text-amber-500 mt-2">Past due: ${Number(credit.past_due_balance ?? 0).toFixed(2)}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Terms</h3>
          <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>Edit</Button>
        </div>
        <dl className="divide-y divide-border/50">
          <Row label="Payment terms" value={credit.payment_terms ?? credit.payment_terms_custom ?? "—"} />
          <Row label="Last payment" value={credit.last_payment_at
            ? <span><DateTime value={credit.last_payment_at} format="date-only" /> · ${Number(credit.last_payment_amount ?? 0).toFixed(2)}</span>
            : <span className="text-muted-foreground italic">Never</span>} />
          <Row label="Credit hold" value={credit.credit_hold
            ? <span className="inline-flex items-center gap-1 text-destructive"><Lock className="w-3 h-3" /> Yes</span>
            : <span className="inline-flex items-center gap-1 text-emerald-500"><Unlock className="w-3 h-3" /> No</span>} />
        </dl>
      </div>

      <CreditModal open={modalOpen} onClose={() => setModalOpen(false)} accountId={accountId} existing={credit} onSuccess={() => refresh()} />
    </div>
  );
}

function CreditModal({ open, onClose, accountId, existing, onSuccess }: { open: boolean; onClose: () => void; accountId: string; existing: CreditAccount | null; onSuccess?: () => void }) {
  const upsert = useUpsertCreditAccount();
  const [limit, setLimit] = useState("");
  const [terms, setTerms] = useState("Net 30");
  const [hold, setHold] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLimit(String(existing?.credit_limit ?? ""));
    setTerms(existing?.payment_terms ?? "Net 30");
    setHold(existing?.credit_hold ?? false);
    setHoldReason(existing?.credit_hold_reason ?? "");
  }, [open, existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await upsert({
        account_id: accountId,
        credit_limit: limit ? Number(limit) : null,
        payment_terms: terms,
        credit_hold: hold,
        credit_hold_reason: hold ? holdReason || null : null,
      });
      toast.success("Credit terms saved");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="sm" onSubmit={handleSubmit}
      header={<ModalHeader icon={<CreditCard className="w-4 h-4 text-primary" />} title="Credit terms" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
            Save
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Credit limit ($)">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">$</span>
            <Input type="number" min="0" step="100" value={limit} onChange={(e) => setLimit(e.target.value)} className="font-mono pl-6" />
          </div>
        </Field>
        <Field label="Payment terms">
          <select value={terms} onChange={(e) => setTerms(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
          <span className="text-[12px] font-medium">Put this account on credit hold</span>
        </label>
        {hold && (
          <Field label="Hold reason">
            <Input value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="e.g. Past due 60+ days" />
          </Field>
        )}
      </div>
    </ScrollableModal>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-[20px] font-bold font-mono tabular-nums", color)}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 px-5 py-2.5">
      <dt className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</dt>
      <dd className="text-[12px] text-foreground">{value}</dd>
    </div>
  );
}
