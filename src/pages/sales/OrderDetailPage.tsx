import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ShoppingCart, Loader2, Send, Package, Truck, CheckCircle2, XCircle, Activity, MoreHorizontal,
  Plus, Trash2, Building2, DollarSign, FileText, Edit, ArrowRight,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/shared/PageHeader";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import CopyableId from "@/components/shared/CopyableId";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useOrder, useOrderItems, useOrderAllocations, useAllocateOrder, useDeallocateOrder,
  useSubmitOrder, useReleaseOrder, useCompleteOrder, useCancelOrder, useRemoveOrderItem,
  useAllocatePackedSublot,
  Order, OrderItem, OrderAllocation, PackToOrderSuggestion,
} from "@/hooks/useOrders";
import { PackagingModal } from "@/pages/inventory/PackagingModal";
import type { Batch } from "@/hooks/useBatches";
import { ORDER_SALE_TYPE_LABELS, OrderSaleType } from "@/lib/schema-enums";
import { AddOrderItemModal } from "./OrderModals";
import { cn } from "@/lib/utils";

const LIFECYCLE: Array<{ key: string; label: string }> = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "allocated", label: "Allocated" },
  { key: "packaged", label: "Packaged" },
  { key: "manifested", label: "Manifested" },
  { key: "released", label: "Released" },
  { key: "completed", label: "Completed" },
];

const STATUS_VARIANT: Record<string, "success" | "warning" | "critical" | "info" | "muted"> = {
  draft: "muted", cart: "muted", submitted: "info", allocated: "info", packaged: "warning",
  manifested: "warning", invoiced: "warning", released: "info", completed: "success", cancelled: "critical",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "items";
  const setActiveTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const { data: order, loading, refresh } = useOrder(id);
  const { data: items, loading: itemsLoading, refresh: refreshItems } = useOrderItems(id);
  const { data: allocations, loading: allocsLoading, refresh: refreshAllocs } = useOrderAllocations(id);
  const allocate = useAllocateOrder();
  const deallocate = useDeallocateOrder();
  const submit = useSubmitOrder();
  const release = useReleaseOrder();
  const complete = useCompleteOrder();
  const cancel = useCancelOrder();
  const removeItem = useRemoveOrderItem();
  const allocatePacked = useAllocatePackedSublot();

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [packSuggestions, setPackSuggestions] = useState<PackToOrderSuggestion[]>([]);
  const [packingForItem, setPackingForItem] = useState<{ item_id: string; qty: number; source: Batch } | null>(null);

  const { setContext, clearContext } = useCodyContext();
  const payload = useMemo(() => {
    if (!order) return null;
    const totalCost = items.reduce((sum, i) => sum + (Number(i.quantity ?? 0) * Number(i.product?.unit_price ?? 0)), 0);
    return {
      order: { number: order.order_number, status: order.status, sale_type: order.sale_type, total: order.total, subtotal: order.subtotal, tax: order.tax_total },
      account: order.account?.company_name ?? null,
      items_count: items.length,
      allocated_count: allocations.length,
      fully_allocated: items.every((i) => (i.allocated_quantity ?? 0) >= Number(i.quantity ?? 0)),
      est_cost: totalCost,
    };
  }, [order, items, allocations]);
  useEffect(() => {
    if (!order || !payload) return;
    setContext({ context_type: "order_detail", context_id: order.id, page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload, order?.id]);

  useShortcut(["a"], () => setAddItemOpen(true), { description: "Add item", scope: "Order Detail", enabled: order?.status === "draft" && !addItemOpen });

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!order) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState icon={ShoppingCart} title="Order not found" description="This order may have been cancelled or doesn't exist." primaryAction={<Button onClick={() => navigate("/sales/orders")}>← Back to orders</Button>} />
      </div>
    );
  }

  const totalQty = items.reduce((sum, i) => sum + Number(i.quantity ?? 0), 0);
  const allocatedQty = items.reduce((sum, i) => sum + Number(i.allocated_quantity ?? 0), 0);
  const fullyAllocated = totalQty > 0 && allocatedQty >= totalQty;

  const primaryAction = (() => {
    if (order.status === "draft") return { label: "Submit", icon: Send, onClick: async () => { try { await submit(order.id); toast.success("Order submitted"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } } };
    if (order.status === "submitted") return { label: "Allocate Inventory", icon: Package, onClick: async () => { try { const r = await allocate(order.id); setPackSuggestions(r.packToOrderSuggestions); toast.success(`${r.fulfilled} item${r.fulfilled === 1 ? "" : "s"} allocated${r.unfulfilled > 0 ? `, ${r.unfulfilled} unfulfilled` : ""}${r.packToOrderSuggestions.length > 0 ? ` · ${r.packToOrderSuggestions.length} need packaging` : ""}`); refresh(); refreshAllocs(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } } };
    if (order.status === "allocated") return { label: "Create Manifest", icon: FileText, onClick: () => navigate(`/sales/manifests?create=1&order_id=${order.id}`) };
    if (order.status === "manifested") return { label: "Release", icon: Truck, onClick: async () => { try { await release(order.id); toast.success("Released"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } } };
    if (order.status === "released") return { label: "Complete", icon: CheckCircle2, onClick: async () => { try { await complete(order.id); toast.success("Order completed"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } } };
    return null;
  })();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={order.order_number}
        breadcrumbs={[
          { label: "Sales & Fulfillment" },
          { label: "Orders", to: "/sales/orders" },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {order.sale_type && <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">{ORDER_SALE_TYPE_LABELS[order.sale_type as OrderSaleType] ?? order.sale_type}</span>}
            {order.status && <StatusPill label={order.status} variant={STATUS_VARIANT[order.status] ?? "muted"} />}
            {primaryAction && (
              <Button onClick={primaryAction.onClick} className="gap-1.5">
                <primaryAction.icon className="w-3.5 h-3.5" /> {primaryAction.label}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="w-9 h-9"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {allocations.length > 0 && (
                  <DropdownMenuItem onClick={async () => { try { await deallocate(order.id); toast.success("Deallocated"); refresh(); refreshAllocs(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }}>
                    <XCircle className="w-3.5 h-3.5" /> Deallocate
                  </DropdownMenuItem>
                )}
                {order.status !== "cancelled" && order.status !== "completed" && (
                  <DropdownMenuItem onClick={async () => { try { await cancel(order.id); toast.success("Cancelled"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                    <XCircle className="w-3.5 h-3.5" /> Cancel Order
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-6 -mt-4 flex-wrap">
        {order.account && (
          <button onClick={() => navigate(`/sales/accounts/${order.account!.id}`)} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Building2 className="w-3 h-3" /> {order.account.company_name}
            {order.account.license_number && <span className="font-mono text-[11px]">· {order.account.license_number}</span>}
          </button>
        )}
        {order.created_at && <><span>·</span><span>Created <DateTime value={order.created_at} format="date-only" /></span></>}
      </div>

      {/* Lifecycle progress */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {LIFECYCLE.map((step, idx) => {
            const currentIdx = LIFECYCLE.findIndex((s) => s.key === order.status);
            const done = currentIdx >= idx;
            const active = currentIdx === idx;
            return (
              <div key={step.key} className="flex items-center gap-1 flex-1">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold",
                    done ? "bg-primary text-primary-foreground" : active ? "bg-primary/20 text-primary border-2 border-primary" : "bg-muted text-muted-foreground")}>
                    {idx + 1}
                  </div>
                  <span className={cn("text-[10px] font-medium whitespace-nowrap", active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                </div>
                {idx < LIFECYCLE.length - 1 && <div className={cn("flex-1 h-0.5", done && currentIdx > idx ? "bg-primary" : "bg-border")} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <InfoCard icon={Building2} label="Account">
          {order.account ? <button onClick={() => navigate(`/sales/accounts/${order.account!.id}`)} className="text-[13px] font-medium text-primary hover:underline text-left truncate block max-w-full">{order.account.company_name}</button> : <span className="text-[13px] text-muted-foreground">—</span>}
          {order.account?.license_number && <p className="text-[10px] font-mono text-muted-foreground">{order.account.license_number}</p>}
        </InfoCard>
        <InfoCard icon={ShoppingCart} label="Sale Type">
          <div className="text-[13px] font-semibold">{order.sale_type ? ORDER_SALE_TYPE_LABELS[order.sale_type as OrderSaleType] ?? order.sale_type : "—"}</div>
        </InfoCard>
        <InfoCard icon={Package} label="Items / Allocated">
          <div className="text-[18px] font-bold font-mono tabular-nums">{items.length}</div>
          <p className="text-[10px] text-muted-foreground font-mono">{allocatedQty.toFixed(0)}g of {totalQty.toFixed(0)}g allocated</p>
        </InfoCard>
        <InfoCard icon={DollarSign} label="Total">
          <div className="text-[18px] font-bold font-mono tabular-nums">${Number(order.total ?? 0).toFixed(2)}</div>
          <p className="text-[10px] text-muted-foreground">sub ${Number(order.subtotal ?? 0).toFixed(2)} · tax ${Number(order.tax_total ?? 0).toFixed(2)}</p>
        </InfoCard>
        <InfoCard icon={FileText} label="External ID">
          {order.sale_external_identifier ? <CopyableId value={order.sale_external_identifier} className="text-[11px]" truncate={6} /> : <span className="text-[13px] text-muted-foreground">—</span>}
        </InfoCard>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="items">Items ({items.length})</TabsTrigger>
          <TabsTrigger value="allocations">Allocations ({allocations.length})</TabsTrigger>
          <TabsTrigger value="manifest">Manifest</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <ItemsPanel
            items={items}
            order={order}
            loading={itemsLoading}
            onAdd={() => setAddItemOpen(true)}
            onRemove={async (itemId) => { try { await removeItem(itemId, order.id); toast.success("Removed"); refreshItems(); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }}
            canEdit={order.status === "draft"}
            fullyAllocated={fullyAllocated}
          />
        </TabsContent>
        <TabsContent value="allocations">
          <AllocationsPanel
            allocations={allocations}
            items={items}
            loading={allocsLoading}
            canAllocate={order.status === "submitted" || order.status === "allocated"}
            onAllocate={async () => { try { const r = await allocate(order.id); setPackSuggestions(r.packToOrderSuggestions); toast.success(`${r.fulfilled} fulfilled, ${r.unfulfilled} unfulfilled${r.packToOrderSuggestions.length > 0 ? ` · ${r.packToOrderSuggestions.length} need packaging` : ""}`); refresh(); refreshAllocs(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }}
            onDeallocate={async () => { try { await deallocate(order.id); setPackSuggestions([]); toast.success("Deallocated"); refresh(); refreshAllocs(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }}
            packSuggestions={packSuggestions}
            onPackAndAllocate={(s) => setPackingForItem({ item_id: s.item_id, qty: s.quantity_needed, source: { id: s.source_batch.id, barcode: s.source_batch.barcode, current_quantity: s.source_batch.current_quantity } as Batch })}
          />
        </TabsContent>
        <TabsContent value="manifest">
          <ManifestPanel orderId={order.id} canCreate={order.status === "allocated"} />
        </TabsContent>
        <TabsContent value="financials">
          <FinancialsPanel order={order} items={items} allocations={allocations} />
        </TabsContent>
        <TabsContent value="activity">
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[14px] font-semibold text-foreground mb-1">Audit log coming soon</p>
            <p className="text-[12px] text-muted-foreground">Lifecycle transitions, item changes, and allocations will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>

      <AddOrderItemModal open={addItemOpen} onClose={() => setAddItemOpen(false)} orderId={order.id} saleType={order.sale_type as OrderSaleType | null} onSuccess={() => { refreshItems(); refresh(); }} />

      <PackagingModal
        open={!!packingForItem}
        onClose={() => setPackingForItem(null)}
        sourceBatch={packingForItem?.source ?? null}
        orderQuantity={packingForItem?.qty}
        onSuccess={async (child) => {
          if (!packingForItem) return;
          try {
            await allocatePacked(packingForItem.item_id, child.id, packingForItem.qty);
            toast.success(`Packaged sublot ${child.barcode} and allocated to order`);
            setPackSuggestions((prev) => prev.filter((s) => s.item_id !== packingForItem.item_id));
            setPackingForItem(null);
            refresh(); refreshAllocs(); refreshItems();
          } catch (err: any) { toast.error(err?.message ?? "Allocation failed"); }
        }}
      />
    </div>
  );
}

// ─── Items panel ────────────────────────────────────────────────────────────
function ItemsPanel({ items, order, loading, onAdd, onRemove, canEdit, fullyAllocated }: {
  items: OrderItem[]; order: Order; loading: boolean; onAdd: () => void; onRemove: (id: string) => void; canEdit: boolean; fullyAllocated: boolean;
}) {
  const navigate = useNavigate();
  const columns: ColumnDef<OrderItem>[] = useMemo(() => [
    {
      id: "product", header: "Product",
      cell: ({ row }) => row.original.product
        ? <button onClick={() => navigate(`/cultivation/products/${row.original.product!.id}`)} className="text-[12px] text-primary hover:underline">{row.original.product.name}</button>
        : <span className="text-muted-foreground">—</span>,
    },
    { accessorKey: "quantity", header: "Qty", cell: ({ row }) => <span className="font-mono text-[12px]">{Number(row.original.quantity).toFixed(0)}g</span> },
    {
      id: "allocated", header: "Allocated",
      cell: ({ row }) => {
        const q = Number(row.original.quantity ?? 0);
        const a = Number(row.original.allocated_quantity ?? 0);
        const fully = a >= q;
        const partial = a > 0 && !fully;
        return <span className={cn("font-mono text-[12px]", fully ? "text-emerald-500" : partial ? "text-amber-500" : "text-muted-foreground")}>{a.toFixed(0)}g</span>;
      },
    },
    { accessorKey: "unit_price", header: "Unit Price", cell: ({ row }) => <span className="font-mono text-[12px]">${Number(row.original.unit_price).toFixed(2)}</span> },
    { accessorKey: "discount", header: "Discount", cell: ({ row }) => Number(row.original.discount ?? 0) > 0 ? <span className="font-mono text-[12px] text-emerald-500">-${Number(row.original.discount).toFixed(2)}</span> : <span className="text-muted-foreground">—</span> },
    {
      accessorKey: "sales_tax", header: "Tax",
      cell: ({ row }) => {
        const medical = order.sale_type === "RecreationalMedical";
        const exempt = medical && row.original.product?.is_doh_compliant;
        if (exempt) return <span className="text-[11px] text-emerald-500">$0 medical</span>;
        return <span className="font-mono text-[12px]">${Number(row.original.sales_tax ?? 0).toFixed(2)}</span>;
      },
    },
    { accessorKey: "line_total", header: "Line Total", cell: ({ row }) => <span className="font-mono text-[12px] font-semibold">${Number(row.original.line_total ?? 0).toFixed(2)}</span> },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => canEdit ? (
        <button onClick={() => onRemove(row.original.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ) : null,
    },
  ], [navigate, onRemove, canEdit, order]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-semibold">Line items</h3>
          {fullyAllocated && <StatusPill label="Fully allocated" variant="success" />}
        </div>
        {canEdit && <Button size="sm" onClick={onAdd} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Item</Button>}
      </div>
      <DataTable
        columns={columns} data={items} loading={loading}
        empty={{
          icon: Package, title: "No items yet",
          description: canEdit ? "Add products to this order." : "This order has no line items.",
          action: canEdit ? <Button onClick={onAdd} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Item</Button> : undefined,
        }}
      />
      {items.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 grid grid-cols-4 gap-3 text-[12px] font-mono">
          <div><div className="text-[10px] text-muted-foreground uppercase tracking-wider">Subtotal</div><div className="font-semibold">${Number(order.subtotal ?? 0).toFixed(2)}</div></div>
          <div><div className="text-[10px] text-muted-foreground uppercase tracking-wider">Discount</div><div className="font-semibold text-emerald-500">-${Number(order.discount_total ?? 0).toFixed(2)}</div></div>
          <div><div className="text-[10px] text-muted-foreground uppercase tracking-wider">Tax</div><div className="font-semibold">${Number(order.tax_total ?? 0).toFixed(2)}</div></div>
          <div><div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</div><div className="font-bold text-[14px]">${Number(order.total ?? 0).toFixed(2)}</div></div>
        </div>
      )}
    </div>
  );
}

// ─── Allocations ────────────────────────────────────────────────────────────
function AllocationsPanel({ allocations, items, loading, canAllocate, onAllocate, onDeallocate, packSuggestions, onPackAndAllocate }: {
  allocations: OrderAllocation[]; items: OrderItem[]; loading: boolean; canAllocate: boolean; onAllocate: () => void; onDeallocate: () => void;
  packSuggestions: PackToOrderSuggestion[]; onPackAndAllocate: (s: PackToOrderSuggestion) => void;
}) {
  const navigate = useNavigate();
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const columns: ColumnDef<OrderAllocation>[] = useMemo(() => [
    { id: "item", header: "Order Item", cell: ({ row }) => row.original.product?.name ?? <span className="text-muted-foreground">—</span> },
    { id: "batch", header: "Batch", cell: ({ row }) => row.original.batch ? <button onClick={() => navigate(`/inventory/batches/${row.original.batch!.id}`)} className="font-mono text-[12px] text-primary hover:underline">{row.original.batch.barcode}</button> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "quantity", header: "Qty Allocated", cell: ({ row }) => <span className="font-mono text-[12px] font-semibold">{Number(row.original.quantity).toFixed(1)}g</span> },
    { id: "remaining", header: "Batch Remaining", cell: ({ row }) => row.original.batch ? <span className="font-mono text-[12px] text-muted-foreground">{Number(row.original.batch.current_quantity ?? 0).toFixed(1)}g</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "new_barcode", header: "Sublot", cell: ({ row }) => row.original.new_barcode ? <span className="font-mono text-[11px] text-primary">{row.original.new_barcode}</span> : <span className="text-muted-foreground">—</span> },
  ], [navigate]);

  const unallocated = items.filter((i) => (i.allocated_quantity ?? 0) < Number(i.quantity ?? 0)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-semibold">Allocations</h3>
          {unallocated > 0 && <StatusPill label={`${unallocated} unallocated`} variant="warning" />}
          {unallocated === 0 && items.length > 0 && <StatusPill label="Fully allocated" variant="success" />}
        </div>
        <div className="flex items-center gap-2">
          {allocations.length > 0 && <Button size="sm" variant="outline" onClick={onDeallocate} className="gap-1.5"><XCircle className="w-3.5 h-3.5" /> Deallocate All</Button>}
          {canAllocate && <Button size="sm" onClick={onAllocate} className="gap-1.5"><Package className="w-3.5 h-3.5" /> Auto-Allocate (FIFO)</Button>}
        </div>
      </div>

      {packSuggestions.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Package className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold">{packSuggestions.length} item{packSuggestions.length === 1 ? "" : "s"} need packaging before allocation</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">A pack-to-order source batch can fulfill these — package the required quantity into a sublot first.</div>
            </div>
          </div>
          <ul className="divide-y divide-amber-500/20">
            {packSuggestions.map((s) => {
              const item = itemById.get(s.item_id);
              return (
                <li key={s.item_id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="text-[12px]">
                    <div className="font-medium">{item?.product?.name ?? "Item"}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">Source: {s.source_batch.barcode} · need {s.quantity_needed.toFixed(1)}g</div>
                  </div>
                  <Button size="sm" onClick={() => onPackAndAllocate(s)} className="gap-1.5 h-7 text-[11px]"><Package className="w-3 h-3" /> Package & Allocate</Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <DataTable
        columns={columns} data={allocations} loading={loading}
        empty={{
          icon: Package, title: "No allocations yet",
          description: "Auto-allocate pulls from available batches in FIFO order by creation date.",
          action: canAllocate ? <Button onClick={onAllocate} className="gap-1.5"><Package className="w-3.5 h-3.5" /> Auto-Allocate</Button> : undefined,
        }}
      />
    </div>
  );
}

// ─── Manifest ───────────────────────────────────────────────────────────────
function ManifestPanel({ orderId, canCreate }: { orderId: string; canCreate: boolean }) {
  const navigate = useNavigate();
  const [manifest, setManifest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("grow_manifests").select("id, external_id, status, ccrs_manifest_pdf_url, wcia_json_url").eq("order_id", orderId).maybeSingle();
      if (cancelled) return;
      setManifest(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  if (!manifest) {
    return canCreate
      ? <EmptyState icon={FileText} title="No manifest yet" description="Create a manifest from this order's allocations." action={<Button onClick={() => navigate(`/sales/manifests?create=1&order_id=${orderId}`)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Manifest</Button>} />
      : <EmptyState icon={FileText} title="No manifest yet" description="Allocate inventory first, then create a manifest." />;
  }
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[14px] font-semibold">Linked manifest</h3>
          <CopyableId value={manifest.external_id} className="text-[11px] mt-1" />
        </div>
        <StatusPill label={manifest.status ?? "draft"} variant="info" />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => navigate(`/sales/manifests/${manifest.id}`)} className="gap-1.5"><ArrowRight className="w-3.5 h-3.5" /> View Manifest</Button>
        {manifest.ccrs_manifest_pdf_url && <a href={manifest.ccrs_manifest_pdf_url} target="_blank" rel="noreferrer" className="text-[12px] text-primary hover:underline">CCRS PDF →</a>}
      </div>
    </div>
  );
}

// ─── Financials ─────────────────────────────────────────────────────────────
function FinancialsPanel({ order, items }: { order: Order; items: OrderItem[]; allocations: OrderAllocation[] }) {
  const totalCost = items.reduce((sum, i) => sum + (Number(i.quantity ?? 0) * Number(i.product?.unit_price ?? 0)), 0);
  const totalRevenue = Number(order.total ?? 0);
  const margin = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (margin / totalRevenue) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Margin summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} />
          <Stat label="Est. Cost" value={`$${totalCost.toFixed(2)}`} />
          <Stat label="Gross Margin" value={`$${margin.toFixed(2)}`} />
          <Stat label="Margin %" value={marginPct != null ? `${marginPct.toFixed(1)}%` : "—"} className={marginPct != null && marginPct < 20 ? "text-destructive" : marginPct != null && marginPct > 40 ? "text-emerald-500" : ""} />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Invoice & Payments</h3>
        <p className="text-[12px] text-muted-foreground italic">Invoice generation and payment tracking coming soon.</p>
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
function Stat({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="rounded-lg bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-[18px] font-bold font-mono tabular-nums", className)}>{value}</div>
    </div>
  );
}

void Edit;
