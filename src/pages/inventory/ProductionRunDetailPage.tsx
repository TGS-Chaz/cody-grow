import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Factory, Loader2, Play, CheckCircle2, XCircle, Activity, Package, ArrowRight,
  MoreHorizontal, Edit, CalendarDays, MapPin, Scale, FileStack,
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
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useProductionRun, useProductionInputs, useStartProductionRun, useVoidProductionRun,
  ProductionInput,
} from "@/hooks/useProduction";
import {
  CCRS_INVENTORY_CATEGORY_LABELS, CCRS_INVENTORY_CATEGORY_COLORS, CcrsInventoryCategory,
} from "@/lib/schema-enums";
import { FinalizeRunModal } from "./ProductionModals";
import { cn } from "@/lib/utils";

const RUN_STATUS_VARIANT: Record<string, "success" | "warning" | "critical" | "info" | "muted"> = {
  draft: "muted", in_progress: "warning", finalized: "success", voided: "critical",
};

export default function ProductionRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const setActiveTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const { data: run, loading, refresh } = useProductionRun(id);
  const { data: inputs, loading: inputsLoading } = useProductionInputs(id);
  const start = useStartProductionRun();
  const voidRun = useVoidProductionRun();

  const [finalizeOpen, setFinalizeOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("finalize") && run?.status === "in_progress") {
      setFinalizeOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("finalize");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, run?.status, setSearchParams]);

  const { setContext, clearContext } = useCodyContext();
  const payload = useMemo(() => {
    if (!run) return null;
    const totalInputs = inputs.reduce((sum, i) => sum + Number(i.quantity_used ?? 0), 0);
    return {
      run: { name: run.name, status: run.status, planned: run.planned_date, started: run.started_at, finalized: run.finalized_at },
      bom: run.bom?.name ?? null,
      output_product: run.output_product?.name ?? null,
      input_count: inputs.length,
      input_total_g: totalInputs,
      yield_g: run.yield_weight_grams,
      yield_ratio: run.yield_weight_grams && totalInputs > 0 ? (Number(run.yield_weight_grams) / totalInputs) * 100 : null,
      output_batch: run.output_batch?.barcode ?? null,
    };
  }, [run, inputs]);
  useEffect(() => {
    if (!run || !payload) return;
    setContext({ context_type: "production_run_detail", context_id: run.id, page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload, run?.id]);

  useShortcut(["s"], async () => {
    if (!run || run.status !== "draft") return;
    try { await start(run.id); toast.success("Run started"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  }, { description: "Start run", scope: "Run Detail", enabled: run?.status === "draft" && !finalizeOpen });
  useShortcut(["f"], () => setFinalizeOpen(true), { description: "Finalize run", scope: "Run Detail", enabled: run?.status === "in_progress" && !finalizeOpen });

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!run) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState icon={Factory} title="Run not found" description="This production run may have been voided or doesn't exist." primaryAction={<Button onClick={() => navigate("/inventory/production")}>← Back to production</Button>} />
      </div>
    );
  }

  const totalInputs = inputs.reduce((sum, i) => sum + Number(i.quantity_used ?? 0), 0);
  const yieldG = run.yield_weight_grams != null ? Number(run.yield_weight_grams) : null;
  const yieldRatio = yieldG != null && totalInputs > 0 ? (yieldG / totalInputs) * 100 : null;
  const cat = run.output_product?.ccrs_inventory_category as CcrsInventoryCategory | null;
  const catColor = cat ? CCRS_INVENTORY_CATEGORY_COLORS[cat] : null;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={run.name}
        breadcrumbs={[
          { label: "Inventory" },
          { label: "Production", to: "/inventory/production" },
          { label: run.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {run.status && <StatusPill label={run.status.replace(/_/g, " ")} variant={RUN_STATUS_VARIANT[run.status] ?? "muted"} />}
            {run.status === "draft" && (
              <Button onClick={async () => { try { await start(run.id); toast.success("Run started"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="gap-1.5">
                <Play className="w-3.5 h-3.5" /> Start Run
              </Button>
            )}
            {run.status === "in_progress" && (
              <Button onClick={() => setFinalizeOpen(true)} className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Finalize
              </Button>
            )}
            {run.status === "finalized" && run.output_batch && (
              <Button onClick={() => navigate(`/inventory/batches/${run.output_batch!.id}`)} className="gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" /> View Output Batch
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="w-9 h-9"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled><Edit className="w-3.5 h-3.5" /> Edit (soon)</DropdownMenuItem>
                {run.status !== "finalized" && run.status !== "voided" && (
                  <DropdownMenuItem onClick={async () => { try { await voidRun(run.id); toast.success("Voided"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                    <XCircle className="w-3.5 h-3.5" /> Void
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-6 -mt-4 flex-wrap">
        {run.bom && (
          <button onClick={() => navigate(`/inventory/production/bom/${run.bom!.id}`)} className="inline-flex items-center gap-1 text-primary hover:underline">
            <FileStack className="w-3 h-3" /> {run.bom.name}
          </button>
        )}
        {run.output_product && (
          <>
            <span>·</span>
            <button onClick={() => navigate(`/cultivation/products/${run.output_product!.id}`)} className="inline-flex items-center gap-1.5 text-primary hover:underline">
              <Package className="w-3 h-3" /> {run.output_product.name}
              {cat && catColor && <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", catColor.bg, catColor.text)}>{CCRS_INVENTORY_CATEGORY_LABELS[cat]}</span>}
            </button>
          </>
        )}
        {run.planned_date && <><span>·</span><span>Planned <DateTime value={run.planned_date} format="date-only" /></span></>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <InfoCard icon={FileStack} label="BOM">
          {run.bom
            ? <button onClick={() => navigate(`/inventory/production/bom/${run.bom!.id}`)} className="text-[13px] font-medium text-primary hover:underline">{run.bom.name}</button>
            : <span className="text-[13px] text-muted-foreground italic">Ad-hoc</span>}
        </InfoCard>
        <InfoCard icon={Package} label="Output Product">
          {run.output_product
            ? <button onClick={() => navigate(`/cultivation/products/${run.output_product!.id}`)} className="text-[13px] font-medium text-primary hover:underline text-left truncate block max-w-full">{run.output_product.name}</button>
            : <span className="text-[13px] text-muted-foreground">—</span>}
        </InfoCard>
        <InfoCard icon={Factory} label="Status">
          {run.status ? <StatusPill label={run.status.replace(/_/g, " ")} variant={RUN_STATUS_VARIANT[run.status] ?? "muted"} /> : <span className="text-[13px] text-muted-foreground">—</span>}
        </InfoCard>
        <InfoCard icon={CalendarDays} label="Dates">
          <div className="space-y-0.5 text-[11px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Planned</span><span>{run.planned_date ? new Date(run.planned_date).toLocaleDateString() : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Started</span><span>{run.started_at ? new Date(run.started_at).toLocaleDateString() : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Finalized</span><span>{run.finalized_at ? new Date(run.finalized_at).toLocaleDateString() : "—"}</span></div>
          </div>
        </InfoCard>
        <InfoCard icon={Scale} label="Yield">
          <div className="text-[18px] font-bold font-mono tabular-nums">{yieldG != null ? `${yieldG.toFixed(0)}g` : "—"}</div>
          {yieldRatio != null && <p className="text-[11px] text-muted-foreground font-mono">{yieldRatio.toFixed(1)}% of inputs</p>}
        </InfoCard>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="inputs">Inputs ({inputs.length})</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewPanel run={run} inputs={inputs} yieldG={yieldG} yieldRatio={yieldRatio} totalInputs={totalInputs} />
        </TabsContent>
        <TabsContent value="inputs">
          <InputsPanel inputs={inputs} loading={inputsLoading} />
        </TabsContent>
        <TabsContent value="output">
          <OutputPanel run={run} />
        </TabsContent>
        <TabsContent value="activity">
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[14px] font-semibold text-foreground mb-1">Audit log coming soon</p>
            <p className="text-[12px] text-muted-foreground">Run creation, start/finalize events, and input changes will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>

      <FinalizeRunModal
        open={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        run={run}
        inputs={inputs}
        onSuccess={() => refresh()}
      />
    </div>
  );
}

// ─── Overview ───────────────────────────────────────────────────────────────
function OverviewPanel({ run, inputs, yieldG, yieldRatio, totalInputs }: { run: any; inputs: ProductionInput[]; yieldG: number | null; yieldRatio: number | null; totalInputs: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card title="Run info">
          <Row label="Name" value={run.name} />
          <Row label="Status" value={run.status ? <StatusPill label={run.status.replace(/_/g, " ")} variant={RUN_STATUS_VARIANT[run.status] ?? "muted"} /> : "—"} />
          <Row label="BOM" value={run.bom?.name ?? <span className="italic text-muted-foreground">Ad-hoc</span>} />
          <Row label="Output product" value={run.output_product?.name ?? "—"} />
          <Row label="Storage area" value={run.area?.name ?? "—"} />
          <Row label="Requires new QA" value={run.requires_new_qa ? "Yes" : "No"} />
          <Row label="Planned" value={run.planned_date ? <DateTime value={run.planned_date} format="date-only" /> : "—"} />
          <Row label="Started" value={run.started_at ? <DateTime value={run.started_at} /> : "—"} />
          <Row label="Finalized" value={run.finalized_at ? <DateTime value={run.finalized_at} /> : "—"} />
          <Row label="Notes" value={run.notes ?? <span className="italic text-muted-foreground">None</span>} />
        </Card>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Estimated vs actual yield</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Inputs</div>
              <div className="text-[22px] font-bold font-mono tabular-nums">{totalInputs.toFixed(0)}<span className="text-[11px] text-muted-foreground">g</span></div>
            </div>
            <div className="rounded-lg bg-muted/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Yield</div>
              <div className="text-[22px] font-bold font-mono tabular-nums">{yieldG != null ? yieldG.toFixed(0) : "—"}<span className="text-[11px] text-muted-foreground">g</span></div>
            </div>
            <div className="rounded-lg bg-muted/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Ratio</div>
              <div className={cn("text-[22px] font-bold font-mono tabular-nums", yieldRatio == null ? "text-muted-foreground" : yieldRatio > 80 ? "text-emerald-500" : yieldRatio > 50 ? "text-amber-500" : "text-destructive")}>
                {yieldRatio != null ? `${yieldRatio.toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
          {run.status === "draft" && <p className="text-[12px]">This run is in draft. Review inputs and start when ready.</p>}
          {run.status === "in_progress" && <p className="text-[12px]">Run is active. Record yield weights and finalize when complete.</p>}
          {run.status === "finalized" && <p className="text-[12px]">Run complete. Output batch created and input quantities deducted.</p>}
          {yieldRatio != null && yieldRatio < 50 && <p className="text-[12px] text-destructive">Low yield ratio — investigate input quality or process efficiency.</p>}
          {inputs.length === 0 && <p className="text-[12px] text-muted-foreground">No inputs defined for this run.</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Inputs ─────────────────────────────────────────────────────────────────
function InputsPanel({ inputs, loading }: { inputs: ProductionInput[]; loading: boolean }) {
  const navigate = useNavigate();
  const total = inputs.reduce((sum, i) => sum + Number(i.quantity_used ?? 0), 0);

  const columns: ColumnDef<ProductionInput>[] = useMemo(() => [
    { id: "barcode", header: "Batch", cell: ({ row }) => row.original.batch
      ? <button onClick={() => navigate(`/inventory/batches/${row.original.batch!.id}`)} className="text-[12px] font-mono text-primary hover:underline">{row.original.batch.barcode}</button>
      : <span className="text-muted-foreground">—</span> },
    { id: "product", header: "Product", cell: ({ row }) => row.original.product?.name ?? <span className="text-muted-foreground">—</span> },
    { accessorKey: "quantity_used", header: "Qty Used", cell: ({ row }) => <span className="font-mono text-[12px] font-semibold">{Number(row.original.quantity_used ?? 0).toFixed(1)}</span> },
    { accessorKey: "weight_used_grams", header: "Weight Used", cell: ({ row }) => row.original.weight_used_grams != null ? <span className="font-mono text-[12px]">{Number(row.original.weight_used_grams).toFixed(1)}g</span> : <span className="text-muted-foreground">—</span> },
    { id: "remaining", header: "Batch Remaining", cell: ({ row }) => row.original.batch ? <span className="font-mono text-[12px] text-muted-foreground">{Number(row.original.batch.current_quantity ?? 0).toFixed(1)}g</span> : <span className="text-muted-foreground">—</span> },
  ], [navigate]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-4 py-2 rounded-lg border border-border bg-muted/30">
        <span className="text-[12px] font-medium">Total inputs</span>
        <span className="font-mono text-[13px] font-semibold">{total.toFixed(1)}g across {inputs.length} batch{inputs.length === 1 ? "" : "es"}</span>
      </div>
      <DataTable
        columns={columns}
        data={inputs}
        loading={loading}
        empty={{
          icon: Package,
          title: "No inputs",
          description: "This run has no input batches defined.",
        }}
      />
    </div>
  );
}

// ─── Output ─────────────────────────────────────────────────────────────────
function OutputPanel({ run }: { run: any }) {
  const navigate = useNavigate();
  if (run.status !== "finalized" || !run.output_batch) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <Package className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-[14px] font-semibold text-foreground mb-1">Output batch will be created when this run is finalized</p>
        <p className="text-[12px] text-muted-foreground">Finalize the run to create the output batch with final yield weights.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Output batch</div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[20px] font-semibold">{run.output_batch.barcode}</span>
            <StatusPill label="Created" variant="success" />
          </div>
          <div className="grid grid-cols-2 gap-6 pt-2 text-[12px]">
            <div><div className="text-muted-foreground text-[11px]">Product</div><div>{run.output_product?.name ?? "—"}</div></div>
            <div><div className="text-muted-foreground text-[11px]">Weight</div><div className="font-mono">{run.yield_weight_grams != null ? Number(run.yield_weight_grams).toFixed(1) : "—"}g</div></div>
            <div><div className="text-muted-foreground text-[11px]">Quantity</div><div className="font-mono">{run.yield_quantity != null ? Number(run.yield_quantity).toFixed(1) : "—"}</div></div>
            <div><div className="text-muted-foreground text-[11px]">Area</div><div>{run.area?.name ?? "—"}</div></div>
          </div>
        </div>
        <Button onClick={() => navigate(`/inventory/batches/${run.output_batch.id}`)} className="gap-1.5">
          <ArrowRight className="w-3.5 h-3.5" /> View Batch
        </Button>
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

void MapPin;
