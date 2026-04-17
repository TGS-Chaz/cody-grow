import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Building2, Loader2, Edit, ShoppingCart, FileText, Archive, MoreHorizontal, MapPin, Phone, Mail,
  User, CreditCard, Truck, DollarSign, Pin, Trash2, Plus, Activity, Users,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import CopyableId from "@/components/shared/CopyableId";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useAccount, useArchiveAccount, useAccountOrders, useAccountNotes, useCreateNote, usePinNote, useDeleteNote,
  useAccountPriceLists, useAccountDrivers, useAccountVehicles, Account, useUpdateAccount,
} from "@/hooks/useAccounts";
import InlineAIEdit from "@/components/ai/InlineAIEdit";
import { Sparkles } from "lucide-react";
import { useNoteAttributes } from "@/hooks/useNoteAttributes";
import { AccountModal } from "./AccountModal";
import AccountCreditPanel from "./AccountCreditPanel";
import AccountAIInsights from "@/components/ai/AccountAIInsights";
import { useInvoices, useInvoiceStats, useMarkInvoicePaid } from "@/hooks/useInvoices";
import { cn } from "@/lib/utils";

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const setActiveTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const { data: account, loading, refresh } = useAccount(id);
  const { data: orders, loading: ordersLoading } = useAccountOrders(id);
  const { data: notes, refresh: refreshNotes } = useAccountNotes(id);
  const { data: priceLists } = useAccountPriceLists(id);
  const { data: drivers } = useAccountDrivers(id);
  const { data: vehicles } = useAccountVehicles(id);
  const { data: noteAttrs } = useNoteAttributes();
  const archive = useArchiveAccount();
  const createNote = useCreateNote();
  const pinNote = usePinNote();
  const deleteNote = useDeleteNote();

  const [editOpen, setEditOpen] = useState(false);
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const updateAccount = useUpdateAccount();

  const { setContext, clearContext } = useCodyContext();
  const payload = useMemo(() => {
    if (!account) return null;
    const now = Date.now();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const quarterStart = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1).getTime();
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    const daysSince = account.last_order_at ? Math.floor((now - new Date(account.last_order_at).getTime()) / 86400000) : null;
    const monthRevenue = orders.filter((o) => o.created_at && new Date(o.created_at).getTime() >= monthStart).reduce((s, o) => s + Number(o.total ?? 0), 0);
    const quarterRevenue = orders.filter((o) => o.created_at && new Date(o.created_at).getTime() >= quarterStart).reduce((s, o) => s + Number(o.total ?? 0), 0);
    const yearRevenue = orders.filter((o) => o.created_at && new Date(o.created_at).getTime() >= yearStart).reduce((s, o) => s + Number(o.total ?? 0), 0);
    return {
      account: { name: account.company_name, license: account.license_number, type: account.license_type, status: account.status?.name, route: account.route?.name },
      orders_total: orders.length, days_since_last_order: daysSince,
      revenue: { month: monthRevenue, quarter: quarterRevenue, year: yearRevenue },
      notes_count: notes.length,
      price_lists_count: priceLists.length,
    };
  }, [account, orders, notes, priceLists]);
  useEffect(() => {
    if (!account || !payload) return;
    setContext({ context_type: "account_detail", context_id: account.id, page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload, account?.id]);

  useShortcut(["e"], () => setEditOpen(true), { description: "Edit", scope: "Account Detail", enabled: !!account && !editOpen });
  useShortcut(["o"], () => navigate(`/sales/orders?create=1&account_id=${id}`), { description: "Create order", scope: "Account Detail", enabled: !!account && !editOpen });
  useShortcut(["m"], () => navigate(`/sales/manifests?create=1&account_id=${id}`), { description: "Create manifest", scope: "Account Detail", enabled: !!account && !editOpen });

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!account) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState icon={Building2} title="Account not found" description="This account may have been archived or doesn't exist." primaryAction={<Button onClick={() => navigate("/sales/accounts")}>← Back to accounts</Button>} />
      </div>
    );
  }

  const status = account.status;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={account.company_name}
        breadcrumbs={[
          { label: "Sales & Fulfillment" },
          { label: "Accounts", to: "/sales/accounts" },
          { label: account.company_name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {account.license_type && <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">{account.license_type.replace(/_/g, " ")}</span>}
            {status && <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold" style={{ background: `${status.color ?? "#6B7280"}20`, color: status.color ?? "#6B7280" }}>{status.name}</span>}
            <Button onClick={() => navigate(`/sales/orders?create=1&account_id=${id}`)} className="gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5" /> Create Order
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Edit className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button variant="outline" onClick={() => setAiEditOpen(true)} className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Edit with Cody
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="w-9 h-9"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/sales/manifests?create=1&account_id=${id}`)}><FileText className="w-3.5 h-3.5" /> Create Manifest</DropdownMenuItem>
                <DropdownMenuItem onClick={async () => { try { await archive(account.id); toast.success("Archived"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                  <Archive className="w-3.5 h-3.5" /> Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-6 -mt-4 flex-wrap">
        {account.dba && <span>DBA {account.dba}</span>}
        {account.route && <><span>·</span><div className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: account.route.color ?? "#6B7280" }} /><span>{account.route.name}</span></div></>}
        {account.rep && <><span>·</span><span>Rep: {account.rep.full_name ?? account.rep.email}</span></>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <InfoCard icon={FileText} label="License">
          {account.license_number ? <CopyableId value={account.license_number} className="text-[11px]" /> : <span className="text-[13px] text-muted-foreground">—</span>}
          {account.license_type && <p className="text-[10px] text-muted-foreground capitalize">{account.license_type.replace(/_/g, " ")}</p>}
        </InfoCard>
        <InfoCard icon={User} label="Contact">
          <div className="text-[13px] font-medium truncate">{account.primary_contact_name ?? "—"}</div>
          {account.primary_contact_email && <div className="text-[10px] text-muted-foreground truncate">{account.primary_contact_email}</div>}
        </InfoCard>
        <InfoCard icon={MapPin} label="Location">
          <div className="text-[12px]">{[account.city, account.state].filter(Boolean).join(", ") || "—"}</div>
          {account.zip && <div className="text-[10px] text-muted-foreground">{account.zip}</div>}
        </InfoCard>
        <InfoCard icon={Truck} label="Route">
          {account.route ? <span className="inline-flex items-center gap-1.5 text-[13px]"><span className="w-2 h-2 rounded-full" style={{ background: account.route.color ?? "#6B7280" }} />{account.route.name}</span> : <span className="text-[13px] text-muted-foreground">—</span>}
        </InfoCard>
        <InfoCard icon={User} label="Rep">
          <div className="text-[12px]">{account.rep?.full_name ?? account.rep?.email ?? "—"}</div>
        </InfoCard>
        <InfoCard icon={CreditCard} label="Payment Terms">
          <div className="text-[13px] font-semibold">{account.payment_terms ?? "—"}</div>
        </InfoCard>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="pricing">Pricing ({priceLists.length})</TabsTrigger>
          <TabsTrigger value="credit">Credit</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="fleet">Fleet</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewPanel account={account} orders={orders} /></TabsContent>
        <TabsContent value="orders"><OrdersPanel orders={orders} loading={ordersLoading} accountId={account.id} /></TabsContent>
        <TabsContent value="notes">
          <NotesPanel
            accountId={account.id} notes={notes} attrs={noteAttrs}
            onAdd={async (c, ids, p) => { await createNote(account.id, { content: c, attribute_ids: ids, is_pinned: p }); refreshNotes(); }}
            onPin={async (nid, p) => { await pinNote(nid, p); refreshNotes(); }}
            onDelete={async (nid) => { await deleteNote(nid); refreshNotes(); }}
          />
        </TabsContent>
        <TabsContent value="contacts"><ContactsPanel account={account} /></TabsContent>
        <TabsContent value="pricing"><PricingPanel priceLists={priceLists} /></TabsContent>
        <TabsContent value="credit"><AccountCreditPanel accountId={account.id} /></TabsContent>
        <TabsContent value="financials"><FinancialsPanel accountId={account.id} /></TabsContent>
        <TabsContent value="fleet"><FleetPanel drivers={drivers} vehicles={vehicles} /></TabsContent>
        <TabsContent value="activity">
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[14px] font-semibold text-foreground mb-1">Audit log coming soon</p>
            <p className="text-[12px] text-muted-foreground">Account changes, order creation, and manifest events will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>

      <AccountModal open={editOpen} onClose={() => setEditOpen(false)} account={account} onSuccess={() => refresh()} />
      <InlineAIEdit
        open={aiEditOpen}
        onClose={() => setAiEditOpen(false)}
        entityType="account"
        entity={account as unknown as Record<string, unknown>}
        editableFields={[
          "company_name", "primary_contact_name", "primary_contact_email", "primary_contact_phone",
          "street_address", "city", "state", "postal_code",
          "payment_terms", "credit_limit_cents", "default_delivery_notes",
          "preferred_delivery_window",
        ]}
        onApply={async (_merged, patch) => {
          await updateAccount(account.id, patch as any);
          refresh();
        }}
      />
    </div>
  );
}

// ─── panels ─────────────────────────────────────────────────────────────────
function OverviewPanel({ account, orders }: { account: Account; orders: any[] }) {
  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const quarterStart = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1).getTime();
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const monthOrders = orders.filter((o) => o.created_at && new Date(o.created_at).getTime() >= monthStart);
  const quarterOrders = orders.filter((o) => o.created_at && new Date(o.created_at).getTime() >= quarterStart);
  const yearOrders = orders.filter((o) => o.created_at && new Date(o.created_at).getTime() >= yearStart);
  const sum = (arr: any[]) => arr.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const avg = orders.length > 0 ? sum(orders) / orders.length : 0;
  const daysSince = account.last_order_at ? Math.floor((now - new Date(account.last_order_at).getTime()) / 86400000) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card title="Account info">
          <Row label="Company" value={<span className="font-medium">{account.company_name}</span>} />
          <Row label="DBA" value={account.dba ?? "—"} />
          <Row label="License" value={account.license_number ? <CopyableId value={account.license_number} /> : "—"} />
          <Row label="License type" value={account.license_type?.replace(/_/g, " ") ?? "—"} />
          <Row label="Primary contact" value={account.primary_contact_name ?? "—"} />
          <Row label="Email" value={account.primary_contact_email ?? "—"} />
          <Row label="Phone" value={account.primary_contact_phone ?? "—"} />
          <Row label="Address" value={[account.address_line1, account.address_line2, account.city, account.state, account.zip].filter(Boolean).join(", ") || "—"} />
          <Row label="Payment terms" value={account.payment_terms ?? "—"} />
          <Row label="Label preference" value={account.label_barcode_preference ?? "—"} />
        </Card>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Sales summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Orders this month" value={monthOrders.length} />
            <Stat label="Revenue this month" value={`$${sum(monthOrders).toFixed(2)}`} />
            <Stat label="Orders this quarter" value={quarterOrders.length} />
            <Stat label="Revenue this quarter" value={`$${sum(quarterOrders).toFixed(2)}`} />
            <Stat label="Orders YTD" value={yearOrders.length} />
            <Stat label="Revenue YTD" value={`$${sum(yearOrders).toFixed(2)}`} />
            <Stat label="Avg order value" value={`$${avg.toFixed(2)}`} />
            <Stat label="Days since last order" value={daysSince ?? "—"} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <AccountAIInsights accountId={account.id} />
        {account.is_non_cannabis && (
          <div className="rounded-xl border border-border bg-card p-4 text-[12px] text-muted-foreground">
            Non-cannabis account — no CCRS reporting required.
          </div>
        )}
      </div>
    </div>
  );
}

function OrdersPanel({ orders, loading, accountId }: { orders: any[]; loading: boolean; accountId: string }) {
  const navigate = useNavigate();
  const columns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: "order_number", header: "Order #", cell: ({ row }) => <button onClick={() => navigate(`/sales/orders/${row.original.id}`)} className="font-mono text-[12px] text-primary hover:underline">{row.original.order_number}</button> },
    { accessorKey: "created_at", header: "Date", cell: ({ row }) => row.original.created_at ? <DateTime value={row.original.created_at} format="date-only" className="text-[12px]" /> : "—" },
    { accessorKey: "item_count", header: "Items", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.item_count ?? 0}</span> },
    { accessorKey: "total", header: "Total", cell: ({ row }) => <span className="font-mono text-[12px] font-semibold">${Number(row.original.total ?? 0).toFixed(2)}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill label={row.original.status ?? "draft"} variant="info" /> },
  ], [navigate]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Orders for this account</h3>
        <Button size="sm" onClick={() => navigate(`/sales/orders?create=1&account_id=${accountId}`)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Order</Button>
      </div>
      <DataTable
        columns={columns} data={orders} loading={loading}
        empty={{ icon: ShoppingCart, title: "No orders yet", description: "Create an order to start transacting with this account.", action: <Button onClick={() => navigate(`/sales/orders?create=1&account_id=${accountId}`)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Order</Button> }}
      />
    </div>
  );
}

function NotesPanel({ accountId, notes, attrs, onAdd, onPin, onDelete }: {
  accountId: string; notes: any[]; attrs: any[];
  onAdd: (c: string, ids: string[], p: boolean) => Promise<void>;
  onPin: (id: string, pinned: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const attrById = useMemo(() => new Map(attrs.map((a) => [a.id, a])), [attrs]);

  const toggleAttr = (id: string) => setSelectedAttrs((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const handleAdd = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await onAdd(content.trim(), selectedAttrs, pinned);
      setContent(""); setSelectedAttrs([]); setPinned(false);
      toast.success("Note added");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Add note</h3>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="Leave a note about this account…" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        {attrs.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {attrs.map((a) => {
              const selected = selectedAttrs.includes(a.id);
              return (
                <button key={a.id} type="button" onClick={() => toggleAttr(a.id)} className={cn("inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium border transition-colors",
                  selected ? "border-transparent" : "border-border bg-background hover:bg-accent")}
                  style={selected ? { background: `${a.color ?? "#6B7280"}20`, color: a.color ?? "#6B7280", borderColor: a.color ?? "#6B7280" } : undefined}>
                  {a.name}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
            <Pin className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[12px]">Pin</span>
          </label>
          <Button size="sm" onClick={handleAdd} disabled={!content.trim() || saving} className="gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState icon={FileText} title="No notes yet" description="Add a note to capture context about this account." />
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className={cn("rounded-xl border p-4", n.is_pinned ? "border-primary/30 bg-primary/5" : "border-border bg-card")}>
              <div className="flex items-start gap-2 mb-2">
                <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                  {n.is_pinned && <Pin className="w-3 h-3 text-primary" />}
                  <span className="text-[11px] text-muted-foreground">{n.author?.full_name ?? n.author?.email ?? "—"}</span>
                  {n.created_at && <><span className="text-muted-foreground/50">·</span><DateTime value={n.created_at} className="text-[11px] text-muted-foreground" /></>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => onPin(n.id, !n.is_pinned)} className="p-1 rounded hover:bg-accent text-muted-foreground" title={n.is_pinned ? "Unpin" : "Pin"}>
                    <Pin className={cn("w-3.5 h-3.5", n.is_pinned && "text-primary fill-primary")} />
                  </button>
                  <button onClick={() => onDelete(n.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[13px] whitespace-pre-wrap">{n.content}</p>
              {(n.attribute_ids?.length ?? 0) > 0 && (
                <div className="flex items-center gap-1 flex-wrap mt-2">
                  {(n.attribute_ids as string[]).map((aid) => {
                    const a = attrById.get(aid);
                    if (!a) return null;
                    return <span key={aid} className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium" style={{ background: `${a.color ?? "#6B7280"}20`, color: a.color ?? "#6B7280" }}>{a.name}</span>;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <span className="hidden">{accountId}</span>
    </div>
  );
}

function ContactsPanel({ account }: { account: Account }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Primary contact</h3>
      {account.primary_contact_name ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /><span className="text-[13px] font-medium">{account.primary_contact_name}</span></div>
          {account.primary_contact_email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><a href={`mailto:${account.primary_contact_email}`} className="text-[12px] text-primary hover:underline">{account.primary_contact_email}</a></div>}
          {account.primary_contact_phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><a href={`tel:${account.primary_contact_phone}`} className="text-[12px] text-primary hover:underline">{account.primary_contact_phone}</a></div>}
        </div>
      ) : <p className="text-[12px] text-muted-foreground italic">No contact info on file</p>}
      {account.crm_company_id && <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">Linked to CRM company — additional contacts available in Cody CRM.</p>}
    </div>
  );
}

function PricingPanel({ priceLists }: { priceLists: any[] }) {
  const navigate = useNavigate();
  if (priceLists.length === 0) {
    return <EmptyState icon={DollarSign} title="No price lists assigned" description="Assign a price list to give this account custom pricing." action={<Button variant="outline" onClick={() => navigate("/settings/customer-setup")} className="gap-1.5">Manage price lists</Button>} />;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {priceLists.map((pl) => (
        <button key={pl.id} onClick={() => navigate(`/settings/customer-setup/price-lists/${pl.price_list_id}`)} className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[13px] font-semibold">{pl.price_list?.name ?? "—"}</h3>
            {pl.price_list?.is_default && <StatusPill label="Default" variant="success" />}
          </div>
          {pl.price_list?.description && <p className="text-[11px] text-muted-foreground">{pl.price_list.description}</p>}
          <p className="text-[10px] text-muted-foreground mt-2">Priority {pl.priority ?? 1}</p>
        </button>
      ))}
    </div>
  );
}

function FleetPanel({ drivers, vehicles }: { drivers: any[]; vehicles: any[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pickup drivers ({drivers.length})</h3>
          <Button size="sm" variant="outline" onClick={() => navigate("/settings/fleet")}>Manage</Button>
        </div>
        {drivers.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-muted-foreground italic">No drivers registered</div>
        ) : (
          <ul className="divide-y divide-border/50">
            {drivers.map((d) => (
              <li key={d.id} className="px-5 py-3 text-[12px] flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{d.first_name} {d.last_name}</span>
                {d.license_number && <span className="text-muted-foreground font-mono text-[11px]">· {d.license_number}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pickup vehicles ({vehicles.length})</h3>
          <Button size="sm" variant="outline" onClick={() => navigate("/settings/fleet")}>Manage</Button>
        </div>
        {vehicles.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-muted-foreground italic">No vehicles registered</div>
        ) : (
          <ul className="divide-y divide-border/50">
            {vehicles.map((v) => (
              <li key={v.id} className="px-5 py-3 text-[12px] flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span>{v.year} {v.make} {v.model}</span>
                <span className="text-muted-foreground font-mono text-[11px]">· {v.license_plate}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── primitives ─────────────────────────────────────────────────────────────
function InfoCard({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <dl className="divide-y divide-border/50">{children}</dl>
    </div>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 px-5 py-2.5">
      <dt className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</dt>
      <dd className="text-[12px] text-foreground">{value}</dd>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-[18px] font-bold font-mono tabular-nums">{value}</div>
    </div>
  );
}

void Users;

function FinancialsPanel({ accountId }: { accountId: string }) {
  const { data: invoices, loading, refresh } = useInvoices({ account_id: accountId });
  const stats = useInvoiceStats(invoices);
  const markPaid = useMarkInvoicePaid();

  const handlePrint = async (invoiceId: string) => {
    try {
      const { generateInvoice, openInvoiceWindow } = await import("@/lib/documents/generateInvoice");
      const html = await generateInvoice(invoiceId);
      openInvoiceWindow(html);
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try { await markPaid(invoiceId); toast.success("Marked paid"); refresh(); }
    catch (err: any) { toast.error(err?.message ?? "Failed"); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Invoices" value={stats.total} />
        <Stat label="Outstanding" value={`$${stats.outstandingAmount.toFixed(2)}`} />
        <Stat label="Overdue" value={`$${stats.overdueAmount.toFixed(2)}`} />
        <Stat label="Paid" value={`$${stats.paidAmount.toFixed(2)}`} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Aging breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg bg-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-emerald-500 mb-1 font-semibold">Current</div>
            <div className="text-[15px] font-bold font-mono tabular-nums">${stats.aging.current.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-blue-500 mb-1 font-semibold">1–30d</div>
            <div className="text-[15px] font-bold font-mono tabular-nums">${stats.aging.days_30.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-amber-500 mb-1 font-semibold">31–60d</div>
            <div className="text-[15px] font-bold font-mono tabular-nums">${stats.aging.days_60.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-orange-500 mb-1 font-semibold">61–90d</div>
            <div className="text-[15px] font-bold font-mono tabular-nums">${stats.aging.days_90.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-destructive mb-1 font-semibold">90+</div>
            <div className="text-[15px] font-bold font-mono tabular-nums">${stats.aging.days_90_plus.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-[13px] font-semibold">Invoices</h3>
        </div>
        {invoices.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[12px] text-muted-foreground">No invoices for this account yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-5 py-2 font-medium">Invoice #</th>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Due</th>
                <th className="text-left px-3 py-2 font-medium">Order</th>
                <th className="text-right px-3 py-2 font-medium">Total</th>
                <th className="text-right px-3 py-2 font-medium">Balance</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const due = inv.due_date ? new Date(inv.due_date).getTime() : null;
                const overdue = due && due < Date.now() && inv.status !== "paid";
                const variant: any = inv.status === "paid" ? "success" : overdue ? "critical" : inv.status === "partial" ? "warning" : "info";
                return (
                  <tr key={inv.id} className="border-b border-border text-[12px]">
                    <td className="px-5 py-3 font-mono">{inv.invoice_number}</td>
                    <td className="px-3 py-3"><DateTime value={inv.invoice_date} format="date-only" /></td>
                    <td className={cn("px-3 py-3", overdue ? "text-destructive font-medium" : "")}>
                      {inv.due_date ? <DateTime value={inv.due_date} format="date-only" /> : "—"}
                    </td>
                    <td className="px-3 py-3">{inv.order?.order_number ?? "—"}</td>
                    <td className="px-3 py-3 text-right font-mono">${Number(inv.total).toFixed(2)}</td>
                    <td className={cn("px-3 py-3 text-right font-mono font-semibold", Number(inv.balance) > 0 ? "text-destructive" : "text-emerald-500")}>${Number(inv.balance).toFixed(2)}</td>
                    <td className="px-3 py-3 text-center"><StatusPill label={overdue ? "overdue" : inv.status ?? "unpaid"} variant={variant} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handlePrint(inv.id)} className="h-7 px-2 text-[11px]">Print</Button>
                        {inv.status !== "paid" && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkPaid(inv.id)} className="h-7 px-2 text-[11px]">Mark Paid</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
