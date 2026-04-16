import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download, Plus, Eye, CheckCircle, XCircle, Upload, FileText, Loader2, MoreHorizontal,
  Package, Building2,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import StatusPill from "@/components/shared/StatusPill";
import DateTime from "@/components/shared/DateTime";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useTransfers, useTransferStats, useCreateTransfer, useRejectTransfer, useImportFromWCIA,
  InboundTransfer, CreateTransferInput,
} from "@/hooks/useTransfers";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";

export default function TransfersPage() {
  const navigate = useNavigate();
  const { data: transfers, loading, refresh } = useTransfers();
  const stats = useTransferStats(transfers);
  const reject = useRejectTransfer();

  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const { setContext, clearContext } = useCodyContext();
  useEffect(() => {
    setContext({
      context_type: "transfers_list",
      page_data: {
        stats,
        transfers: transfers.slice(0, 20).map((t) => ({
          from: t.origin_license_name, status: t.status, items: t.item_count, source: t.source,
        })),
      },
    });
    return () => clearContext();
  }, [setContext, clearContext, stats, transfers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transfers;
    return transfers.filter((t) => `${t.origin_license_number} ${t.origin_license_name ?? ""}`.toLowerCase().includes(q));
  }, [transfers, search]);

  const columns: ColumnDef<InboundTransfer>[] = useMemo(() => [
    { accessorKey: "external_id", header: "Transfer ID", cell: ({ row }) => <button onClick={() => navigate(`/sales/transfers/${row.original.id}`)} className="font-mono text-[11px] text-primary hover:underline">{row.original.external_id.slice(-8)}</button> },
    { accessorKey: "origin_license_number", header: "From License", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.origin_license_number}</span> },
    { accessorKey: "origin_license_name", header: "From Name", cell: ({ row }) => row.original.origin_license_name ?? <span className="text-muted-foreground">—</span> },
    { id: "source", header: "Source", cell: ({ row }) => <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">{row.original.source === "wcia" ? "WCIA JSON" : "Manual"}</span> },
    { id: "items", header: "Items", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.item_count ?? 0}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => {
      const s = row.original.status ?? "in_transit";
      const variant: any = s === "accepted" ? "success" : s === "rejected" || s === "cancelled" ? "critical" : "warning";
      return <StatusPill label={s.replace(/_/g, " ")} variant={variant} />;
    } },
    { accessorKey: "arrival_datetime", header: "Received", cell: ({ row }) => row.original.arrival_datetime ? <DateTime value={row.original.arrival_datetime} format="date-only" className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/sales/transfers/${row.original.id}`)}><Eye className="w-3.5 h-3.5" /> View</DropdownMenuItem>
              {row.original.status !== "accepted" && row.original.status !== "rejected" && (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/sales/transfers/${row.original.id}?accept=1`)}><CheckCircle className="w-3.5 h-3.5" /> Accept</DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => { try { await reject(row.original.id); toast.success("Rejected"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate]);

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title="Inbound Transfers"
        description="Receive inventory from other licensees"
        breadcrumbs={[{ label: "Sales & Fulfillment" }, { label: "Inbound Transfers" }]}
        actions={<Button onClick={() => setImportOpen(true)} className="gap-1.5"><Upload className="w-3.5 h-3.5" /> Import from WCIA JSON</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Pending" value={stats.pending} accentClass="stat-accent-amber" delay={0.05} />
        <StatCard label="Accepted" value={stats.accepted} accentClass="stat-accent-emerald" delay={0.1} />
      </div>

      <FiltersBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search origin license, name…" />

      <DataTable
        columns={columns} data={filtered} loading={loading}
        empty={{
          icon: Download,
          title: transfers.length === 0 ? "No inbound transfers yet" : "No matches",
          description: transfers.length === 0 ? "Import from WCIA JSON when another licensee ships you inventory." : "Clear filters or adjust the search.",
          action: transfers.length === 0 ? <Button onClick={() => setImportOpen(true)} className="gap-1.5"><Upload className="w-3.5 h-3.5" /> Import from WCIA JSON</Button> : undefined,
        }}
      />

      <ImportTransferModal open={importOpen} onClose={() => setImportOpen(false)} onSuccess={() => refresh()} />
    </div>
  );
}

// ─── Import WCIA Modal ──────────────────────────────────────────────────────
function ImportTransferModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess?: () => void }) {
  const { orgId } = useOrg();
  const importFromWCIA = useImportFromWCIA();
  const createTransfer = useCreateTransfer();
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ourLicense, setOurLicense] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !orgId) return;
    setJsonText(""); setError(null);
    (async () => {
      const { data } = await supabase.from("grow_facilities").select("license_number, is_primary").eq("org_id", orgId);
      const primary = (data ?? []).find((f: any) => f.is_primary) ?? (data ?? [])[0];
      setOurLicense((primary as any)?.license_number ?? "");
    })();
  }, [open, orgId]);

  const parsed = useMemo(() => {
    if (!jsonText.trim()) return null;
    try { return JSON.parse(jsonText); } catch (err: any) { setError(err?.message ?? "Invalid JSON"); return null; }
  }, [jsonText]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setJsonText(String(reader.result));
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed) { toast.error("Paste WCIA JSON first"); return; }
    setSaving(true);
    try {
      const input = await importFromWCIA(parsed, ourLicense);
      await createTransfer(input as CreateTransferInput);
      toast.success("Transfer imported", { description: `${input.items.length} item(s) staged for acceptance` });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Import failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<Upload className="w-4 h-4 text-purple-500" />} title="Import WCIA transfer" subtitle="Paste or upload the JSON shared by the sending licensee" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!parsed || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Import
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="flex items-center justify-between">
            <span className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">WCIA JSON</span>
            <label className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer">
              <Upload className="w-3 h-3" /> Upload file
              <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </label>
          </label>
          <textarea value={jsonText} onChange={(e) => { setJsonText(e.target.value); setError(null); }} rows={10} placeholder='{"manifest": {...}, "origin": {...}, "items": [...]}' className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Our license #</label>
          <Input value={ourLicense} onChange={(e) => setOurLicense(e.target.value)} className="font-mono" />
        </div>
        {parsed?.items && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preview</h3>
            <div className="text-[12px]">
              <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> From: {parsed.origin?.licenseeName ?? "—"} ({parsed.origin?.licenseNumber ?? "—"})</div>
              <div className="flex items-center gap-2"><Package className="w-3.5 h-3.5" /> {parsed.items.length} item{parsed.items.length === 1 ? "" : "s"}</div>
            </div>
          </div>
        )}
      </div>
    </ScrollableModal>
  );
}

void FileText;
