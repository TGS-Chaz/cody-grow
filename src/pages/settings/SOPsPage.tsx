import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, History, Eye, Edit, RotateCcw, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import DateTime from "@/components/shared/DateTime";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import { useSops, useSOPVersionHistory, useCreateSopVersion, useRestoreSopVersion, SOP, SOPInput } from "@/hooks/useSops";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import type { ColumnDef } from "@tanstack/react-table";

export default function SOPsPage() {
  const { orgId } = useOrg();
  const { data: sops, loading, refresh } = useSops();
  const createVersion = useCreateSopVersion();

  const [editing, setEditing] = useState<SOP | null>(null);
  const [creating, setCreating] = useState(false);
  const [historyFor, setHistoryFor] = useState<SOP | null>(null);

  const columns: ColumnDef<SOP>[] = useMemo(() => [
    { accessorKey: "title", header: "Title", cell: ({ row }) => <button onClick={() => setEditing(row.original)} className="text-[13px] font-medium text-primary hover:underline">{row.original.title}</button> },
    { accessorKey: "category", header: "Category", cell: ({ row }) => row.original.category
      ? <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">{row.original.category}</span>
      : <span className="text-muted-foreground">—</span> },
    { accessorKey: "version", header: "Version", cell: ({ row }) => <span className="font-mono text-[12px]">v{row.original.version}</span> },
    { accessorKey: "is_published", header: "Status", cell: ({ row }) => row.original.is_published
      ? <StatusPill label="Published" variant="success" />
      : <StatusPill label="Draft" variant="muted" /> },
    { accessorKey: "effective_date", header: "Effective", cell: ({ row }) => row.original.effective_date ? <DateTime value={row.original.effective_date} format="date-only" className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "next_review_date", header: "Next review", cell: ({ row }) => row.original.next_review_date ? <DateTime value={row.original.next_review_date} format="date-only" className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setEditing(row.original)} className="h-7 px-2 text-[11px] gap-1"><Edit className="w-3 h-3" /> Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => setHistoryFor(row.original)} className="h-7 px-2 text-[11px] gap-1"><History className="w-3 h-3" /> History</Button>
        </div>
      ),
    },
  ], []);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="SOPs & Protocols"
        description="Standard operating procedures with version tracking"
        breadcrumbs={[{ label: "Settings", to: "/settings" }, { label: "SOPs" }]}
        actions={<Button onClick={() => setCreating(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> New SOP</Button>}
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : sops.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No SOPs yet"
          description="Document your standard operating procedures. Each edit creates a new version — old ones stay accessible."
          primaryAction={<Button onClick={() => setCreating(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create First SOP</Button>}
        />
      ) : (
        <DataTable columns={columns} data={sops} />
      )}

      <SOPEditModal
        open={!!editing || creating}
        onClose={() => { setEditing(null); setCreating(false); }}
        editing={editing}
        onSuccess={async (input) => {
          try {
            if (editing) {
              await createVersion(editing, input);
              toast.success(`New version saved — ${editing.title}`);
            } else if (orgId) {
              // Net-new SOP — insert version 1.0 directly
              const { error } = await supabase.from("grow_sops").insert({
                org_id: orgId,
                title: input.title,
                category: input.category ?? null,
                content: input.content ?? null,
                version: "1.0",
                is_current: true,
                is_published: input.is_published ?? true,
                effective_date: input.effective_date ?? new Date().toISOString().slice(0, 10),
                next_review_date: input.next_review_date ?? null,
              });
              if (error) throw error;
              toast.success("SOP created");
            }
            refresh();
          } catch (err: any) { toast.error(err?.message ?? "Save failed"); }
        }}
      />

      <SOPHistoryModal open={!!historyFor} onClose={() => setHistoryFor(null)} sop={historyFor} onChange={refresh} />
    </div>
  );
}

// ─── Edit / New modal ──────────────────────────────────────────────────────
function SOPEditModal({ open, onClose, editing, onSuccess }: {
  open: boolean; onClose: () => void; editing: SOP | null; onSuccess: (input: SOPInput) => Promise<void>;
}) {
  const [form, setForm] = useState<SOPInput>({ title: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        title: editing.title, category: editing.category, content: editing.content,
        effective_date: editing.effective_date, next_review_date: editing.next_review_date,
        is_published: editing.is_published ?? true,
      });
    } else {
      setForm({ title: "", is_published: true });
    }
  }, [open, editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    try { await onSuccess(form); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="lg" onSubmit={handleSubmit}
      header={<ModalHeader icon={<FileText className="w-4 h-4 text-primary" />} title={editing ? `Edit — ${editing.title} (v${editing.version})` : "New SOP"} subtitle={editing ? "Saving creates a new version. Old versions remain accessible." : "Initial version 1.0"} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {editing ? "Save new version" : "Create SOP"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Title</span>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Clone Propagation Protocol" autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Category</span>
            <Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value || null })} placeholder="Cultivation, QA, Safety…" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Effective date</span>
            <Input type="date" value={form.effective_date ?? ""} onChange={(e) => setForm({ ...form, effective_date: e.target.value || null })} />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Next review</span>
          <Input type="date" value={form.next_review_date ?? ""} onChange={(e) => setForm({ ...form, next_review_date: e.target.value || null })} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Content</span>
          <textarea
            value={form.content ?? ""}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={12}
            placeholder="Step-by-step procedure, approvals, equipment list, safety notes…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_published ?? true} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="w-4 h-4 rounded border-border accent-primary" />
          <span className="text-[12px]">Publish immediately (visible to employees)</span>
        </label>
      </div>
    </ScrollableModal>
  );
}

// ─── Version history modal ─────────────────────────────────────────────────
function SOPHistoryModal({ open, onClose, sop, onChange }: {
  open: boolean; onClose: () => void; sop: SOP | null; onChange: () => void;
}) {
  const { data: versions, loading } = useSOPVersionHistory(sop?.id);
  const restore = useRestoreSopVersion();
  const [viewing, setViewing] = useState<SOP | null>(null);

  if (!sop) return null;

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="lg"
      header={<ModalHeader icon={<History className="w-4 h-4 text-primary" />} title={`${sop.title} — version history`} subtitle="Click a version to view, or restore an older version to make it current." />}
      footer={<Button type="button" variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="p-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : viewing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold">v{viewing.version}</h3>
                <div className="text-[11px] text-muted-foreground">{viewing.created_at ? new Date(viewing.created_at).toLocaleString() : "—"}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setViewing(null)}>← Back</Button>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-[12px] font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
              {viewing.content || <span className="italic text-muted-foreground">No content stored for this version</span>}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className={`rounded-lg border p-3 flex items-center justify-between ${v.is_current ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-[13px]">v{v.version}</span>
                    {v.is_current && <StatusPill label="Current" variant="success" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Effective {v.effective_date ?? "—"}
                    {v.created_at && <> · Saved {new Date(v.created_at).toLocaleDateString()}</>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setViewing(v)} className="h-7 px-2 text-[11px] gap-1"><Eye className="w-3 h-3" /> View</Button>
                  {!v.is_current && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      try { await restore(v, sop.id); toast.success(`Restored v${v.version}`); onChange(); onClose(); }
                      catch (err: any) { toast.error(err?.message ?? "Restore failed"); }
                    }} className="h-7 px-2 text-[11px] gap-1"><RotateCcw className="w-3 h-3" /> Restore</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollableModal>
  );
}
