import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertOctagon, Plus, ShieldCheck, CheckCircle2, XCircle, Eye, Loader2, X,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import StatusPill from "@/components/shared/StatusPill";
import DateTime from "@/components/shared/DateTime";
import CopyableId from "@/components/shared/CopyableId";
import { useCodyContext } from "@/hooks/useCodyContext";
import { useRecalls, useRecallStats, useCreateRecall, Recall, CreateRecallInput } from "@/hooks/useRecalls";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  class_i: { bg: "bg-red-500/15", text: "text-red-500" },
  class_ii: { bg: "bg-amber-500/15", text: "text-amber-500" },
  class_iii: { bg: "bg-yellow-500/15", text: "text-yellow-500" },
};
const SEVERITY_LABEL: Record<string, string> = { class_i: "Class I", class_ii: "Class II", class_iii: "Class III" };

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  voluntary: { bg: "bg-blue-500/15", text: "text-blue-500" },
  mandatory: { bg: "bg-red-500/15", text: "text-red-500" },
  precautionary: { bg: "bg-amber-500/15", text: "text-amber-500" },
};

export default function RecallsPage() {
  const navigate = useNavigate();
  const { data: recalls, loading, refresh } = useRecalls();
  const stats = useRecallStats(recalls);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { setContext, clearContext } = useCodyContext();
  useEffect(() => {
    setContext({ context_type: "recalls_list", page_data: { stats } });
    return () => clearContext();
  }, [setContext, clearContext, stats]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recalls;
    return recalls.filter((r) => `${r.recall_number} ${r.reason}`.toLowerCase().includes(q));
  }, [recalls, search]);

  const columns: ColumnDef<Recall>[] = useMemo(() => [
    { accessorKey: "recall_number", header: "Recall #", cell: ({ row }) => <button onClick={() => navigate(`/compliance/recalls/${row.original.id}`)} className="text-[12px] font-semibold text-primary hover:underline text-left"><CopyableId value={row.original.recall_number} className="text-[11px]" /></button> },
    { accessorKey: "recall_type", header: "Type", cell: ({ row }) => {
      const t = row.original.recall_type ?? "voluntary";
      const c = TYPE_COLORS[t] ?? { bg: "bg-muted", text: "text-muted-foreground" };
      return <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wider", c.bg, c.text)}>{t}</span>;
    } },
    { accessorKey: "severity", header: "Severity", cell: ({ row }) => {
      const s = row.original.severity ?? "class_iii";
      const c = SEVERITY_COLORS[s] ?? { bg: "bg-muted", text: "text-muted-foreground" };
      return <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wider", c.bg, c.text)}>{SEVERITY_LABEL[s] ?? s}</span>;
    } },
    { id: "batches", header: "Affected", cell: ({ row }) => <span className="font-mono text-[12px]">{(row.original.affected_batch_ids ?? []).length}</span> },
    { id: "accounts", header: "Accounts", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.affected_account_count ?? 0}</span> },
    { accessorKey: "wslcb_notified", header: "WSLCB", cell: ({ row }) => row.original.wslcb_notified ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-muted-foreground/40" /> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill label={row.original.status ?? "open"} variant={row.original.status === "resolved" ? "success" : row.original.status === "in_progress" ? "warning" : "critical"} /> },
    { accessorKey: "created_at", header: "Created", cell: ({ row }) => row.original.created_at ? <DateTime value={row.original.created_at} format="date-only" className="text-[12px]" /> : "—" },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => navigate(`/compliance/recalls/${row.original.id}`)} className="gap-1.5 h-7 text-[11px]">
          <Eye className="w-3 h-3" /> View
        </Button>
      ),
    },
  ], [navigate]);

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title="Recalls"
        description="Initiate and trace product recalls for compliance"
        breadcrumbs={[{ label: "Compliance" }, { label: "Recalls" }]}
        actions={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Initiate Recall</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Open" value={stats.open} accentClass="stat-accent-amber" delay={0.05} />
        <StatCard label="In Progress" value={stats.in_progress} accentClass="stat-accent-amber" delay={0.1} />
        <StatCard label="Resolved" value={stats.resolved} accentClass="stat-accent-emerald" delay={0.15} />
      </div>

      <FiltersBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search recall #, reason…" />

      <DataTable
        columns={columns} data={filtered} loading={loading}
        empty={{
          icon: AlertOctagon,
          title: recalls.length === 0 ? "No recalls yet" : "No matches",
          description: recalls.length === 0 ? "Initiate a recall when a product issue requires customer notification and return." : "Clear the search.",
          action: recalls.length === 0 ? <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Initiate Recall</Button> : undefined,
        }}
      />

      <CreateRecallModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={(r) => { refresh(); navigate(`/compliance/recalls/${r.id}`); }} />
    </div>
  );
}

function CreateRecallModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (r: any) => void }) {
  const { orgId } = useOrg();
  const createRecall = useCreateRecall();
  const [recallType, setRecallType] = useState<"voluntary" | "mandatory" | "precautionary">("voluntary");
  const [severity, setSeverity] = useState<"class_i" | "class_ii" | "class_iii">("class_iii");
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [batchSearch, setBatchSearch] = useState("");
  const [wslcbNotified, setWslcbNotified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batches, setBatches] = useState<Array<{ id: string; barcode: string; product_name: string | null }>>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    setRecallType("voluntary"); setSeverity("class_iii"); setReason(""); setDetail("");
    setBatchIds([]); setBatchSearch(""); setWslcbNotified(false);
    (async () => {
      const { data: rows } = await supabase.from("grow_batches").select("id, barcode, product_id").eq("org_id", orgId).order("created_at", { ascending: false }).limit(200);
      const productIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.product_id).filter(Boolean)));
      const { data: products } = productIds.length > 0 ? await supabase.from("grow_products").select("id, name").in("id", productIds) : { data: [] };
      const pById = new Map<string, any>((products ?? []).map((p: any) => [p.id, p.name]));
      setBatches(((rows ?? []) as any[]).map((r) => ({ id: r.id, barcode: r.barcode, product_name: r.product_id ? pById.get(r.product_id) ?? null : null })));
    })();
  }, [open, orgId]);

  const filteredBatches = useMemo(() => {
    const q = batchSearch.trim().toLowerCase();
    if (!q) return batches.slice(0, 20);
    return batches.filter((b) => `${b.barcode} ${b.product_name ?? ""}`.toLowerCase().includes(q)).slice(0, 20);
  }, [batches, batchSearch]);

  const toggleBatch = (id: string) => setBatchIds((x) => x.includes(id) ? x.filter((b) => b !== id) : [...x, id]);

  const valid = reason.trim().length > 0 && batchIds.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { toast.error("Reason + at least one batch required"); return; }
    setSaving(true);
    try {
      const input: CreateRecallInput = {
        recall_type: recallType, severity, reason: reason.trim(),
        detailed_description: detail.trim() || null,
        affected_batch_ids: batchIds, wslcb_notified: wslcbNotified,
      };
      const recall = await createRecall(input);
      toast.success(`Recall ${recall.recall_number} initiated`);
      onSuccess(recall);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<AlertOctagon className="w-4 h-4 text-destructive" />} title="Initiate recall" subtitle="Once initiated, customer notifications can be sent" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertOctagon className="w-3.5 h-3.5" />}
            Initiate
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required>
            <select value={recallType} onChange={(e) => setRecallType(e.target.value as any)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="voluntary">Voluntary</option>
              <option value="mandatory">Mandatory</option>
              <option value="precautionary">Precautionary</option>
            </select>
          </Field>
          <Field label="Severity" required>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as any)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="class_i">Class I (serious health risk)</option>
              <option value="class_ii">Class II (temporary health risk)</option>
              <option value="class_iii">Class III (no health risk)</option>
            </select>
          </Field>
        </div>
        <Field label="Reason" required>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="e.g. Failed pesticide panel" />
        </Field>
        <Field label="Detailed description">
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </Field>
        <Field label={`Affected batches (${batchIds.length} selected)`} required>
          <Input value={batchSearch} onChange={(e) => setBatchSearch(e.target.value)} placeholder="Search barcode or product…" className="mb-2" />
          <div className="rounded-lg border border-border max-h-56 overflow-y-auto">
            {filteredBatches.length === 0 ? (
              <div className="p-4 text-[12px] text-muted-foreground italic">No batches match.</div>
            ) : (
              filteredBatches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/30 cursor-pointer border-b border-border/50 last:border-0">
                  <input type="checkbox" checked={batchIds.includes(b.id)} onChange={() => toggleBatch(b.id)} className="w-4 h-4 rounded border-border accent-primary" />
                  <span className="font-mono text-[12px] flex-1 truncate">{b.barcode}</span>
                  <span className="text-[11px] text-muted-foreground truncate">{b.product_name ?? "—"}</span>
                </label>
              ))
            )}
          </div>
          {batchIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {batchIds.slice(0, 10).map((id) => {
                const b = batches.find((x) => x.id === id);
                return b ? <span key={id} className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] bg-primary/10 text-primary">{b.barcode}<button type="button" onClick={() => toggleBatch(id)}><X className="w-2.5 h-2.5" /></button></span> : null;
              })}
              {batchIds.length > 10 && <span className="text-[10px] text-muted-foreground">+{batchIds.length - 10} more</span>}
            </div>
          )}
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={wslcbNotified} onChange={(e) => setWslcbNotified(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
          <span className="text-[12px] font-medium">WSLCB notified</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
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
