import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, Eye, MoreHorizontal, CheckCircle, ShoppingCart, DollarSign, AlertTriangle,
  Edit, Archive, FileText,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import DateTime from "@/components/shared/DateTime";
import CopyableId from "@/components/shared/CopyableId";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useAccounts, useAccountStats, useArchiveAccount, Account, AccountFilters,
} from "@/hooks/useAccounts";
import { useAccountStatuses } from "@/hooks/useAccountStatuses";
import { useRoutes } from "@/hooks/useRoutes";
import { AccountModal } from "./AccountModal";
import { RouteOptimizerModal } from "./RouteOptimizerModal";
import { Route as RouteIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AccountsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AccountFilters>({ is_active: true });
  const { data: accounts, loading, refresh } = useAccounts(filters);
  const stats = useAccountStats(accounts);
  const archive = useArchiveAccount();
  const { data: statuses } = useAccountStatuses();
  const { data: routes } = useRoutes();

  const [search, setSearch] = useState("");
  const [modalAccount, setModalAccount] = useState<Account | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [routeModalOpen, setRouteModalOpen] = useState(false);

  useShortcut(["n"], () => { setModalAccount(null); setModalOpen(true); }, { description: "Add account", scope: "Accounts", enabled: !modalOpen });
  useShortcut(["/"], () => document.querySelector<HTMLInputElement>("[data-filters-search]")?.focus(), { description: "Focus search", scope: "Accounts" });

  const { setContext, clearContext } = useCodyContext();
  const payload = useMemo(() => ({
    stats, filters,
    accounts: accounts.slice(0, 40).map((a) => ({
      name: a.company_name, license: a.license_number, type: a.license_type,
      status: a.status?.name, route: a.route?.name, last_order: a.last_order_at, ytd: a.ytd_revenue,
    })),
  }), [stats, filters, accounts]);
  useEffect(() => {
    setContext({ context_type: "accounts_list", page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => `${a.company_name} ${a.license_number ?? ""} ${a.primary_contact_name ?? ""} ${a.city ?? ""}`.toLowerCase().includes(q));
  }, [accounts, search]);

  const columns: ColumnDef<Account>[] = useMemo(() => [
    {
      accessorKey: "company_name", header: "Company",
      cell: ({ row }) => (
        <button onClick={() => navigate(`/sales/accounts/${row.original.id}`)} className="text-[13px] font-medium text-primary hover:underline text-left">
          {row.original.company_name}
        </button>
      ),
    },
    { id: "license", header: "License #", cell: ({ row }) => row.original.license_number ? <CopyableId value={row.original.license_number} className="text-[11px]" /> : <span className="text-muted-foreground">—</span> },
    { id: "type", header: "Type", cell: ({ row }) => row.original.license_type ? <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">{row.original.license_type.replace(/_/g, " ")}</span> : <span className="text-muted-foreground">—</span> },
    { id: "contact", header: "Contact", cell: ({ row }) => row.original.primary_contact_name
      ? <div className="text-[12px]"><div>{row.original.primary_contact_name}</div>{row.original.primary_contact_email && <div className="text-muted-foreground text-[11px]">{row.original.primary_contact_email}</div>}</div>
      : <span className="text-muted-foreground">—</span> },
    { id: "location", header: "Location", cell: ({ row }) => (row.original.city || row.original.state)
      ? <span className="text-[12px]">{[row.original.city, row.original.state].filter(Boolean).join(", ")}</span>
      : <span className="text-muted-foreground">—</span> },
    {
      id: "status", header: "Status",
      cell: ({ row }) => row.original.status
        ? <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium" style={{ background: `${row.original.status.color ?? "#6B7280"}20`, color: row.original.status.color ?? "#6B7280" }}>{row.original.status.name}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "route", header: "Route",
      cell: ({ row }) => row.original.route
        ? <div className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: row.original.route.color ?? "#6B7280" }} /><span className="text-[12px]">{row.original.route.name}</span></div>
        : <span className="text-muted-foreground">—</span>,
    },
    { id: "rep", header: "Rep", cell: ({ row }) => row.original.rep?.full_name ?? row.original.rep?.email ?? <span className="text-muted-foreground">—</span> },
    { id: "last_order", header: "Last Order", cell: ({ row }) => row.original.last_order_at ? <DateTime value={row.original.last_order_at} format="date-only" className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    { id: "ytd", header: "YTD Revenue", cell: ({ row }) => <span className="font-mono text-[12px] font-semibold">${Number(row.original.ytd_revenue ?? 0).toFixed(2)}</span> },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/sales/accounts/${row.original.id}`)}><Eye className="w-3.5 h-3.5" /> View</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setModalAccount(row.original); setModalOpen(true); }}><Edit className="w-3.5 h-3.5" /> Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/sales/orders?create=1&account_id=${row.original.id}`)}><ShoppingCart className="w-3.5 h-3.5" /> Create Order</DropdownMenuItem>
              <DropdownMenuItem disabled><FileText className="w-3.5 h-3.5" /> Create Manifest (soon)</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { try { await archive(row.original.id); toast.success("Archived"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                <Archive className="w-3.5 h-3.5" /> Archive
              </DropdownMenuItem>
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
        title="Accounts"
        description="Your wholesale customers"
        breadcrumbs={[{ label: "Sales & Fulfillment" }, { label: "Accounts" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setRouteModalOpen(true)} className="gap-1.5">
              <RouteIcon className="w-3.5 h-3.5" /> Optimize Route
            </Button>
            <Button onClick={() => { setModalAccount(null); setModalOpen(true); }} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Account
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Active" value={stats.active} accentClass="stat-accent-emerald" delay={0.05} />
        <StatCard label="Orders This Month" value={stats.withOrdersThisMonth} accentClass="stat-accent-teal" delay={0.1} />
        <StatCard label="YTD Revenue" value={`$${(stats.totalYtdRevenue / 1000).toFixed(1)}k`} accentClass="stat-accent-teal" delay={0.15} />
        <StatCard label="Needs Attention" value={stats.needsAttention} accentClass="stat-accent-amber" delay={0.2} />
      </div>

      <FiltersBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search company, license, contact, city…"
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={filters.status_id ?? ""} onChange={(e) => setFilters((f) => ({ ...f, status_id: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border" disabled={statuses.length === 0}>
              <option value="">All statuses</option>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={filters.route_id ?? ""} onChange={(e) => setFilters((f) => ({ ...f, route_id: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border" disabled={routes.length === 0}>
              <option value="">All routes</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select value={filters.license_type ?? ""} onChange={(e) => setFilters((f) => ({ ...f, license_type: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All types</option>
              <option value="retailer">Retailer</option>
              <option value="producer">Producer</option>
              <option value="processor">Processor</option>
              <option value="producer_processor">Producer/Processor</option>
            </select>
            <select value={filters.is_active == null ? "" : String(filters.is_active)} onChange={(e) => setFilters((f) => ({ ...f, is_active: e.target.value === "" ? undefined : e.target.value === "true" }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Archived</option>
            </select>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        empty={{
          icon: Building2,
          title: accounts.length === 0 ? "No accounts yet" : "No matches",
          description: accounts.length === 0 ? "Add your first customer account. Every wholesale order and manifest requires an account." : "Clear filters or adjust the search.",
          action: accounts.length === 0 ? <Button onClick={() => { setModalAccount(null); setModalOpen(true); }} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Account</Button> : undefined,
        }}
      />

      <AccountModal open={modalOpen} onClose={() => setModalOpen(false)} account={modalAccount} onSuccess={() => refresh()} />
      <RouteOptimizerModal open={routeModalOpen} onClose={() => setRouteModalOpen(false)} routeId={filters.route_id ?? null} routeName={routes.find((r) => r.id === filters.route_id)?.name ?? null} />
    </div>
  );
}

void cn; void CheckCircle; void DollarSign; void AlertTriangle;
