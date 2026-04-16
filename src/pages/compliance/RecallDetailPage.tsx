import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertOctagon, Loader2, ShieldCheck, CheckCircle2, Send, Activity, Mail, XCircle, Building2,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import CopyableId from "@/components/shared/CopyableId";
import {
  useRecall, useAffectedOrders, useRecallNotifications, useSendRecallNotifications, useResolveRecall, useAcknowledgeNotification,
} from "@/hooks/useRecalls";
import { cn } from "@/lib/utils";

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  class_i: { bg: "bg-red-500/15", text: "text-red-500" },
  class_ii: { bg: "bg-amber-500/15", text: "text-amber-500" },
  class_iii: { bg: "bg-yellow-500/15", text: "text-yellow-500" },
};
const SEVERITY_LABEL: Record<string, string> = { class_i: "Class I", class_ii: "Class II", class_iii: "Class III" };

export default function RecallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const setActiveTab = (t: string) => { const next = new URLSearchParams(searchParams); next.set("tab", t); setSearchParams(next, { replace: true }); };

  const { data: recall, loading, refresh } = useRecall(id);
  const { data: affected, loading: affectedLoading } = useAffectedOrders(id);
  const { data: notifications, refresh: refreshNotifications } = useRecallNotifications(id);
  const sendNotifications = useSendRecallNotifications();
  const resolve = useResolveRecall();
  const ack = useAcknowledgeNotification();

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!recall) return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <EmptyState icon={AlertOctagon} title="Recall not found" description="This recall may have been deleted." primaryAction={<Button onClick={() => navigate("/compliance/recalls")}>← Back</Button>} />
    </div>
  );

  const severity = recall.severity ?? "class_iii";
  const sevColor = SEVERITY_COLORS[severity] ?? { bg: "bg-muted", text: "text-muted-foreground" };

  const handleSendAll = async () => {
    try {
      const count = await sendNotifications(recall.id, affected);
      toast.success(`${count} notification${count === 1 ? "" : "s"} sent`);
      refreshNotifications();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  };

  const handleResolve = async () => {
    try { await resolve(recall.id); toast.success("Recall resolved"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={recall.recall_number}
        breadcrumbs={[
          { label: "Compliance" },
          { label: "Recalls", to: "/compliance/recalls" },
          { label: recall.recall_number },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider", sevColor.bg, sevColor.text)}>{SEVERITY_LABEL[severity]}</span>
            <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">{recall.recall_type ?? "voluntary"}</span>
            <StatusPill label={recall.status ?? "open"} variant={recall.status === "resolved" ? "success" : recall.status === "in_progress" ? "warning" : "critical"} />
            {recall.status !== "resolved" && (
              <Button variant="outline" onClick={handleSendAll} disabled={affected.length === 0} className="gap-1.5"><Send className="w-3.5 h-3.5" /> Send Notifications ({affected.length})</Button>
            )}
            {recall.status !== "resolved" && <Button onClick={handleResolve} className="gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Resolve</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <InfoCard label="Affected Batches" value={(recall.affected_batch_ids ?? []).length} />
        <InfoCard label="Affected Accounts" value={recall.affected_account_count ?? 0} />
        <InfoCard label="Notifications Sent" value={notifications.length} />
        <InfoCard label="WSLCB" value={recall.wslcb_notified ? "Notified" : "Pending"} icon={recall.wslcb_notified ? ShieldCheck : XCircle} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trace">Trace ({affected.length})</TabsTrigger>
          <TabsTrigger value="notifications">Notifications ({notifications.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card title="Reason">
                <div className="px-5 py-3 text-[13px] whitespace-pre-wrap">{recall.reason}</div>
                {recall.detailed_description && (
                  <div className="px-5 py-3 border-t border-border/50">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Details</div>
                    <div className="text-[12px] whitespace-pre-wrap">{recall.detailed_description}</div>
                  </div>
                )}
              </Card>
              <Card title="Affected">
                <div className="px-5 py-3 space-y-2">
                  <div className="text-[12px]"><span className="text-muted-foreground">Batches:</span> <span className="font-mono">{(recall.affected_batch_ids ?? []).length}</span></div>
                  <div className="text-[12px]"><span className="text-muted-foreground">Products:</span> <span className="font-mono">{(recall.affected_product_ids ?? []).length}</span></div>
                  <div className="text-[12px]"><span className="text-muted-foreground">Strains:</span> <span className="font-mono">{(recall.affected_strain_ids ?? []).length}</span></div>
                </div>
              </Card>
            </div>
            <div className="space-y-4">
              <Card title="Regulatory">
                <div className="px-5 py-3 space-y-2 text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">WSLCB notified</span>
                    {recall.wslcb_notified ? <span className="text-emerald-500 font-semibold inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Yes</span> : <span className="text-muted-foreground">No</span>}
                  </div>
                  {recall.wslcb_notified_at && <div className="text-muted-foreground"><DateTime value={recall.wslcb_notified_at} format="date-only" /></div>}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Public notice issued</span>
                    {recall.public_notice_issued ? <span className="text-emerald-500">Yes</span> : <span className="text-muted-foreground">No</span>}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trace">
          <TracePanel affected={affected} loading={affectedLoading} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsPanel notifications={notifications} onAck={async (id) => { try { await ack(id); toast.success("Acknowledged"); refreshNotifications(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} onSendAll={handleSendAll} canSendMore={affected.length > notifications.length} />
        </TabsContent>

        <TabsContent value="activity">
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[14px] font-semibold mb-1">Audit log coming soon</p>
            <p className="text-[12px] text-muted-foreground">Recall initiation, notifications, and resolution events will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TracePanel({ affected, loading }: { affected: any[]; loading: boolean }) {
  const navigate = useNavigate();
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (affected.length === 0) {
    return <EmptyState icon={Building2} title="No downstream allocations" description="No affected batches have been allocated to orders yet." />;
  }

  const columns: ColumnDef<any>[] = [
    { accessorKey: "batch_barcode", header: "Batch", cell: ({ row }) => <button onClick={() => navigate(`/inventory/batches/${row.original.batch_id}`)} className="font-mono text-[12px] text-primary hover:underline">{row.original.batch_barcode}</button> },
    { accessorKey: "order_number", header: "Order", cell: ({ row }) => row.original.order_id ? <button onClick={() => navigate(`/sales/orders/${row.original.order_id}`)} className="font-mono text-[12px] text-primary hover:underline">{row.original.order_number}</button> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "manifest_external_id", header: "Manifest", cell: ({ row }) => row.original.manifest_id ? <button onClick={() => navigate(`/sales/manifests/${row.original.manifest_id}`)} className="font-mono text-[11px] text-primary hover:underline">{row.original.manifest_external_id?.slice(-8)}</button> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "account_name", header: "Account", cell: ({ row }) => row.original.account_id ? <button onClick={() => navigate(`/sales/accounts/${row.original.account_id}`)} className="text-[12px] text-primary hover:underline">{row.original.account_name}</button> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "account_license", header: "License #", cell: ({ row }) => row.original.account_license ? <span className="font-mono text-[11px]">{row.original.account_license}</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "account_email", header: "Contact", cell: ({ row }) => row.original.account_email ? <a href={`mailto:${row.original.account_email}`} className="text-[11px] text-primary hover:underline">{row.original.account_email}</a> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "quantity", header: "Qty", cell: ({ row }) => <span className="font-mono text-[12px] font-semibold">{Number(row.original.quantity).toFixed(1)}g</span> },
    { accessorKey: "order_date", header: "Ship Date", cell: ({ row }) => row.original.order_date ? <DateTime value={row.original.order_date} format="date-only" className="text-[12px]" /> : "—" },
    { id: "status", header: "Notified", cell: ({ row }) => row.original.notified ? (row.original.acknowledged ? <span className="text-[10px] text-emerald-500 font-semibold">ACK</span> : <span className="text-[10px] text-amber-500 font-semibold">Sent</span>) : <span className="text-[10px] text-destructive font-semibold">Pending</span> },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-[12px] flex items-start gap-2">
        <AlertOctagon className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        <span>Full downstream trace from affected batches → allocations → orders → accounts. Share this table with WSLCB during audits.</span>
      </div>
      <DataTable columns={columns} data={affected} />
    </div>
  );
}

function NotificationsPanel({ notifications, onAck, onSendAll, canSendMore }: { notifications: any[]; onAck: (id: string) => void; onSendAll: () => void; canSendMore: boolean }) {
  const navigate = useNavigate();
  const columns: ColumnDef<any>[] = [
    { id: "account", header: "Account", cell: ({ row }) => row.original.account ? <button onClick={() => navigate(`/sales/accounts/${row.original.account.id}`)} className="text-[12px] text-primary hover:underline">{row.original.account.company_name}</button> : <span className="text-muted-foreground">—</span> },
    { id: "order", header: "Order", cell: ({ row }) => row.original.order ? <button onClick={() => navigate(`/sales/orders/${row.original.order.id}`)} className="font-mono text-[11px] text-primary hover:underline">{row.original.order.order_number}</button> : <span className="text-muted-foreground">—</span> },
    { id: "batch", header: "Batch", cell: ({ row }) => row.original.batch ? <span className="font-mono text-[11px]">{row.original.batch.barcode}</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "notification_method", header: "Method", cell: ({ row }) => <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">{row.original.notification_method ?? "—"}</span> },
    { accessorKey: "notified_at", header: "Notified", cell: ({ row }) => row.original.notified_at ? <DateTime value={row.original.notified_at} format="date-only" className="text-[11px]" /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "acknowledged_at", header: "Acknowledged", cell: ({ row }) => row.original.acknowledged_at ? <DateTime value={row.original.acknowledged_at} format="date-only" className="text-[11px]" /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "quantity_returned", header: "Qty Returned", cell: ({ row }) => row.original.quantity_returned != null ? <span className="font-mono text-[12px]">{Number(row.original.quantity_returned).toFixed(1)}g</span> : <span className="text-muted-foreground">—</span> },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => !row.original.acknowledged_at ? (
        <Button size="sm" variant="outline" onClick={() => onAck(row.original.id)} className="gap-1.5 h-7 text-[11px]"><CheckCircle2 className="w-3 h-3" /> Mark Ack</Button>
      ) : null,
    },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Customer notifications</h3>
        {canSendMore && <Button size="sm" onClick={onSendAll} className="gap-1.5"><Send className="w-3.5 h-3.5" /> Send to All Affected</Button>}
      </div>
      <DataTable
        columns={columns} data={notifications}
        empty={{ icon: Mail, title: "No notifications yet", description: "Send notifications to every affected account to start the recall response.", action: <Button onClick={onSendAll} className="gap-1.5"><Send className="w-3.5 h-3.5" /> Send Notifications</Button> }}
      />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function InfoCard({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: any }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-[22px] font-bold font-mono tabular-nums">{value}</div>
    </div>
  );
}

void CopyableId;
