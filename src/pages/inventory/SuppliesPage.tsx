import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package, Plus, Eye, Edit, MoreHorizontal, AlertTriangle, DollarSign, Archive, Boxes,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import DateTime from "@/components/shared/DateTime";
import { useCodyContext } from "@/hooks/useCodyContext";
import { useBatches, Batch } from "@/hooks/useBatches";
import { CreateBatchModal } from "./BatchModals";
import { cn } from "@/lib/utils";

export default function SuppliesPage() {
  const navigate = useNavigate();
  const { data: batches, loading, refresh } = useBatches({ is_non_cannabis: true });
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const stats = useMemo(() => {
    const total = batches.length;
    const lowStock = batches.filter((b) => {
      const reorder = (b as any).reorder_point != null ? Number((b as any).reorder_point) : null;
      return reorder != null && Number(b.current_quantity ?? 0) < reorder;
    }).length;
    const totalValue = batches.reduce((s, b) => s + (Number(b.unit_cost ?? 0) * Number(b.current_quantity ?? 0)), 0);
    return { total, lowStock, totalValue };
  }, [batches]);

  const { setContext, clearContext } = useCodyContext();
  useEffect(() => {
    setContext({ context_type: "supplies_list", page_data: { stats } });
    return () => clearContext();
  }, [setContext, clearContext, stats]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter((b) => `${b.barcode} ${b.product?.name ?? ""} ${b.product?.sku ?? ""}`.toLowerCase().includes(q));
  }, [batches, search]);

  const columns: ColumnDef<Batch>[] = useMemo(() => [
    { accessorKey: "barcode", header: "Item", cell: ({ row }) => <button onClick={() => navigate(`/inventory/batches/${row.original.id}`)} className="text-[12px] font-medium text-primary hover:underline text-left">{row.original.product?.name ?? row.original.barcode}</button> },
    { id: "sku", header: "SKU / Barcode", cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.product?.sku ?? row.original.barcode}</span> },
    { accessorKey: "current_quantity", header: "On Hand", cell: ({ row }) => {
      const cur = Number(row.original.current_quantity ?? 0);
      const reorder = (row.original as any).reorder_point != null ? Number((row.original as any).reorder_point) : null;
      const low = reorder != null && cur < reorder;
      return <span className={cn("font-mono text-[12px]", low ? "text-destructive font-semibold" : "")}>{cur.toFixed(0)}</span>;
    } },
    { id: "reorder_point", header: "Reorder At", cell: ({ row }) => (row.original as any).reorder_point != null ? <span className="font-mono text-[12px] text-muted-foreground">{Number((row.original as any).reorder_point).toFixed(0)}</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "unit_cost", header: "Unit Cost", cell: ({ row }) => row.original.unit_cost != null ? <span className="font-mono text-[12px]">${Number(row.original.unit_cost).toFixed(2)}</span> : <span className="text-muted-foreground">—</span> },
    { id: "total_value", header: "Total Value", cell: ({ row }) => row.original.unit_cost != null ? <span className="font-mono text-[12px] font-semibold">${(Number(row.original.unit_cost) * Number(row.original.current_quantity ?? 0)).toFixed(2)}</span> : <span className="text-muted-foreground">—</span> },
    { id: "area", header: "Area", cell: ({ row }) => row.original.area?.name ?? <span className="text-muted-foreground">—</span> },
    { accessorKey: "created_at", header: "Last Restocked", cell: ({ row }) => row.original.created_at ? <DateTime value={row.original.created_at} format="date-only" className="text-[12px]" /> : "—" },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/inventory/batches/${row.original.id}`)}><Eye className="w-3.5 h-3.5" /> View</DropdownMenuItem>
              <DropdownMenuItem disabled><Edit className="w-3.5 h-3.5" /> Edit (soon)</DropdownMenuItem>
              <DropdownMenuItem disabled className="text-destructive"><Archive className="w-3.5 h-3.5" /> Archive (soon)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
  ], [navigate]);

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title="Supplies & Non-Cannabis"
        description="Packaging, labels, consumables — everything that isn't cannabis"
        breadcrumbs={[{ label: "Inventory" }, { label: "Supplies" }]}
        actions={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Supply Item</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Items" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Low Stock" value={stats.lowStock} accentClass="stat-accent-amber" delay={0.05} />
        <StatCard label="Total Value" value={`$${stats.totalValue.toFixed(2)}`} accentClass="stat-accent-teal" delay={0.1} />
      </div>

      <FiltersBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search name, SKU, barcode…" />

      <DataTable
        columns={columns} data={filtered} loading={loading}
        empty={{
          icon: Boxes,
          title: batches.length === 0 ? "No supply items yet" : "No matches",
          description: batches.length === 0 ? "Track packaging, labels, jars, gloves, and other consumables." : "Clear the search.",
          action: batches.length === 0 ? <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Supply Item</Button> : undefined,
        }}
      />

      <CreateBatchModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => refresh()} />
    </div>
  );
}

void Package; void AlertTriangle; void DollarSign;
