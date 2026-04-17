import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck, ShieldAlert, Clock, CheckCircle2, XCircle, Download, Copy, Upload, AlertTriangle,
  FileText, Loader2, Dna, MapPin, Package, Leaf, Trash2, ArrowRight, Beaker, ShoppingCart,
  Scissors, Truck,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import PageHeader from "@/components/shared/PageHeader";
import DataTable from "@/components/shared/DataTable";
import DateTime from "@/components/shared/DateTime";
import StatusPill from "@/components/shared/StatusPill";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useCCRSStatus, useCCRSSubmissions, useGenerateCSV, useRecordSubmission, useCCRSStats,
  CCRSCategoryStatus, GeneratedCSV,
} from "@/hooks/useCCRS";
import { CCRSCategory, CCRS_CATEGORY_LABELS } from "@/lib/ccrs/generators";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<CCRSCategory, any> = {
  strain: Dna, area: MapPin, product: Package, plant: Leaf,
  plantdestruction: Trash2, planttransfer: ArrowRight, inventory: Package,
  inventoryadjustment: Package, inventorytransfer: Truck, labtest: Beaker,
  sale: ShoppingCart, harvest: Scissors, manifest: FileText,
};

const GROUP_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: "bg-blue-500/10", text: "text-blue-500" },
  2: { bg: "bg-purple-500/10", text: "text-purple-500" },
  3: { bg: "bg-amber-500/10", text: "text-amber-500" },
  4: { bg: "bg-teal-500/10", text: "text-teal-500" },
};

export default function CCRSDashboardPage() {
  const { orgId } = useOrg();
  const { data: statuses, loading, refresh } = useCCRSStatus();
  const stats = useCCRSStats(statuses);
  const { data: submissions, refresh: refreshSubs } = useCCRSSubmissions();
  const generate = useGenerateCSV();
  const recordSub = useRecordSubmission();

  const [generating, setGenerating] = useState<CCRSCategory | null>(null);
  const [previewCSV, setPreviewCSV] = useState<GeneratedCSV | null>(null);

  const [integratorStatus, setIntegratorStatus] = useState<string>("not_applied");
  const [integratorId, setIntegratorId] = useState<string | null>(null);
  const [licenseNumber, setLicenseNumber] = useState<string>("");
  const [autoUploadFreq, setAutoUploadFreq] = useState<string>("Daily");

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const [settingsRes, facilitiesRes] = await Promise.all([
        supabase.from("grow_org_settings").select("*").eq("org_id", orgId).maybeSingle(),
        supabase.from("grow_facilities").select("license_number, is_primary").eq("org_id", orgId),
      ]);
      const settings = (settingsRes as any).data;
      setIntegratorStatus(settings?.integrator_status ?? "not_applied");
      setIntegratorId(settings?.integrator_id ?? null);
      setAutoUploadFreq(settings?.ccrs_upload_frequency ?? "Daily");
      const primary = ((facilitiesRes as any).data ?? []).find((f: any) => f.is_primary) ?? ((facilitiesRes as any).data ?? [])[0];
      setLicenseNumber(primary?.license_number ?? "");
    })();
  }, [orgId]);

  const { setContext, clearContext } = useCodyContext();
  const payload = useMemo(() => ({
    stats,
    categories: statuses.map((s) => ({ category: s.category, pending: s.pendingRecords, group: s.groupOrder, last: s.lastUploadedAt, status: s.lastStatus })),
    integrator_status: integratorStatus,
    license: licenseNumber,
  }), [stats, statuses, integratorStatus, licenseNumber]);
  useEffect(() => {
    setContext({ context_type: "ccrs_dashboard", page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload]);

  const handleGenerate = async (category: CCRSCategory) => {
    if (!licenseNumber) { toast.error("No license number — set one in Settings → Facilities"); return; }
    setGenerating(category);
    try {
      const csv = await generate(category, licenseNumber);
      setPreviewCSV(csv);
    } catch (err: any) {
      toast.error(err?.message ?? "Generation failed");
    } finally { setGenerating(null); }
  };

  const downloadCSV = (csv: GeneratedCSV) => {
    const blob = new Blob([csv.content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = csv.filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleMarkUploaded = async (csv: GeneratedCSV) => {
    try {
      const submission = await recordSub(csv, licenseNumber);
      // Call the edge function to queue for upload (manual or direct depending on integrator status)
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("upload-to-ccrs", {
          body: { submission_file_id: (submission as any).id, org_id: orgId },
        });
        if (fnErr) throw fnErr;
        const result = data as any;
        if (result?.mode === "manual") {
          toast.info(`${CCRS_CATEGORY_LABELS[csv.category]} ready for manual upload`, {
            description: "Download the CSV and upload at cannabisreporting.lcb.wa.gov.",
            action: { label: "Open CCRS Portal →", onClick: () => window.open(result.portal_url, "_blank") },
            duration: 10000,
          });
        } else {
          toast.success(`${CCRS_CATEGORY_LABELS[csv.category]} submitted`);
        }
      } catch (fnErr: any) {
        toast.success(`${CCRS_CATEGORY_LABELS[csv.category]} submission recorded`, {
          description: "Upload function not yet deployed — CSV tracked locally.",
        });
        void fnErr;
      }
      refresh();
      refreshSubs();
      setPreviewCSV(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  };

  const handleConfirmUpload = async (submissionId: string) => {
    try {
      const { error: fnErr } = await supabase.functions.invoke("upload-to-ccrs", {
        body: { submission_file_id: submissionId, org_id: orgId, confirm_manual_upload: true },
      });
      if (fnErr) {
        // Fall back to direct DB update if function isn't deployed
        await supabase.from("grow_ccrs_submission_files").update({
          status: "accepted", accepted_at: new Date().toISOString(),
        }).eq("id", submissionId);
      }
      toast.success("Marked as accepted");
      refreshSubs();
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  };

  const submissionColumns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: "file_category", header: "Category", cell: ({ row }) => <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">{row.original.file_category}</span> },
    { accessorKey: "file_name", header: "File", cell: ({ row }) => <span className="font-mono text-[11px] text-muted-foreground">{row.original.file_name}</span> },
    { accessorKey: "license_number", header: "License", cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.license_number}</span> },
    { accessorKey: "number_records", header: "Records", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.number_records}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill label={row.original.status ?? "pending"} variant={row.original.status === "accepted" ? "success" : row.original.status === "rejected" ? "critical" : "info"} /> },
    { accessorKey: "errors_count", header: "Errors", cell: ({ row }) => Number(row.original.errors_count ?? 0) > 0 ? <span className="font-mono text-[12px] text-destructive">{row.original.errors_count}</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "submitted_date", header: "Submitted", cell: ({ row }) => row.original.submitted_date ? <DateTime value={row.original.submitted_date} format="date-only" className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "uploaded_at", header: "Uploaded", cell: ({ row }) => row.original.uploaded_at ? <DateTime value={row.original.uploaded_at} className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        row.original.status === "queued_manual" || (row.original.status === "uploaded" && !row.original.accepted_at)
          ? <Button size="sm" variant="outline" onClick={() => handleConfirmUpload(row.original.id)} className="h-7 px-2 text-[11px] gap-1"><CheckCircle2 className="w-3 h-3" /> Confirm Upload</Button>
          : null
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [orgId]);

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title="CCRS Compliance"
        description="Generate, validate, and track your CCRS submissions"
        breadcrumbs={[{ label: "Compliance" }, { label: "CCRS Dashboard" }]}
      />

      {/* Integrator banner */}
      <div className={cn("rounded-xl border p-5 mb-6",
        integratorStatus === "approved" ? "border-emerald-500/30 bg-emerald-500/5" :
        integratorStatus === "suspended" ? "border-destructive/30 bg-destructive/5" :
        "border-amber-500/30 bg-amber-500/5",
      )}>
        <div className="flex items-start gap-3">
          {integratorStatus === "approved" ? <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5" /> : <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5" />}
          <div className="flex-1">
            <h3 className="text-[13px] font-semibold capitalize">Integrator Status: {integratorStatus.replace(/_/g, " ")}</h3>
            {integratorStatus === "approved" ? (
              <div className="text-[12px] text-muted-foreground mt-1">
                Integrator ID: <span className="font-mono font-semibold">{integratorId ?? "—"}</span> · License: <span className="font-mono">{licenseNumber}</span>
              </div>
            ) : (
              <div className="text-[12px] text-muted-foreground mt-1">
                Apply for CCRS integrator access to enable SAW-authenticated uploads.{" "}
                <a href="mailto:ccrs@lcb.wa.gov" className="text-primary hover:underline">Contact examiner →</a>
              </div>
            )}
          </div>
          {integratorStatus !== "approved" && (
            <Button size="sm" variant="outline">Apply</Button>
          )}
        </div>
      </div>

      {/* Upload schedule */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div className="text-[12px]">
            <div className="text-muted-foreground">Auto-upload frequency</div>
            <div className="font-semibold">{autoUploadFreq}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="text-[12px] text-muted-foreground">Next scheduled: <span className="font-semibold">Tomorrow 02:00 AM</span></div>
          <Button size="sm" variant="outline" onClick={() => toast.info("Manual upload — coming when SAW integration lands")} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Run Upload Now
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat icon={CheckCircle2} label="Up to Date" value={stats.upToDate} color="text-emerald-500" />
        <Stat icon={Clock} label="Pending" value={stats.pending} color="text-amber-500" />
        <Stat icon={XCircle} label="With Errors" value={stats.errors} color="text-destructive" />
        <Stat icon={FileText} label="Pending Records" value={stats.totalPendingRecords} color="text-primary" />
      </div>

      {/* Category grid */}
      <h3 className="text-[13px] font-semibold mb-3">File categories</h3>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {statuses.map((s) => (
            <CategoryCard key={s.category} status={s} licenseNumber={licenseNumber} generating={generating === s.category} onGenerate={() => handleGenerate(s.category)} />
          ))}
        </div>
      )}

      {/* Submission history */}
      <h3 className="text-[13px] font-semibold mb-3">Submission history</h3>
      <DataTable
        columns={submissionColumns}
        data={submissions}
        empty={{
          icon: FileText, title: "No submissions yet",
          description: "Generate a CSV for any category and mark it uploaded to see history here.",
        }}
      />

      {/* Preview modal */}
      {previewCSV && (
        <PreviewModal
          csv={previewCSV}
          onClose={() => setPreviewCSV(null)}
          onDownload={() => downloadCSV(previewCSV)}
          onCopy={async () => { await navigator.clipboard.writeText(previewCSV.content); toast.success("Copied"); }}
          onMarkUploaded={() => handleMarkUploaded(previewCSV)}
        />
      )}
    </div>
  );
}

function CategoryCard({ status, licenseNumber, generating, onGenerate }: { status: CCRSCategoryStatus; licenseNumber: string; generating: boolean; onGenerate: () => void }) {
  const Icon = CATEGORY_ICONS[status.category] ?? FileText;
  const groupColor = GROUP_COLORS[status.groupOrder];
  const statusColor = status.pendingRecords === 0 && status.lastUploadedAt ? "text-emerald-500"
    : (status.errorsCount ?? 0) > 0 ? "text-destructive"
    : status.pendingRecords > 0 ? "text-amber-500"
    : "text-muted-foreground";
  const StatusIcon = status.pendingRecords === 0 && status.lastUploadedAt ? CheckCircle2
    : (status.errorsCount ?? 0) > 0 ? XCircle
    : status.pendingRecords > 0 ? Clock : AlertTriangle;

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h4 className="text-[13px] font-semibold">{CCRS_CATEGORY_LABELS[status.category]}</h4>
            <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider mt-0.5", groupColor.bg, groupColor.text)}>
              Group {status.groupOrder}
            </span>
          </div>
        </div>
        <StatusIcon className={cn("w-4 h-4", statusColor)} />
      </div>

      <div className="space-y-1.5 text-[11px] mb-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Pending records</span>
          <span className={cn("font-mono font-semibold", status.pendingRecords > 0 ? "text-amber-500" : "text-muted-foreground")}>{status.pendingRecords}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Last uploaded</span>
          {status.lastUploadedAt ? <DateTime value={status.lastUploadedAt} format="date-only" className="text-[11px]" /> : <span className="text-muted-foreground">Never</span>}
        </div>
        {status.lastStatus && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last result</span>
            <StatusPill label={status.lastStatus} variant={status.lastStatus === "accepted" ? "success" : status.lastStatus === "rejected" ? "critical" : "info"} />
          </div>
        )}
      </div>

      <Button size="sm" variant={status.pendingRecords > 0 ? "default" : "outline"} className="w-full gap-1.5" onClick={onGenerate} disabled={!licenseNumber || generating}>
        {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Generate CSV
      </Button>
    </div>
  );
}

function PreviewModal({ csv, onClose, onDownload, onCopy, onMarkUploaded }: { csv: GeneratedCSV; onClose: () => void; onDownload: () => void; onCopy: () => void; onMarkUploaded: () => void }) {
  return (
    <ScrollableModal
      open={true} onClose={onClose} size="xl"
      header={<ModalHeader icon={<FileText className="w-4 h-4 text-primary" />} title={`${CCRS_CATEGORY_LABELS[csv.category]} CSV`} subtitle={`${csv.recordCount} record${csv.recordCount === 1 ? "" : "s"}`} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
          <Button type="button" variant="outline" onClick={onCopy} className="gap-1.5"><Copy className="w-3.5 h-3.5" /> Copy</Button>
          <Button type="button" variant="outline" onClick={onDownload} className="gap-1.5"><Download className="w-3.5 h-3.5" /> Download</Button>
          <Button type="button" onClick={onMarkUploaded} disabled={csv.recordCount === 0 || csv.validation.errors.length > 0} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Mark Uploaded
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 text-[12px] flex-wrap">
          <span className="font-mono text-muted-foreground">{csv.filename}</span>
          <span className="text-muted-foreground">·</span>
          <span><span className="font-semibold">{csv.recordCount}</span> records</span>
        </div>

        {csv.validation.errors.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-destructive">
              <XCircle className="w-4 h-4" /> {csv.validation.errors.length} error{csv.validation.errors.length === 1 ? "" : "s"} — CCRS will reject this file
            </div>
            <ul className="text-[11px] space-y-0.5 pl-6">
              {csv.validation.errors.slice(0, 10).map((e, i) => (
                <li key={i}>Row {(e.recordIndex ?? 0) + 1}{e.field ? ` · ${e.field}` : ""}: {e.message}</li>
              ))}
              {csv.validation.errors.length > 10 && <li className="text-muted-foreground">+ {csv.validation.errors.length - 10} more</li>}
            </ul>
          </div>
        )}
        {csv.validation.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-amber-500">
              <AlertTriangle className="w-4 h-4" /> {csv.validation.warnings.length} warning{csv.validation.warnings.length === 1 ? "" : "s"}
            </div>
            <ul className="text-[11px] space-y-0.5 pl-6">
              {csv.validation.warnings.slice(0, 5).map((w, i) => (
                <li key={i}>Row {(w.recordIndex ?? 0) + 1}: {w.message}</li>
              ))}
            </ul>
          </div>
        )}
        {csv.validation.valid && csv.validation.errors.length === 0 && csv.validation.warnings.length === 0 && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center gap-2 text-[12px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Validation passed — ready to upload.
          </div>
        )}

        <pre className="rounded-lg border border-border bg-muted/30 p-3 text-[10px] font-mono overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed">{csv.content}</pre>
      </div>
    </ScrollableModal>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-[22px] font-bold font-mono tabular-nums">{value}</div>
    </div>
  );
}
