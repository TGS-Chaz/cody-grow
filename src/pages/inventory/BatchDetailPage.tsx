import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Barcode, Loader2, CheckCircle2, XCircle, Scissors, Sliders, MoreHorizontal, Edit, Archive,
  Package, ArrowLeft, ShieldCheck, Heart, Store, ShoppingCart, Send, Plus, FlaskConical,
  DollarSign, Activity, Scale, MapPin, FileText, ArrowRight, TrendingDown,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/shared/PageHeader";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import CopyableId from "@/components/shared/CopyableId";
import BarcodeRenderer from "@/components/shared/BarcodeRenderer";
import CodyInsightsPanel from "@/components/cody/CodyInsightsPanel";
import BatchBriefPanel from "@/components/cody/BatchBriefPanel";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useBatch, useBatchQAResults, useBatchOrderHistory, useBatchAdjustments, useBatchChildren,
  useMakeBatchAvailable, useUpdateBatch, Batch,
} from "@/hooks/useBatches";
import { CCRS_INVENTORY_CATEGORY_LABELS, CCRS_INVENTORY_CATEGORY_COLORS, CcrsInventoryCategory, STRAIN_TYPE_COLORS, StrainType } from "@/lib/schema-enums";
import { SublotModal, AdjustInventoryModal, ReturnToParentModal } from "./BatchModals";
import { AddResultsModal } from "./QAModals";
import COAExtractor, { COAExtraction } from "@/components/ai/COAExtractor";
import MarketPricingCard from "@/components/ai/MarketPricingCard";
import { useMarketPrice } from "@/hooks/usePricingIntel";
import InlineAIEdit from "@/components/ai/InlineAIEdit";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalKey = "sublot" | "adjust" | "return" | null;

const QA_VARIANT: Record<NonNullable<Batch["qa_status"]>, { label: string; variant: "success" | "critical" | "warning" | "muted" }> = {
  passed: { label: "QA Passed", variant: "success" },
  failed: { label: "QA Failed", variant: "critical" },
  pending: { label: "QA Pending", variant: "warning" },
  not_required: { label: "QA N/A", variant: "muted" },
};

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const setActiveTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const { data: batch, loading, refresh } = useBatch(id);
  const { data: qaResults, loading: qaLoading } = useBatchQAResults(id, batch?.qa_source_batch_id);
  const { data: orders, loading: ordersLoading } = useBatchOrderHistory(id);
  const { data: adjustments, loading: adjLoading, refresh: refreshAdj } = useBatchAdjustments(id);
  const { data: children, loading: childrenLoading, refresh: refreshChildren } = useBatchChildren(id);
  const makeAvailable = useMakeBatchAvailable();

  const [modal, setModal] = useState<ModalKey>(null);
  const [aiEditOpen, setAiEditOpen] = useState(false);
  const updateBatch = useUpdateBatch();
  const [returnChild, setReturnChild] = useState<Batch | null>(null);

  const { setContext, clearContext } = useCodyContext();
  const sig = batch ? `${batch.id}:${batch.current_quantity}:${batch.is_available}:${batch.updated_at}` : "";
  const ageDays = batch?.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(batch.created_at).getTime()) / 86400000))
    : null;
  const codyPayload = useMemo(() => {
    if (!batch) return null;
    return {
      batch: {
        barcode: batch.barcode,
        external_id: batch.external_id,
        product: batch.product?.name,
        category: batch.product?.ccrs_inventory_category,
        strain: batch.strain?.name,
        initial_qty: batch.initial_quantity,
        current_qty: batch.current_quantity,
        source_type: batch.source_type,
        is_available: batch.is_available,
        is_medical: batch.is_medical,
        qa_status: batch.qa_status,
        qa_inherited_from: batch.qa_source_batch_id !== batch.id ? batch.parent_batch?.barcode : null,
        age_days: ageDays,
      },
      qa_results_count: qaResults.length,
      order_history_count: orders.length,
      adjustments_count: adjustments.length,
      children_count: children.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, qaResults.length, orders.length, adjustments.length, children.length]);

  useEffect(() => {
    if (!batch || !codyPayload) return;
    setContext({ context_type: "batch_detail", context_id: batch.id, page_data: codyPayload });
    return () => clearContext();
  }, [setContext, clearContext, codyPayload, batch?.id]);

  const modalOpen = modal !== null || !!returnChild;
  useShortcut(["e"], () => {/* edit coming soon */}, { description: "Edit", scope: "Batch Detail", enabled: !!batch && !modalOpen });
  useShortcut(["s"], () => setModal("sublot"), { description: "Sublot", scope: "Batch Detail", enabled: !!batch && !modalOpen });
  useShortcut(["a"], () => setModal("adjust"), { description: "Adjust", scope: "Batch Detail", enabled: !!batch && !modalOpen });
  useShortcut(["o"], () => toast.message("Create Order — coming soon"), { description: "Create order", scope: "Batch Detail", enabled: !!batch && !modalOpen });

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!batch) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState
          icon={Barcode}
          title="Batch not found"
          description="This batch may have been archived or doesn't exist."
          primaryAction={<Button onClick={() => navigate("/inventory/batches")}>← Back to batches</Button>}
        />
      </div>
    );
  }

  const initial = Number(batch.initial_quantity ?? 0);
  const current = Number(batch.current_quantity ?? 0);
  const pct = initial > 0 ? (current / initial) * 100 : 0;
  const depleted = current === 0;

  const cat = batch.product?.ccrs_inventory_category as CcrsInventoryCategory | null;
  const catColor = cat ? CCRS_INVENTORY_CATEGORY_COLORS[cat] : null;
  const strainType = batch.strain?.type as StrainType | null;
  const strainColor = strainType ? STRAIN_TYPE_COLORS[strainType] : null;
  const qaInherited = batch.qa_parent_batch_id && batch.qa_parent_batch_id !== batch.id;

  const handleMakeAvailable = async () => {
    try {
      await makeAvailable(batch.id);
      toast.success(`${batch.barcode} is now available`);
      refresh();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={batch.barcode}
        breadcrumbs={[
          { label: "Inventory" },
          { label: "Batches", to: "/inventory/batches" },
          { label: batch.barcode },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {batch.is_available && <StatusPill label="Available" variant="success" />}
            {!batch.is_available && !depleted && <StatusPill label="Quarantined" variant="warning" />}
            {depleted && <StatusPill label="Depleted" variant="muted" />}
            {batch.qa_status && <StatusPill label={QA_VARIANT[batch.qa_status].label} variant={QA_VARIANT[batch.qa_status].variant} />}

            {!batch.is_available && batch.qa_status === "passed" && !depleted && (
              <Button onClick={handleMakeAvailable} className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Make Available
              </Button>
            )}
            {batch.is_available && !depleted && (
              <Button onClick={() => toast.message("Create Order — coming soon")} className="gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5" /> Create Order
              </Button>
            )}

            <Button variant="outline" onClick={() => setModal("sublot")} disabled={depleted} className="gap-1.5">
              <Scissors className="w-3.5 h-3.5" /> Sublot
            </Button>
            <Button variant="outline" onClick={() => setModal("adjust")} className="gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> Adjust
            </Button>
            <Button variant="outline" onClick={() => setAiEditOpen(true)} className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Edit with Cody
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="w-9 h-9"><MoreHorizontal className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {batch.parent_batch && (
                  <DropdownMenuItem onClick={() => setReturnChild(batch)}>
                    <ArrowLeft className="w-3.5 h-3.5" /> Return to Parent
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled><Send className="w-3.5 h-3.5" /> Transfer (soon)</DropdownMenuItem>
                <DropdownMenuItem disabled><Store className="w-3.5 h-3.5" /> Add to Marketplace (soon)</DropdownMenuItem>
                <DropdownMenuItem disabled><Edit className="w-3.5 h-3.5" /> Edit (soon)</DropdownMenuItem>
                <DropdownMenuItem disabled className="text-destructive"><Archive className="w-3.5 h-3.5" /> Archive (soon)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-6 -mt-4 flex-wrap">
        {batch.product && (
          <button onClick={() => navigate(`/cultivation/products/${batch.product!.id}`)} className="inline-flex items-center gap-1.5 text-primary hover:underline">
            {batch.product.name}
            {cat && catColor && (
              <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", catColor.bg, catColor.text)}>
                {CCRS_INVENTORY_CATEGORY_LABELS[cat]}
              </span>
            )}
          </button>
        )}
        {batch.strain && (
          <>
            <span>·</span>
            <button onClick={() => navigate(`/cultivation/strains/${batch.strain!.id}`)} className="inline-flex items-center gap-1.5 text-primary hover:underline">
              {batch.strain.name}
              {strainType && strainColor && (
                <span className={cn("inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", strainColor.bg, strainColor.text)}>
                  {strainType}
                </span>
              )}
            </button>
          </>
        )}
        {batch.is_medical && <><span>·</span><span className="inline-flex items-center gap-1 text-pink-500"><Heart className="w-3 h-3" /> Medical</span></>}
        {batch.is_doh_compliant && <><span>·</span><span className="inline-flex items-center gap-1 text-blue-500"><ShieldCheck className="w-3 h-3" /> DOH</span></>}
        {(batch.marketplace_menu_ids?.length ?? 0) > 0 && <><span>·</span><span className="inline-flex items-center gap-1 text-purple-500"><Store className="w-3 h-3" /> Marketplace</span></>}
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-border bg-card p-5 mb-6">
        <div className="flex items-end justify-between mb-3 gap-3 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Quantity on hand</div>
            <div className="text-[28px] font-bold font-mono tabular-nums text-foreground">
              {current.toFixed(1)}g
              <span className="text-[14px] font-medium text-muted-foreground ml-2">of {initial.toFixed(1)}g initial</span>
            </div>
          </div>
          <div className="flex items-end gap-4">
            <BarcodeRenderer value={batch.barcode} format="code128" height={48} showText={false} />
            <div className={cn("text-[12px] font-mono", depleted ? "text-muted-foreground" : pct < 10 ? "text-destructive" : "text-foreground")}>
              {pct.toFixed(1)}% remaining
            </div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              depleted ? "bg-muted-foreground/40" : pct < 10 ? "bg-destructive" : "bg-emerald-500",
            )}
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      </div>

      {/* Key info grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <InfoCard icon={Barcode} label="Barcode">
          <div className="text-[13px] font-mono font-semibold truncate">{batch.barcode}</div>
          <CopyableId value={batch.external_id} className="text-[10px] mt-1" truncate={6} />
        </InfoCard>
        <InfoCard icon={Package} label="Product">
          {batch.product
            ? <button onClick={() => navigate(`/cultivation/products/${batch.product!.id}`)} className="text-[13px] font-medium text-primary hover:underline text-left truncate block max-w-full">{batch.product.name}</button>
            : <span className="text-[13px] text-muted-foreground">—</span>}
          {cat && <p className="text-[11px] text-muted-foreground">{CCRS_INVENTORY_CATEGORY_LABELS[cat]}</p>}
        </InfoCard>
        <InfoCard icon={Scale} label="Quantity">
          <div className="text-[18px] font-bold font-mono tabular-nums">{current.toFixed(0)}<span className="text-[11px] text-muted-foreground">g</span></div>
          <p className="text-[10px] text-muted-foreground">of {initial.toFixed(0)}g</p>
        </InfoCard>
        <InfoCard icon={FileText} label="Source">
          <div className="text-[13px] font-semibold capitalize">{batch.source_type?.replace(/_/g, " ") ?? "—"}</div>
          {batch.harvest && <button onClick={() => navigate(`/cultivation/harvests/${batch.harvest!.id}`)} className="text-[11px] text-primary hover:underline truncate block max-w-full">{batch.harvest.name}</button>}
          {batch.parent_batch && <button onClick={() => navigate(`/inventory/batches/${batch.parent_batch!.id}`)} className="text-[11px] font-mono text-primary hover:underline truncate block max-w-full">{batch.parent_batch.barcode}</button>}
        </InfoCard>
        <InfoCard icon={FlaskConical} label="QA">
          {batch.qa_status
            ? <StatusPill label={QA_VARIANT[batch.qa_status].label} variant={QA_VARIANT[batch.qa_status].variant} />
            : <span className="text-[13px] text-muted-foreground">—</span>}
          {qaInherited && <p className="text-[10px] text-muted-foreground mt-1">Inherited</p>}
        </InfoCard>
        <InfoCard icon={DollarSign} label="Cost">
          <div className="text-[13px] font-semibold font-mono">{batch.unit_cost != null ? `$${Number(batch.unit_cost).toFixed(2)}` : "—"}<span className="text-[10px] text-muted-foreground">/unit</span></div>
          {batch.unit_cost != null && <p className="text-[10px] text-muted-foreground">total ${(Number(batch.unit_cost) * initial).toFixed(2)}</p>}
        </InfoCard>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="qa">QA & Lab ({qaResults.length})</TabsTrigger>
          <TabsTrigger value="sublots">Sublots ({children.length})</TabsTrigger>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments ({adjustments.length})</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewPanel batch={batch} ageDays={ageDays} />
        </TabsContent>
        <TabsContent value="qa">
          <QAPanel batch={batch} results={qaResults} loading={qaLoading} />
        </TabsContent>
        <TabsContent value="sublots">
          <SublotsPanel
            children={children}
            loading={childrenLoading}
            onReturn={(c) => setReturnChild(c)}
            onCreateSublot={() => setModal("sublot")}
            depleted={depleted}
          />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersPanel orders={orders} loading={ordersLoading} initialQty={initial} currentQty={current} />
        </TabsContent>
        <TabsContent value="adjustments">
          <AdjustmentsPanel adjustments={adjustments} loading={adjLoading} onNew={() => setModal("adjust")} />
        </TabsContent>
        <TabsContent value="pricing">
          <PricingPanel batch={batch} />
        </TabsContent>
        <TabsContent value="activity">
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[14px] font-semibold text-foreground mb-1">Audit log coming soon</p>
            <p className="text-[12px] text-muted-foreground">Creation, sublots, adjustments, orders, and QA events will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>

      <SublotModal
        open={modal === "sublot"}
        onClose={() => setModal(null)}
        parent={batch}
        onSuccess={() => { refresh(); refreshChildren(); }}
      />
      <AdjustInventoryModal
        open={modal === "adjust"}
        onClose={() => setModal(null)}
        batch={batch}
        onSuccess={() => { refresh(); refreshAdj(); }}
      />
      <ReturnToParentModal
        open={!!returnChild}
        onClose={() => setReturnChild(null)}
        child={returnChild}
        onSuccess={() => { refresh(); refreshChildren(); }}
      />
      <InlineAIEdit
        open={aiEditOpen}
        onClose={() => setAiEditOpen(false)}
        entityType="batch"
        entity={batch as unknown as Record<string, unknown>}
        editableFields={[
          "notes", "unit_cost", "procurement_farm", "procurement_license",
          "expiration_date", "packaged_date", "is_available", "image_url", "marketplace_group_id",
        ]}
        onApply={async (_m, patch) => { await updateBatch(batch.id, patch as any); refresh(); }}
      />
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────
function OverviewPanel({ batch, ageDays }: { batch: Batch; ageDays: number | null }) {
  const navigate = useNavigate();
  const booleanFlags = [
    ["Available", batch.is_available],
    ["Medical", batch.is_medical],
    ["DOH Compliant", batch.is_doh_compliant],
    ["Trade Sample", batch.is_trade_sample],
    ["Employee Sample", batch.is_employee_sample],
    ["Non-Cannabis", batch.is_non_cannabis],
    ["Pack to Order", batch.is_pack_to_order],
  ] as const;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card title="Batch info">
          <Row label="Barcode" value={<span className="font-mono font-semibold">{batch.barcode}</span>} />
          <Row label="External ID" value={<CopyableId value={batch.external_id} className="text-[11px]" />} />
          <Row label="Strain" value={batch.strain ? <button onClick={() => navigate(`/cultivation/strains/${batch.strain!.id}`)} className="text-primary hover:underline">{batch.strain.name}</button> : "—"} />
          <Row label="Area" value={batch.area ? <button onClick={() => navigate(`/cultivation/areas/${batch.area!.id}`)} className="text-primary hover:underline">{batch.area.name}</button> : "—"} />
          <Row label="Source" value={<span className="capitalize">{batch.source_type?.replace(/_/g, " ") ?? "—"}</span>} />
          <Row label="Unit cost" value={batch.unit_cost != null ? <span className="font-mono">${Number(batch.unit_cost).toFixed(2)}</span> : "—"} />
          <Row label="Packaged date" value={batch.packaged_date ? <DateTime value={batch.packaged_date} format="date-only" /> : "—"} />
          <Row label="Expiration date" value={batch.expiration_date ? <DateTime value={batch.expiration_date} format="date-only" /> : "—"} />
          <Row label="Procurement farm" value={batch.procurement_farm ?? "—"} />
          <Row label="Procurement license" value={batch.procurement_license ?? "—"} />
          <Row label="Created" value={batch.created_at ? <DateTime value={batch.created_at} /> : "—"} />
        </Card>

        <Card title="Source">
          {batch.harvest && (
            <div className="px-5 py-3 flex items-center justify-between">
              <div className="text-[12px]">
                <p className="text-muted-foreground">From harvest</p>
                <button onClick={() => navigate(`/cultivation/harvests/${batch.harvest!.id}`)} className="text-[13px] font-medium text-primary hover:underline">{batch.harvest.name}</button>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          {batch.parent_batch && (
            <div className="px-5 py-3 flex items-center justify-between">
              <div className="text-[12px]">
                <p className="text-muted-foreground">Sublot of</p>
                <button onClick={() => navigate(`/inventory/batches/${batch.parent_batch!.id}`)} className="text-[13px] font-mono font-medium text-primary hover:underline">{batch.parent_batch.barcode}</button>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          {batch.production_run && (
            <div className="px-5 py-3">
              <p className="text-[11px] text-muted-foreground">From production run</p>
              <p className="text-[13px] font-medium">{batch.production_run.name ?? batch.production_run.id}</p>
            </div>
          )}
          {!batch.harvest && !batch.parent_batch && !batch.production_run && (
            <div className="px-5 py-3 text-[12px] text-muted-foreground italic">Created manually</div>
          )}
        </Card>

        <Card title="Compliance flags">
          <div className="px-5 py-3 flex flex-wrap gap-2">
            {booleanFlags.map(([label, v]) => (
              <span key={label} className={cn(
                "inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-medium",
                v ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground/60",
              )}>
                {v ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {label}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <BatchBriefPanel batchId={batch.id} />
        <BatchPricingCard batch={batch} />
        <CodyInsightsPanel entity_type="batch" entity_id={batch.id} />
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-[12px]">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
          {ageDays != null && (
            <p className="text-foreground">In inventory for <span className="font-semibold">{ageDays} day{ageDays === 1 ? "" : "s"}</span>.</p>
          )}
          {!batch.is_available && batch.qa_status === "passed" && (
            <p className="text-foreground">QA has passed — you can mark this batch available for sale.</p>
          )}
          {!batch.is_available && batch.qa_status === "pending" && (
            <p className="text-foreground">Awaiting QA — once results come back, you can make this batch available.</p>
          )}
          {batch.is_available && Number(batch.current_quantity) > 0 && (
            <p className="text-foreground">Batch is live and available for allocation.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── QA ─────────────────────────────────────────────────────────────────────
function QAPanel({ batch, results, loading }: { batch: Batch; results: any[]; loading: boolean }) {
  const navigate = useNavigate();
  const inherited = batch.qa_parent_batch_id && batch.qa_parent_batch_id !== batch.id;
  const latest = results[0];
  const [coaOpen, setCoaOpen] = useState(false);
  const [addResultsOpen, setAddResultsOpen] = useState(false);
  const [prefill, setPrefill] = useState<COAExtraction | null>(null);

  const columns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: "test_name", header: "Test", cell: ({ row }) => <span className="text-[12px] font-medium">{row.original.test_name ?? row.original.lot?.lot_number ?? "—"}</span> },
    { accessorKey: "test_date", header: "Date", cell: ({ row }) => row.original.test_date ? <DateTime value={row.original.test_date} format="date-only" className="text-[12px]" /> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "test_value", header: "Value", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.test_value ?? "—"}</span> },
    {
      accessorKey: "overall_pass", header: "Status",
      cell: ({ row }) => row.original.overall_pass === true
        ? <StatusPill label="Pass" variant="success" />
        : row.original.overall_pass === false
          ? <StatusPill label="Fail" variant="critical" />
          : <StatusPill label="Pending" variant="warning" />,
    },
    { accessorKey: "lab_name", header: "Lab", cell: ({ row }) => <span className="text-[12px]">{row.original.lab_name ?? "—"}</span> },
    {
      id: "coa", header: "COA",
      cell: ({ row }) => (row.original.coa_urls?.length ?? 0) > 0
        ? <a href={row.original.coa_urls[0]} target="_blank" rel="noreferrer" className="text-[12px] text-primary hover:underline">View</a>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
  ], []);

  return (
    <div className="space-y-4">
      {inherited && batch.parent_batch && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
          <FlaskConical className="w-4 h-4 text-amber-500" />
          <div className="flex-1 text-[12px]">
            QA results inherited from parent batch <button onClick={() => navigate(`/inventory/batches/${batch.parent_batch!.id}`)} className="font-mono font-semibold text-primary hover:underline">{batch.parent_batch.barcode}</button>
          </div>
        </div>
      )}

      {latest && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Latest potency</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <PotencyStat label="THC Total" value={latest.thc_total_pct} color="text-emerald-500" />
            <PotencyStat label="CBD Total" value={latest.cbd_total_pct} color="text-blue-500" />
            <PotencyStat label="Total Terpenes" value={latest.total_terpenes_pct} color="text-purple-500" />
            <PotencyStat label="Moisture" value={latest.moisture_pct} color="text-cyan-500" />
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold">Test results</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setCoaOpen(true)} className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Extract from COA
            </Button>
            <Button size="sm" variant="outline" disabled className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Submit for Testing (soon)
            </Button>
          </div>
        </div>
        <COAExtractor
          open={coaOpen}
          onClose={() => setCoaOpen(false)}
          onExtracted={(data) => { setPrefill(data); setAddResultsOpen(true); }}
        />
        <AddResultsModal
          open={addResultsOpen}
          onClose={() => { setAddResultsOpen(false); setPrefill(null); }}
          prefill={prefill}
        />

        <DataTable
          columns={columns}
          data={results}
          loading={loading}
          empty={{
            icon: FlaskConical,
            title: "No QA results",
            description: inherited ? "Parent batch QA results not yet available." : "Submit this batch for lab testing.",
          }}
        />
      </div>
    </div>
  );
}

function PotencyStat({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-[22px] font-bold font-mono tabular-nums", value != null ? color : "text-muted-foreground")}>
        {value != null ? `${Number(value).toFixed(2)}%` : "—"}
      </div>
    </div>
  );
}

function BatchPricingCard({ batch }: { batch: Batch }) {
  const pricing = useMarketPrice(
    (batch as any).ccrs_inventory_category ?? batch.product?.category,
    batch.strain?.name,
    batch.unit_cost != null ? Number(batch.unit_cost) : null,
  );
  return <MarketPricingCard data={pricing} categoryLabel={(batch as any).ccrs_inventory_category ?? batch.product?.category} strainName={batch.strain?.name} />;
}

// ─── Sublots ────────────────────────────────────────────────────────────────
function SublotsPanel({ children, loading, onReturn, onCreateSublot, depleted }: {
  children: Batch[];
  loading: boolean;
  onReturn: (child: Batch) => void;
  onCreateSublot: () => void;
  depleted: boolean;
}) {
  const navigate = useNavigate();
  const columns: ColumnDef<Batch>[] = useMemo(() => [
    {
      accessorKey: "barcode", header: "Barcode",
      cell: ({ row }) => <button onClick={() => navigate(`/inventory/batches/${row.original.id}`)} className="text-[12px] font-mono font-semibold text-primary hover:underline">{row.original.barcode}</button>,
    },
    {
      id: "product", header: "Product",
      cell: ({ row }) => row.original.product ? <span className="text-[12px]">{row.original.product.name}</span> : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "quantity", header: "Qty",
      cell: ({ row }) => (
        <span className="font-mono text-[12px]">
          {Number(row.original.current_quantity).toFixed(0)}g
          <span className="text-muted-foreground/50 ml-1">/ {Number(row.original.initial_quantity).toFixed(0)}g</span>
        </span>
      ),
    },
    {
      id: "area", header: "Area",
      cell: ({ row }) => row.original.area?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "qa", header: "QA",
      cell: ({ row }) => row.original.qa_status
        ? <StatusPill label={QA_VARIANT[row.original.qa_status].label} variant={QA_VARIANT[row.original.qa_status].variant} />
        : <StatusPill label="N/A" variant="muted" />,
    },
    {
      id: "available", header: "Available",
      cell: ({ row }) => row.original.is_available
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        : <XCircle className="w-4 h-4 text-muted-foreground/50" />,
    },
    {
      accessorKey: "created_at", header: "Created",
      cell: ({ row }) => row.original.created_at ? <DateTime value={row.original.created_at} format="date-only" className="text-[12px]" /> : "—",
    },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => onReturn(row.original)} className="gap-1 h-7 px-2 text-[11px]">
          <ArrowLeft className="w-3 h-3" /> Return
        </Button>
      ),
    },
  ], [navigate, onReturn]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Sublots of this batch</h3>
        <Button size="sm" onClick={onCreateSublot} disabled={depleted} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Create Sublot
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={children}
        loading={loading}
        empty={{
          icon: Scissors,
          title: "No sublots yet",
          description: "Sublots split off portions of this batch — useful for packaging subsets while keeping bulk inventory.",
          action: <Button onClick={onCreateSublot} disabled={depleted} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Sublot</Button>,
        }}
      />
    </div>
  );
}

// ─── Orders ─────────────────────────────────────────────────────────────────
function OrdersPanel({ orders, loading, initialQty, currentQty }: { orders: any[]; loading: boolean; initialQty: number; currentQty: number }) {
  const navigate = useNavigate();
  const columns: ColumnDef<any>[] = useMemo(() => [
    {
      id: "order", header: "Order #",
      cell: ({ row }) => row.original.order
        ? <button onClick={() => navigate(`/sales/orders/${row.original.order.id}`)} className="text-[12px] font-mono text-primary hover:underline">{row.original.order.order_number}</button>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "status", header: "Status",
      cell: ({ row }) => row.original.order?.status ? <StatusPill label={row.original.order.status} variant="info" /> : "—",
    },
    {
      id: "quantity", header: "Qty",
      cell: ({ row }) => <span className="font-mono text-[12px]">{Number(row.original.quantity ?? 0).toFixed(1)}g</span>,
    },
    {
      id: "unit_price", header: "Unit Price",
      cell: ({ row }) => row.original.item?.unit_price != null
        ? <span className="font-mono text-[12px]">${Number(row.original.item.unit_price).toFixed(2)}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "created", header: "Date",
      cell: ({ row }) => row.original.created_at ? <DateTime value={row.original.created_at} format="date-only" className="text-[12px]" /> : "—",
    },
  ], [navigate]);

  const depletionSeries = useMemo(() => {
    if (orders.length === 0) return [] as Array<{ date: string; remaining: number }>;
    const sorted = [...orders].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    let remaining = initialQty;
    const points: Array<{ date: string; remaining: number }> = [{ date: "start", remaining: initialQty }];
    sorted.forEach((a) => {
      remaining -= Number(a.quantity ?? 0);
      points.push({ date: new Date(a.created_at).toISOString().slice(0, 10), remaining: Math.max(0, remaining) });
    });
    points.push({ date: "now", remaining: currentQty });
    return points;
  }, [orders, initialQty, currentQty]);

  return (
    <div className="space-y-4">
      {orders.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" /> Depletion over time
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={depletionSeries}>
                <defs>
                  <linearGradient id="depletion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(168 100% 42%)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(168 100% 42%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Area type="monotone" dataKey="remaining" stroke="hsl(168 100% 42%)" fill="url(#depletion)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        empty={{
          icon: ShoppingCart,
          title: "No orders yet",
          description: "Orders containing this batch will appear here once created.",
        }}
      />
    </div>
  );
}

// ─── Adjustments ────────────────────────────────────────────────────────────
function AdjustmentsPanel({ adjustments, loading, onNew }: { adjustments: any[]; loading: boolean; onNew: () => void }) {
  const columns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: "adjustment_date", header: "Date", cell: ({ row }) => <DateTime value={row.original.adjustment_date} format="date-only" className="text-[12px]" /> },
    {
      accessorKey: "adjustment_reason", header: "Reason",
      cell: ({ row }) => <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">{row.original.adjustment_reason}</span>,
    },
    {
      accessorKey: "quantity_delta", header: "Delta",
      cell: ({ row }) => {
        const d = Number(row.original.quantity_delta ?? 0);
        return <span className={cn("font-mono text-[12px] font-semibold", d > 0 ? "text-emerald-500" : "text-destructive")}>{d > 0 ? "+" : ""}{d.toFixed(1)}g</span>;
      },
    },
    { accessorKey: "adjustment_detail", header: "Detail", cell: ({ row }) => <span className="text-[12px] text-muted-foreground">{row.original.adjustment_detail ?? "—"}</span> },
    {
      accessorKey: "ccrs_reported", header: "CCRS",
      cell: ({ row }) => row.original.ccrs_reported
        ? <StatusPill label="Reported" variant="success" />
        : <StatusPill label="Pending" variant="muted" />,
    },
  ], []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Inventory adjustments</h3>
        <Button size="sm" onClick={onNew} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Adjust Inventory</Button>
      </div>
      <DataTable
        columns={columns}
        data={adjustments}
        loading={loading}
        empty={{
          icon: Sliders,
          title: "No adjustments",
          description: "Destruction, reconciliation, loss, and other inventory changes are tracked here.",
          action: <Button onClick={onNew} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Adjust Inventory</Button>,
        }}
      />
    </div>
  );
}

// ─── Pricing ────────────────────────────────────────────────────────────────
function PricingPanel({ batch }: { batch: Batch }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <DollarSign className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
      <p className="text-[14px] font-semibold mb-1">Pricing comes from the product</p>
      <p className="text-[12px] text-muted-foreground mb-4">
        This batch's pricing is inherited from its product. Review price lists to manage how this product is sold across customer tiers.
      </p>
      {batch.product && (
        <Button variant="outline" onClick={() => navigate("/settings/customer-setup")} className="gap-1.5">
          <ArrowRight className="w-3.5 h-3.5" /> View price lists
        </Button>
      )}
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
