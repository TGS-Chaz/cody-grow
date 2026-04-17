import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ShoppingCart, Plus, Eye, MoreHorizontal, FileEdit, Send, Package, Truck, CheckCircle,
  XCircle, Archive, FileText,
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
import StatusPill from "@/components/shared/StatusPill";
import DateTime from "@/components/shared/DateTime";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useOrders, useOrderStats, useCancelOrder, Order, OrderFilters,
} from "@/hooks/useOrders";
import { ORDER_STATUSES, ORDER_SALE_TYPE_LABELS, OrderStatus, OrderSaleType } from "@/lib/schema-enums";
import { CreateOrderModal } from "./OrderModals";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "warning" | "critical" | "info" | "muted"> = {
  draft: "muted",
  cart: "muted",
  submitted: "info",
  allocated: "info",
  packaged: "warning",
  manifested: "warning",
  invoiced: "warning",
  released: "info",
  completed: "success",
  cancelled: "critical",
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<OrderFilters>({});
  const { data: orders, loading, refresh } = useOrders(filters);
  const stats = useOrderStats(orders);
  const cancel = useCancelOrder();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [initialAccountId, setInitialAccountId] = useState<string | undefined>();

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setInitialAccountId(searchParams.get("account_id") ?? undefined);
      setCreateOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("create"); next.delete("account_id");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useShortcut(["n"], () => setCreateOpen(true), { description: "Create order", scope: "Orders", enabled: !createOpen });
  useShortcut(["/"], () => document.querySelector<HTMLInputElement>("[data-filters-search]")?.focus(), { description: "Focus search", scope: "Orders" });

  const { setContext, clearContext } = useCodyContext();
  const payload = useMemo(() => ({
    stats, filters,
    orders: orders.slice(0, 40).map((o) => ({ number: o.order_number, account: o.account?.company_name, total: o.total, status: o.status, sale_type: o.sale_type })),
  }), [stats, filters, orders]);
  useEffect(() => {
    setContext({ context_type: "orders_list", page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => `${o.order_number} ${o.account?.company_name ?? ""}`.toLowerCase().includes(q));
  }, [orders, search]);

  const columns: ColumnDef<Order>[] = useMemo(() => [
    {
      accessorKey: "order_number", header: "Order #",
      cell: ({ row }) => <button onClick={() => navigate(`/sales/orders/${row.original.id}`)} className="font-mono text-[12px] font-semibold text-primary hover:underline">{row.original.order_number}</button>,
    },
    {
      id: "account", header: "Account",
      cell: ({ row }) => row.original.account
        ? <button onClick={(e) => { e.stopPropagation(); navigate(`/sales/accounts/${row.original.account!.id}`); }} className="text-[12px] text-primary hover:underline">{row.original.account.company_name}</button>
        : <span className="text-muted-foreground">—</span>,
    },
    { id: "items", header: "Items", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.item_count ?? 0}</span> },
    { accessorKey: "subtotal", header: "Subtotal", cell: ({ row }) => <span className="font-mono text-[12px]">${Number(row.original.subtotal ?? 0).toFixed(2)}</span> },
    { accessorKey: "discount_total", header: "Discount", cell: ({ row }) => Number(row.original.discount_total ?? 0) > 0 ? <span className="font-mono text-[12px] text-emerald-500">-${Number(row.original.discount_total).toFixed(2)}</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "tax_total", header: "Tax", cell: ({ row }) => <span className="font-mono text-[12px]">${Number(row.original.tax_total ?? 0).toFixed(2)}</span> },
    { accessorKey: "total", header: "Total", cell: ({ row }) => <span className="font-mono text-[12px] font-semibold">${Number(row.original.total ?? 0).toFixed(2)}</span> },
    { accessorKey: "sale_type", header: "Type", cell: ({ row }) => row.original.sale_type ? <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">{ORDER_SALE_TYPE_LABELS[row.original.sale_type as OrderSaleType] ?? row.original.sale_type}</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => row.original.status ? <StatusPill label={row.original.status} variant={STATUS_VARIANT[row.original.status] ?? "muted"} /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "created_at", header: "Created", cell: ({ row }) => row.original.created_at ? <DateTime value={row.original.created_at} format="date-only" className="text-[12px]" /> : "—" },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/sales/orders/${row.original.id}`)}><Eye className="w-3.5 h-3.5" /> View</DropdownMenuItem>
              {row.original.status === "submitted" && <DropdownMenuItem onClick={() => navigate(`/sales/orders/${row.original.id}?tab=allocations`)}><Package className="w-3.5 h-3.5" /> Allocate</DropdownMenuItem>}
              {row.original.status === "allocated" && <DropdownMenuItem onClick={() => navigate(`/sales/manifests?create=1&order_id=${row.original.id}`)}><FileText className="w-3.5 h-3.5" /> Create Manifest</DropdownMenuItem>}
              <DropdownMenuSeparator />
              {row.original.status !== "cancelled" && row.original.status !== "completed" && (
                <DropdownMenuItem onClick={async () => { try { await cancel(row.original.id); toast.success("Cancelled"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                  <XCircle className="w-3.5 h-3.5" /> Cancel
                </DropdownMenuItem>
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
        title="Orders"
        description="Wholesale orders from draft to delivery"
        breadcrumbs={[{ label: "Sales & Fulfillment" }, { label: "Orders" }]}
        actions={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Order</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Draft" value={stats.draft} accentClass="stat-accent-blue" delay={0.05} />
        <StatCard label="Submitted" value={stats.submitted} accentClass="stat-accent-amber" delay={0.1} />
        <StatCard label="Allocated" value={stats.allocated} accentClass="stat-accent-teal" delay={0.15} />
        <StatCard label="Manifested" value={stats.manifested} accentClass="stat-accent-teal" delay={0.2} />
        <StatCard label="Completed" value={stats.completed} accentClass="stat-accent-emerald" delay={0.25} />
      </div>

      <FiltersBar
        searchValue={search} onSearchChange={setSearch}
        searchPlaceholder="Search order #, account…"
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={filters.status ?? ""} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as OrderStatus || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.sale_type ?? ""} onChange={(e) => setFilters((f) => ({ ...f, sale_type: e.target.value as OrderSaleType || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All types</option>
              <option value="Wholesale">Wholesale</option>
              <option value="RecreationalMedical">Medical</option>
            </select>
          </div>
        }
      />

      <DataTable
        columns={columns} data={filtered} loading={loading}
        empty={{
          icon: ShoppingCart,
          title: orders.length === 0 ? "No orders yet" : "No matches",
          description: orders.length === 0 ? "Create your first order. Select an account, add products, allocate inventory, and generate a manifest." : "Clear filters or adjust the search.",
          action: orders.length === 0 ? <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Order</Button> : undefined,
        }}
      />

      <CreateOrderModal open={createOpen} onClose={() => setCreateOpen(false)} initialAccountId={initialAccountId} onSuccess={(o) => { refresh(); navigate(`/sales/orders/${o.id}`); }} />
    </div>
  );
}

void cn; void FileEdit; void Send; void Truck; void CheckCircle; void Archive;
