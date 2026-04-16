import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FileStack, Loader2, Package, Edit, Copy, Archive, MoreHorizontal, Factory, Plus, ArrowRight,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import { useBOM, useProductionRuns, useArchiveBOM, ProductionRun } from "@/hooks/useProduction";
import {
  CCRS_INVENTORY_CATEGORY_LABELS, CCRS_INVENTORY_CATEGORY_COLORS, CcrsInventoryCategory,
} from "@/lib/schema-enums";
import { CreateProductionRunModal } from "./ProductionModals";
import { cn } from "@/lib/utils";

const RUN_STATUS_VARIANT: Record<string, "success" | "warning" | "critical" | "info" | "muted"> = {
  draft: "muted", in_progress: "warning", finalized: "success", voided: "critical",
};

export default function BOMDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: bom, loading, refresh } = useBOM(id);
  const { data: runs, loading: runsLoading, refresh: refreshRuns } = useProductionRuns({ bom_id: id });
  const archive = useArchiveBOM();
  const [createRunOpen, setCreateRunOpen] = useState(false);

  const columns: ColumnDef<ProductionRun>[] = useMemo(() => [
    { accessorKey: "name", header: "Run Name", cell: ({ row }) => <button onClick={() => navigate(`/inventory/production/${row.original.id}`)} className="text-[12px] font-medium text-primary hover:underline text-left">{row.original.name}</button> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => row.original.status ? <StatusPill label={row.original.status.replace(/_/g, " ")} variant={RUN_STATUS_VARIANT[row.original.status] ?? "muted"} /> : "—" },
    { accessorKey: "planned_date", header: "Planned", cell: ({ row }) => row.original.planned_date ? <DateTime value={row.original.planned_date} format="date-only" className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "yield_weight_grams", header: "Yield", cell: ({ row }) => row.original.yield_weight_grams != null ? <span className="font-mono text-[12px] font-semibold">{Number(row.original.yield_weight_grams).toFixed(0)}g</span> : <span className="text-muted-foreground">—</span> },
    { id: "inputs", header: "Inputs", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.input_count ?? 0}</span> },
    { accessorKey: "created_at", header: "Created", cell: ({ row }) => row.original.created_at ? <DateTime value={row.original.created_at} format="date-only" className="text-[12px]" /> : "—" },
  ], [navigate]);

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!bom) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState icon={FileStack} title="BOM not found" description="This BOM may have been archived or doesn't exist." primaryAction={<Button onClick={() => navigate("/inventory/production?tab=boms")}>← Back</Button>} />
      </div>
    );
  }

  const cat = bom.output_product?.ccrs_inventory_category as CcrsInventoryCategory | null;
  const catColor = cat ? CCRS_INVENTORY_CATEGORY_COLORS[cat] : null;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={bom.name}
        breadcrumbs={[
          { label: "Inventory" },
          { label: "Production", to: "/inventory/production" },
          { label: "BOMs", to: "/inventory/production?tab=boms" },
          { label: bom.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {bom.is_active ? <StatusPill label="Active" variant="success" /> : <StatusPill label="Archived" variant="muted" />}
            <Button onClick={() => setCreateRunOpen(true)} disabled={!bom.is_active} className="gap-1.5">
              <Factory className="w-3.5 h-3.5" /> Start Run
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="w-9 h-9"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled><Edit className="w-3.5 h-3.5" /> Edit (soon)</DropdownMenuItem>
                <DropdownMenuItem disabled><Copy className="w-3.5 h-3.5" /> Duplicate (soon)</DropdownMenuItem>
                {bom.is_active && (
                  <DropdownMenuItem onClick={async () => { try { await archive(bom.id); toast.success("Archived"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                    <Archive className="w-3.5 h-3.5" /> Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Output</h3>
            </div>
            <div className="px-5 py-4">
              {bom.output_product ? (
                <div className="flex items-center gap-3">
                  <Package className="w-8 h-8 text-primary" />
                  <div className="flex-1">
                    <button onClick={() => navigate(`/cultivation/products/${bom.output_product!.id}`)} className="text-[15px] font-semibold text-primary hover:underline">{bom.output_product.name}</button>
                    {cat && catColor && (
                      <div className="mt-1">
                        <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wider", catColor.bg, catColor.text)}>
                          {CCRS_INVENTORY_CATEGORY_LABELS[cat]}
                        </span>
                      </div>
                    )}
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              ) : <span className="text-[13px] text-muted-foreground italic">No output product</span>}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Inputs ({bom.inputs?.length ?? 0})</h3>
            </div>
            {(bom.inputs?.length ?? 0) === 0 ? (
              <div className="px-5 py-6 text-[12px] text-muted-foreground italic">No inputs defined.</div>
            ) : (
              <ul className="divide-y divide-border/50">
                {(bom.inputs ?? []).map((i, idx) => (
                  <li key={i.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-[11px] font-mono text-muted-foreground w-8">#{idx + 1}</span>
                    <div className="flex-1">
                      <div className="text-[12px] font-semibold">{i.input_category}</div>
                      {i.notes && <div className="text-[11px] text-muted-foreground">{i.notes}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Production runs using this BOM</h3>
              <Button size="sm" onClick={() => setCreateRunOpen(true)} disabled={!bom.is_active} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> New Run</Button>
            </div>
            <div className="p-4">
              <DataTable
                columns={columns}
                data={runs}
                loading={runsLoading}
                empty={{
                  icon: Factory,
                  title: "No runs yet",
                  description: "Start a production run from this BOM.",
                  action: bom.is_active ? <Button onClick={() => setCreateRunOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Run</Button> : undefined,
                }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">BOM details</h3>
            </div>
            <dl className="divide-y divide-border/50">
              <Row label="Status" value={bom.is_active ? <StatusPill label="Active" variant="success" /> : <StatusPill label="Archived" variant="muted" />} />
              <Row label="Input count" value={<span className="font-mono">{bom.input_count ?? 0}</span>} />
              <Row label="Run count" value={<span className="font-mono">{bom.run_count ?? 0}</span>} />
              <Row label="Byproduct" value={bom.byproduct_category ?? <span className="italic text-muted-foreground">None</span>} />
              <Row label="Created" value={bom.created_at ? <DateTime value={bom.created_at} /> : "—"} />
              <Row label="Notes" value={bom.notes ?? <span className="italic text-muted-foreground">None</span>} />
            </dl>
          </div>
        </div>
      </div>

      <CreateProductionRunModal open={createRunOpen} onClose={() => setCreateRunOpen(false)} initialBomId={bom.id} onSuccess={() => refreshRuns()} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 px-5 py-2.5">
      <dt className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</dt>
      <dd className="text-[12px] text-foreground">{value}</dd>
    </div>
  );
}
