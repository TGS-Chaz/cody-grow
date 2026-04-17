import { useMemo, useState, useEffect } from "react";
import { FolderOpen, Folder, FileText, FileImage, FileSpreadsheet, File as FileIcon, Upload, Plus, Trash2, LayoutGrid, List as ListIcon, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import { useDocuments, useFolderBreadcrumbs, useUploadDocument, useCreateFolder, useDeleteDocument, GrowDocument, UploadDocumentInput } from "@/hooks/useDocuments";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = [
  "Compliance", "Lab Results", "Invoices", "Insurance", "Training", "SOPs", "Contracts", "Permits", "Misc",
];

const CATEGORY_COLORS: Record<string, string> = {
  Compliance:  "bg-red-500/15 text-red-500",
  "Lab Results": "bg-purple-500/15 text-purple-500",
  Invoices:    "bg-emerald-500/15 text-emerald-500",
  Insurance:   "bg-blue-500/15 text-blue-500",
  Training:    "bg-amber-500/15 text-amber-500",
  SOPs:        "bg-cyan-500/15 text-cyan-500",
  Contracts:   "bg-orange-500/15 text-orange-500",
  Permits:     "bg-indigo-500/15 text-indigo-500",
  Misc:        "bg-muted text-muted-foreground",
};

function iconFor(doc: GrowDocument) {
  if (doc.is_folder) return Folder;
  const t = (doc.file_type ?? "").toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(t)) return FileImage;
  if (["csv", "xlsx", "xls"].includes(t)) return FileSpreadsheet;
  if (["pdf", "doc", "docx", "txt", "md"].includes(t)) return FileText;
  return FileIcon;
}

function formatBytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("list");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const { data: docs, loading, refresh } = useDocuments(folderId);
  const crumbs = useFolderBreadcrumbs(folderId);
  const upload = useUploadDocument();
  const createFolder = useCreateFolder();
  const del = useDeleteDocument();

  const stats = useMemo(() => {
    const total = docs.length;
    const files = docs.filter((d) => !d.is_folder).length;
    const folders = docs.filter((d) => d.is_folder).length;
    const now = Date.now();
    const expiring = docs.filter((d) => d.expires_at && new Date(d.expires_at).getTime() - now < 30 * 86400000 && new Date(d.expires_at).getTime() > now).length;
    const expired = docs.filter((d) => d.expires_at && new Date(d.expires_at).getTime() < now).length;
    const byCategory = new Map<string, number>();
    for (const d of docs) {
      const k = d.document_category ?? "Uncategorized";
      byCategory.set(k, (byCategory.get(k) ?? 0) + 1);
    }
    return { total, files, folders, expiring, expired, byCategory };
  }, [docs]);

  const handleUpload = async (input: UploadDocumentInput) => {
    try {
      await upload({ ...input, folder_id: folderId });
      toast.success("Uploaded");
      refresh();
    } catch (err: any) { toast.error(err?.message ?? "Upload failed"); }
  };

  const handleNewFolder = async (name: string) => {
    try {
      await createFolder(name, folderId);
      toast.success("Folder created");
      refresh();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  };

  const handleDelete = async (doc: GrowDocument) => {
    if (!window.confirm(`Delete "${doc.name}"?${doc.is_folder ? " All contents will be orphaned." : ""}`)) return;
    try { await del(doc.id); toast.success("Deleted"); refresh(); }
    catch (err: any) { toast.error(err?.message ?? "Delete failed"); }
  };

  const columns: ColumnDef<GrowDocument>[] = useMemo(() => [
    {
      accessorKey: "name", header: "Name",
      cell: ({ row }) => {
        const Icon = iconFor(row.original);
        return (
          <button
            onClick={() => row.original.is_folder ? setFolderId(row.original.id) : (row.original.file_url && window.open(row.original.file_url, "_blank"))}
            className="flex items-center gap-2 text-[12px] font-medium hover:text-primary text-left"
          >
            <Icon className={cn("w-4 h-4 shrink-0", row.original.is_folder ? "text-amber-500" : "text-muted-foreground")} />
            <span className="truncate">{row.original.name}</span>
          </button>
        );
      },
    },
    {
      accessorKey: "document_category", header: "Category",
      cell: ({ row }) => row.original.document_category
        ? <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium uppercase tracking-wider", CATEGORY_COLORS[row.original.document_category] ?? CATEGORY_COLORS.Misc)}>{row.original.document_category}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "entity", header: "Linked to",
      cell: ({ row }) => row.original.entity_type
        ? <span className="text-[11px]">{row.original.entity_type}{row.original.entity_id ? ` · ${row.original.entity_id.slice(0, 8)}` : ""}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "file_size_bytes", header: "Size",
      cell: ({ row }) => row.original.is_folder ? <span className="text-muted-foreground">—</span> : <span className="font-mono text-[11px]">{formatBytes(row.original.file_size_bytes)}</span>,
    },
    {
      accessorKey: "expires_at", header: "Expires",
      cell: ({ row }) => {
        if (!row.original.expires_at) return <span className="text-muted-foreground">—</span>;
        const due = new Date(row.original.expires_at).getTime();
        const now = Date.now();
        const daysLeft = Math.floor((due - now) / 86400000);
        const color = daysLeft < 0 ? "text-destructive" : daysLeft <= 30 ? "text-amber-500" : "text-foreground";
        return <span className={cn("text-[11px]", color)}>{daysLeft < 0 ? `${-daysLeft}d overdue` : `${daysLeft}d left`}</span>;
      },
    },
    { accessorKey: "created_at", header: "Uploaded", cell: ({ row }) => row.original.created_at ? <DateTime value={row.original.created_at} format="date-only" className="text-[11px]" /> : "—" },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <button onClick={() => handleDelete(row.original)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </RowActionsCell>
      ),
    },
  ], []);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Documents"
        description="Centralized file management — compliance, lab reports, invoices, training"
        breadcrumbs={[{ label: "Compliance" }, { label: "Documents" }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
              <button onClick={() => setView("list")} className={cn("h-8 px-3 text-[12px] rounded-md flex items-center gap-1.5", view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}><ListIcon className="w-3.5 h-3.5" /> List</button>
              <button onClick={() => setView("grid")} className={cn("h-8 px-3 text-[12px] rounded-md flex items-center gap-1.5", view === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}><LayoutGrid className="w-3.5 h-3.5" /> Grid</button>
            </div>
            <Button variant="outline" onClick={() => setNewFolderOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> New Folder</Button>
            <Button onClick={() => setUploadOpen(true)} className="gap-1.5"><Upload className="w-3.5 h-3.5" /> Upload</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Files" value={stats.files} accentClass="stat-accent-teal" delay={0.05} />
        <StatCard label="Expiring ≤30d" value={stats.expiring} accentClass={stats.expiring > 0 ? "stat-accent-amber" : "stat-accent-emerald"} delay={0.1} />
        <StatCard label="Expired" value={stats.expired} accentClass={stats.expired > 0 ? "stat-accent-rose" : "stat-accent-emerald"} delay={0.15} />
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-[12px] mb-4 flex-wrap">
        <button onClick={() => setFolderId(null)} className="text-primary hover:underline inline-flex items-center gap-1">
          <FolderOpen className="w-3.5 h-3.5" /> All documents
        </button>
        {crumbs.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
            <button onClick={() => setFolderId(c.id)} className="text-primary hover:underline">{c.name}</button>
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents in this folder"
          description="Upload a compliance report, lab result, invoice, or any file. Organize with folders."
          primaryAction={<Button onClick={() => setUploadOpen(true)} className="gap-1.5"><Upload className="w-3.5 h-3.5" /> Upload First File</Button>}
        />
      ) : view === "list" ? (
        <DataTable columns={columns} data={docs} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {docs.map((d) => {
            const Icon = iconFor(d);
            const overdue = d.expires_at && new Date(d.expires_at).getTime() < Date.now();
            return (
              <button
                key={d.id}
                onClick={() => d.is_folder ? setFolderId(d.id) : d.file_url && window.open(d.file_url, "_blank")}
                className="rounded-xl border border-border bg-card hover:border-primary/30 p-4 flex flex-col items-center text-center gap-2 transition-colors"
              >
                <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", d.is_folder ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary")}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-[12px] font-medium truncate w-full">{d.name}</div>
                {d.document_category && (
                  <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", CATEGORY_COLORS[d.document_category] ?? CATEGORY_COLORS.Misc)}>{d.document_category}</span>
                )}
                {overdue && <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive"><AlertTriangle className="w-2.5 h-2.5" />Expired</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Category distribution */}
      {stats.byCategory.size > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 mt-6">
          <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">By category</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {Array.from(stats.byCategory.entries()).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
              <span key={cat} className={cn("inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium", CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Misc)}>
                {cat} <span className="font-mono font-bold ml-0.5">{n}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onUpload={handleUpload} />
      <NewFolderModal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} onCreate={handleNewFolder} />
    </div>
  );
}

// ─── Upload modal ──────────────────────────────────────────────────────────
function UploadModal({ open, onClose, onUpload }: { open: boolean; onClose: () => void; onUpload: (input: UploadDocumentInput) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null); setName(""); setCategory(""); setEntityType(""); setEntityId(""); setExpiresAt(""); setTags(""); setUploading(false);
  }, [open]);

  const handleFile = (f: File) => {
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^/.]+$/, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name required"); return; }
    setUploading(true);
    try {
      await onUpload({
        name: name.trim(),
        document_category: category || null,
        entity_type: entityType || null,
        entity_id: entityId || null,
        expires_at: expiresAt || null,
        tags: tags.trim() ? tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
        file,
      });
      onClose();
    } finally { setUploading(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<Upload className="w-4 h-4 text-primary" />} title="Upload document" subtitle="Attach a file to compliance, lab, invoice, or link to a specific entity." />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button type="submit" disabled={uploading} className="gap-1.5 min-w-[120px]">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          className="block rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer p-8 text-center bg-card/50"
        >
          {file ? (
            <div>
              <FileText className="w-10 h-10 mx-auto text-primary mb-2" />
              <div className="text-[13px] font-semibold truncate max-w-[300px] mx-auto">{file.name}</div>
              <div className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</div>
            </div>
          ) : (
            <div>
              <Upload className="w-10 h-10 mx-auto text-muted-foreground/60 mb-2" />
              <div className="text-[13px] font-semibold">Drop or click to select</div>
              <div className="text-[10px] text-muted-foreground">Up to 50 MB</div>
            </div>
          )}
          <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </label>

        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— None —</option>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Expiration date</label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Linked entity type</label>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— None —</option>
              <option value="account">Account</option>
              <option value="facility">Facility</option>
              <option value="employee">Employee</option>
              <option value="batch">Batch</option>
              <option value="manifest">Manifest</option>
              <option value="harvest">Harvest</option>
              <option value="cycle">Cycle</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Entity ID</label>
            <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="UUID (optional)" className="font-mono" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Tags <span className="text-muted-foreground/60">(comma-separated)</span></label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="audit-2026, annual, signed" />
        </div>
      </div>
    </ScrollableModal>
  );
}

function NewFolderModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  useEffect(() => { if (open) setName(""); }, [open]);
  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreate(name.trim());
    onClose();
  };
  return (
    <ScrollableModal
      open={open} onClose={onClose} size="sm" onSubmit={handle}
      header={<ModalHeader icon={<Folder className="w-4 h-4 text-amber-500" />} title="New folder" subtitle="Organize documents by project, year, or category" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!name.trim()}>Create</Button>
        </>
      }
    >
      <div className="p-6">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Folder name" />
      </div>
    </ScrollableModal>
  );
}
