import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import { useCreateAccount, useUpdateAccount, Account, AccountInput } from "@/hooks/useAccounts";
import { useAccountStatuses } from "@/hooks/useAccountStatuses";
import { useRoutes } from "@/hooks/useRoutes";
import { cn } from "@/lib/utils";

const LICENSE_TYPES = [
  { value: "retailer", label: "Retailer" },
  { value: "producer", label: "Producer" },
  { value: "processor", label: "Processor" },
  { value: "producer_processor", label: "Producer/Processor" },
  { value: "transporter", label: "Transporter" },
  { value: "lab", label: "Lab" },
  { value: "other", label: "Other" },
];

const PAYMENT_TERMS = ["COD", "Net 15", "Net 30", "Net 45", "Net 60"];
const DELIVERY_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function AccountModal({ open, onClose, onSuccess, account }: {
  open: boolean; onClose: () => void; onSuccess?: (a: Account) => void; account?: Account | null;
}) {
  const { orgId } = useOrg();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const { data: statuses } = useAccountStatuses();
  const { data: routes } = useRoutes();

  const [form, setForm] = useState<AccountInput>({ company_name: "" });
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reps, setReps] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([]);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    setShowAll(false);
    if (account) {
      setForm({
        company_name: account.company_name,
        license_number: account.license_number,
        license_type: account.license_type,
        dba: account.dba,
        primary_contact_name: account.primary_contact_name,
        primary_contact_email: account.primary_contact_email,
        primary_contact_phone: account.primary_contact_phone,
        address_line1: account.address_line1,
        address_line2: account.address_line2,
        city: account.city,
        state: account.state ?? "WA",
        zip: account.zip,
        workflow_status_id: account.workflow_status_id,
        route_id: account.route_id,
        assigned_rep_id: account.assigned_rep_id,
        account_group_id: account.account_group_id,
        payment_terms: account.payment_terms,
        label_barcode_preference: account.label_barcode_preference,
        is_non_cannabis: account.is_non_cannabis ?? false,
        is_active: account.is_active ?? true,
      });
    } else {
      setForm({ company_name: "", state: "WA", is_active: true });
    }
    (async () => {
      const [repsRes, groupsRes] = await Promise.all([
        supabase.from("organization_members").select("id, full_name, email").eq("org_id", orgId),
        supabase.from("grow_account_groups").select("id, name").eq("org_id", orgId).order("name"),
      ]);
      setReps((repsRes.data ?? []) as any);
      setGroups((groupsRes.data ?? []) as any);
    })();
  }, [open, orgId, account]);

  const valid = form.company_name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { toast.error("Company name required"); return; }
    setSaving(true);
    try {
      let result: Account;
      if (account) {
        await updateAccount(account.id, form);
        result = { ...account, ...form } as Account;
        toast.success("Account updated");
      } else {
        result = await createAccount(form);
        toast.success(`${result.company_name} created`);
      }
      onSuccess?.(result);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed");
    } finally { setSaving(false); }
  };

  const setField = <K extends keyof AccountInput>(k: K, v: AccountInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="md"
      onSubmit={handleSubmit}
      header={<ModalHeader icon={<Building2 className="w-4 h-4 text-primary" />} title={account ? "Edit account" : "Add account"} subtitle={account ? account.company_name : "A new wholesale customer"} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
            {account ? "Save" : "Create Account"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Company name" required>
          <Input value={form.company_name} onChange={(e) => setField("company_name", e.target.value)} placeholder="e.g. Yakima Valley Dispensary" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="License #"><Input value={form.license_number ?? ""} onChange={(e) => setField("license_number", e.target.value)} className="font-mono" placeholder="6-digit" /></Field>
          <Field label="License type">
            <select value={form.license_type ?? ""} onChange={(e) => setField("license_type", e.target.value || null)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— Select —</option>
              {LICENSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>

        <button type="button" onClick={() => setShowAll((v) => !v)} className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 pt-1">
          {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showAll ? "Hide all fields" : "Show all fields"}
        </button>

        <AnimatePresence initial={false}>
          {showAll && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="space-y-5 overflow-hidden">
              <Section title="Contact">
                <Field label="Primary contact name"><Input value={form.primary_contact_name ?? ""} onChange={(e) => setField("primary_contact_name", e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email"><Input type="email" value={form.primary_contact_email ?? ""} onChange={(e) => setField("primary_contact_email", e.target.value)} /></Field>
                  <Field label="Phone"><Input value={form.primary_contact_phone ?? ""} onChange={(e) => setField("primary_contact_phone", e.target.value)} /></Field>
                </div>
                <Field label="DBA"><Input value={form.dba ?? ""} onChange={(e) => setField("dba", e.target.value)} /></Field>
              </Section>

              <Section title="Address">
                <Field label="Line 1"><Input value={form.address_line1 ?? ""} onChange={(e) => setField("address_line1", e.target.value)} /></Field>
                <Field label="Line 2"><Input value={form.address_line2 ?? ""} onChange={(e) => setField("address_line2", e.target.value)} /></Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="City"><Input value={form.city ?? ""} onChange={(e) => setField("city", e.target.value)} /></Field>
                  <Field label="State"><Input value={form.state ?? ""} onChange={(e) => setField("state", e.target.value)} maxLength={2} /></Field>
                  <Field label="ZIP"><Input value={form.zip ?? ""} onChange={(e) => setField("zip", e.target.value)} /></Field>
                </div>
              </Section>

              <Section title="Assignment">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Status">
                    <select value={form.workflow_status_id ?? ""} onChange={(e) => setField("workflow_status_id", e.target.value || null)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">— None —</option>
                      {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Route">
                    <select value={form.route_id ?? ""} onChange={(e) => setField("route_id", e.target.value || null)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">— None —</option>
                      {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Sales rep">
                    <select value={form.assigned_rep_id ?? ""} onChange={(e) => setField("assigned_rep_id", e.target.value || null)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">— None —</option>
                      {reps.map((r) => <option key={r.id} value={r.id}>{r.full_name ?? r.email}</option>)}
                    </select>
                  </Field>
                  <Field label="Account group">
                    <select value={form.account_group_id ?? ""} onChange={(e) => setField("account_group_id", e.target.value || null)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">— None —</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </Field>
                </div>
              </Section>

              <Section title="Sales">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Payment terms">
                    <select value={form.payment_terms ?? ""} onChange={(e) => setField("payment_terms", e.target.value || null)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">— Select —</option>
                      {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Label/barcode preference"><Input value={form.label_barcode_preference ?? ""} onChange={(e) => setField("label_barcode_preference", e.target.value)} /></Field>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_non_cannabis ?? false} onChange={(e) => setField("is_non_cannabis", e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
                  <span className="text-[12px] font-medium">Non-cannabis account</span>
                </label>
              </Section>

              <Section title="Delivery">
                <Field label="Preferred delivery days">
                  <div className="flex gap-1 flex-wrap">
                    {DELIVERY_DAYS.map((d) => {
                      const current: string[] = (form as any).preferred_delivery_days ?? [];
                      const selected = current.includes(d);
                      return (
                        <button key={d} type="button" onClick={() => {
                          const next = selected ? current.filter((x) => x !== d) : [...current, d];
                          setField("preferred_delivery_days" as any, next as any);
                        }} className={cn("h-8 px-3 rounded-lg border text-[11px] font-semibold capitalize transition-all", selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")}>
                          {d.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Delivery window"><Input value={(form as any).preferred_delivery_window ?? ""} onChange={(e) => setField("preferred_delivery_window" as any, e.target.value as any)} placeholder="e.g. 9am-2pm" /></Field>
                <Field label="Default delivery notes">
                  <textarea
                    value={(form as any).default_delivery_notes ?? ""}
                    onChange={(e) => setField("default_delivery_notes" as any, e.target.value as any)}
                    rows={3}
                    placeholder="e.g. Ring bell at receiving dock. Ask for Chris. Park in loading zone C."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Auto-applied to new orders and manifests for this account.</p>
                </Field>
              </Section>

              <Section title="Menu push">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(form as any).menu_push_enabled ?? false}
                    onChange={(e) => setField("menu_push_enabled" as any, e.target.checked as any)}
                    className="w-4 h-4 mt-0.5 rounded border-border accent-primary"
                  />
                  <div>
                    <span className="text-[12px] font-medium">Auto-push live inventory</span>
                    <p className="text-[11px] text-muted-foreground">
                      When enabled, this account automatically receives a refreshed JSON menu whenever your inventory changes. Stable signed URL will be stored on the account record.
                    </p>
                  </div>
                </label>
              </Section>
            </motion.div>
          )}
        </AnimatePresence>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
