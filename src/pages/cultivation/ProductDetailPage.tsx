import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Package, Edit, Copy, Archive, Loader2, FileText, Activity, DollarSign,
  ClipboardCheck, Barcode, Sparkles, ShieldCheck, Baby, Leaf, Info,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import StatusPill from "@/components/shared/StatusPill";
import DataTable from "@/components/shared/DataTable";
import CopyableId from "@/components/shared/CopyableId";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import CodyInsightsPanel from "@/components/cody/CodyInsightsPanel";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useProduct, useProducts, useProductBatches, useProductSalesHistory,
  useProductLabResults, useProductPricing,
  Product, ProductInput,
} from "@/hooks/useProducts";
import {
  CCRS_INVENTORY_CATEGORY_LABELS, CCRS_INVENTORY_CATEGORY_COLORS,
  CCRS_INVENTORY_EDIBLE_TYPES, CCRS_INVENTORY_TYPE_WARNING_TEXT,
  UNIT_OF_MEASURE_LABELS, UnitOfMeasure,
} from "@/lib/schema-enums";
import ProductFormModal from "./ProductFormModal";
import { cn } from "@/lib/utils";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const setActiveTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const { data: product, loading, refresh } = useProduct(id);
  const { updateProduct, archiveProduct, duplicateProduct } = useProducts();
  const [editOpen, setEditOpen] = useState(false);

  const { setContext, clearContext } = useCodyContext();
  const sig = product ? `${product.id}:${product.updated_at}` : "";
  const codyPayload = useMemo(() => {
    if (!product) return null;
    return {
      product: {
        name: product.name,
        category: product.ccrs_inventory_category,
        type: product.ccrs_inventory_type,
        sku: product.sku,
        strain: product.strain?.name,
        product_line: product.product_line?.name,
        unit_price: product.unit_price,
        cost_per_unit: product.cost_per_unit,
        active_batches: product.active_batch_count,
        compliance: {
          is_medical: product.is_medical,
          is_doh_compliant: product.is_doh_compliant,
          requires_lab_testing: product.requires_lab_testing,
          requires_child_resistant_packaging: product.requires_child_resistant_packaging,
        },
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (!product || !codyPayload) return;
    setContext({ context_type: "product_detail", context_id: product.id, page_data: codyPayload });
    return () => clearContext();
  }, [setContext, clearContext, codyPayload, product?.id]);

  useShortcut(["e"], () => setEditOpen(true), { description: "Edit product", scope: "Product Detail", enabled: !!product && !editOpen });

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!product) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState
          icon={Package}
          title="Product not found"
          description="This product may have been archived or does not exist."
          primaryAction={<Button onClick={() => navigate("/cultivation/products")}>← Back to products</Button>}
        />
      </div>
    );
  }

  const category = product.ccrs_inventory_category;
  const color = category ? CCRS_INVENTORY_CATEGORY_COLORS[category] : null;

  const handleSave = async (input: ProductInput) => {
    const row = await updateProduct(product.id, input);
    refresh();
    return row;
  };

  const handleDuplicate = async () => {
    try {
      const dup = await duplicateProduct(product);
      toast.success(`Duplicated as "${dup.name}"`);
      navigate(`/cultivation/products/${dup.id}`);
    } catch (e: any) { toast.error(e?.message ?? "Duplicate failed"); }
  };

  const handleArchive = async () => {
    if (!confirm(`Archive "${product.name}"?`)) return;
    try {
      await archiveProduct(product.id);
      toast.success("Product archived");
      navigate("/cultivation/products");
    } catch (e: any) { toast.error(e?.message ?? "Archive failed"); }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={product.name}
        breadcrumbs={[
          { label: "Cultivation" },
          { label: "Products", to: "/cultivation/products" },
          { label: product.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {category && color && (
              <span className={cn("inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider", color.bg, color.text)}>
                {CCRS_INVENTORY_CATEGORY_LABELS[category]}
              </span>
            )}
            {product.ccrs_inventory_type && (
              <span className="text-[11px] px-2 py-1 rounded bg-muted text-muted-foreground font-medium">{product.ccrs_inventory_type}</span>
            )}
            <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Edit className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button variant="outline" onClick={handleDuplicate} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </Button>
            <Button variant="outline" disabled className="gap-1.5" title="Coming soon">
              <FileText className="w-3.5 h-3.5" /> Generate Label
            </Button>
            <Button variant="outline" onClick={handleArchive} className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10">
              <Archive className="w-3.5 h-3.5" /> Archive
            </Button>
          </div>
        }
      />

      {/* Hero subtitle */}
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-6 -mt-4 flex-wrap">
        {product.product_line && (
          <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-muted text-foreground text-[11px] font-medium">
            <Package className="w-3 h-3" /> {product.product_line.name}
          </span>
        )}
        {product.strain && (
          <button onClick={() => navigate(`/cultivation/strains/${product.strain!.id}`)} className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-emerald-500/10 text-emerald-500 text-[11px] font-medium hover:bg-emerald-500/20">
            <Leaf className="w-3 h-3" /> {product.strain.name}
          </button>
        )}
        {product.sku && <CopyableId value={product.sku} />}
        {product.upc && <CopyableId value={product.upc} truncate={4} />}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Category / Type" value="" accentClass="stat-accent-blue">
          <div className="mt-1">
            {category && <p className={cn("text-[13px] font-semibold", color?.text)}>{CCRS_INVENTORY_CATEGORY_LABELS[category]}</p>}
            {product.ccrs_inventory_type && <p className="text-[11px] text-muted-foreground">{product.ccrs_inventory_type}</p>}
          </div>
        </StatCard>
        <StatCard
          label="Default Price"
          value={product.unit_price != null ? `$${Number(product.unit_price).toFixed(2)}` : "—"}
          accentClass="stat-accent-emerald"
          delay={0.05}
        />
        <StatCard
          label="Active Batches"
          value={product.active_batch_count ?? 0}
          accentClass="stat-accent-teal"
          delay={0.1}
          onClick={() => setActiveTab("batches")}
        />
        <StatCard
          label="Total Sold"
          value="—"
          accentClass="stat-accent-amber"
          delay={0.15}
          trend="awaiting sales data"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="sales">Sales History</TabsTrigger>
          <TabsTrigger value="lab">Lab Results</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewPanel product={product} /></TabsContent>
        <TabsContent value="batches"><BatchesPanel productId={product.id} /></TabsContent>
        <TabsContent value="sales"><SalesPanel productId={product.id} /></TabsContent>
        <TabsContent value="lab"><LabResultsPanel productId={product.id} /></TabsContent>
        <TabsContent value="pricing"><PricingPanel productId={product.id} /></TabsContent>
        <TabsContent value="activity">
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[14px] font-semibold text-foreground mb-1">Audit log coming soon</p>
            <p className="text-[12px] text-muted-foreground">Product edits, price changes, and compliance updates will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>

      <ProductFormModal open={editOpen} onClose={() => setEditOpen(false)} editing={product} onSave={handleSave} />
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewPanel({ product }: { product: Product }) {
  const margin = useMemo(() => {
    if (product.unit_price == null || product.cost_per_unit == null) return null;
    const price = Number(product.unit_price);
    const cost = Number(product.cost_per_unit);
    if (price <= 0) return null;
    return ((price - cost) / price) * 100;
  }, [product.unit_price, product.cost_per_unit]);

  const isEdible = product.ccrs_inventory_type && CCRS_INVENTORY_EDIBLE_TYPES.includes(product.ccrs_inventory_type);
  const warning = product.warning_text?.trim() || (product.ccrs_inventory_type ? CCRS_INVENTORY_TYPE_WARNING_TEXT[product.ccrs_inventory_type] : null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Product Info */}
        <Card title="Product Info">
          <dl className="divide-y divide-border">
            <Row label="Name" value={product.name} />
            <Row label="SKU" value={product.sku ? <CopyableId value={product.sku} /> : "—"} />
            <Row label="UPC" value={product.upc ? <CopyableId value={product.upc} /> : "—"} />
            <Row label="External ID" value={<span className="font-mono text-[11px]">{product.external_id}</span>} />
            <Row label="Strain" value={product.strain?.name ?? "—"} />
            <Row label="Product Line" value={product.product_line?.name ?? "—"} />
            <Row label="Description" value={product.description ?? "—"} />
            <Row label="Unit of Measure" value={product.unit_of_measure ? UNIT_OF_MEASURE_LABELS[product.unit_of_measure as UnitOfMeasure] : "—"} />
            <Row label="Default Package Size" value={product.default_package_size ?? "—"} />
            <Row label="Tags" value={(product.tags ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {(product.tags ?? []).map((t) => <span key={t} className="inline-flex h-5 px-2 rounded-full bg-muted text-[11px]">{t}</span>)}
              </div>
            ) : "—"} />
          </dl>
        </Card>

        {/* Compliance */}
        <Card title="Compliance">
          <div className="p-5 flex flex-wrap gap-2">
            <Chip on={!!product.is_medical} label="Medical" color="blue" />
            <Chip on={!!product.is_doh_compliant} label="DOH Compliant" color="teal" />
            <Chip on={!!product.is_trade_sample} label="Trade Sample" color="purple" />
            <Chip on={!!product.is_employee_sample} label="Employee Sample" color="purple" />
            <Chip on={!!product.requires_lab_testing} label="Lab Testing Required" color="emerald" icon={ClipboardCheck} />
            <Chip on={!!product.requires_child_resistant_packaging} label="Child-Resistant Pkg" color="amber" icon={Baby} />
            <Chip on={product.ccrs_inventory_category !== "PropagationMaterial"} label="Universal Cannabis Symbol" color="purple" icon={ShieldCheck} />
            {isEdible && <Chip on={true} label="Not For Kids Symbol" color="red" icon={Leaf} />}
          </div>
          {warning && (
            <div className="mx-5 mb-5 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-foreground">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold text-[11px] uppercase tracking-wider text-amber-500 mb-1">Required Warning Text</p>
                  <p className="leading-relaxed">{warning}</p>
                </div>
              </div>
            </div>
          )}
          {product.custom_label_notes && (
            <div className="mx-5 mb-5 rounded-lg bg-muted/30 border border-border p-3 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Custom label notes: </span>
              {product.custom_label_notes}
            </div>
          )}
        </Card>

        {/* Pricing */}
        <Card title="Pricing">
          <dl className="divide-y divide-border">
            <Row label="Unit Price" value={product.unit_price != null ? <span className="font-mono font-semibold">${Number(product.unit_price).toFixed(2)}</span> : "—"} />
            <Row label="Cost per Unit" value={product.cost_per_unit != null ? <span className="font-mono">${Number(product.cost_per_unit).toFixed(2)}</span> : "—"} />
            <Row label="Margin" value={margin != null
              ? <span className={cn("font-mono font-semibold", margin >= 50 ? "text-emerald-500" : margin >= 25 ? "text-amber-500" : "text-destructive")}>{margin.toFixed(1)}%</span>
              : "—"} />
            <Row label="Taxable" value={product.is_taxable ? "Yes" : "No"} />
            <Row label="Tax Rate Override" value={product.tax_rate_override != null ? `${product.tax_rate_override}%` : "Standard rate"} />
          </dl>
        </Card>
      </div>

      <div className="lg:col-span-1 space-y-4">
        <CodyInsightsPanel />
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <h4 className="text-[12px] font-semibold text-foreground">Ask Cody</h4>
          </div>
          <div className="space-y-1.5">
            {[
              `How is ${product.name} performing vs similar products?`,
              `Should I adjust pricing on ${product.name}?`,
              `What's the demand forecast for ${product.name}?`,
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  window.dispatchEvent(new Event("open-cody-chat"));
                  window.dispatchEvent(new CustomEvent("cody-prefill", { detail: q }));
                }}
                className="w-full text-left text-[11px] text-muted-foreground hover:text-primary hover:bg-accent/50 rounded p-2 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function BatchesPanel({ productId }: { productId: string }) {
  const { data: batches, loading } = useProductBatches(productId);

  const columns: ColumnDef<any>[] = [
    { accessorKey: "external_id", header: "Batch ID", cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.external_id ?? row.original.id.slice(0, 8)}</span> },
    { id: "strain", header: "Strain", cell: ({ row }) => row.original.strain?.name ?? <span className="text-muted-foreground text-[12px]">—</span> },
    { accessorKey: "source_type", header: "Source", cell: ({ row }) => <span className="text-[12px] capitalize">{row.original.source_type?.replaceAll("_", " ") ?? "—"}</span> },
    { accessorKey: "quantity_current", header: "Current Qty", cell: ({ row }) => row.original.quantity_current != null ? <span className="font-mono text-[12px]">{row.original.quantity_current}</span> : "—" },
    { accessorKey: "quantity_initial", header: "Initial Qty", cell: ({ row }) => row.original.quantity_initial != null ? <span className="font-mono text-[12px] text-muted-foreground">{row.original.quantity_initial}</span> : "—" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium capitalize">{row.original.status ?? "—"}</span> },
    { accessorKey: "created_at", header: "Created", cell: ({ row }) => <DateTime value={row.original.created_at} format="date-only" className="text-[12px]" /> },
  ];

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (batches.length === 0) {
    return <EmptyState icon={Barcode} title="No batches yet" description="Batches of this product will appear here. Create one from the Batches page once it's built." />;
  }
  return <DataTable columns={columns} data={batches} />;
}

function SalesPanel({ productId }: { productId: string }) {
  const { data: items, loading } = useProductSalesHistory(productId);

  const monthly = useMemo(() => {
    const buckets = new Map<string, number>();
    items.forEach((i: any) => {
      const ts = i.order?.created_at ?? i.created_at;
      if (!ts) return;
      const d = new Date(ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, (buckets.get(key) ?? 0) + Number(i.quantity ?? 0));
    });
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, qty]) => ({ month, qty }));
  }, [items]);

  const columns: ColumnDef<any>[] = [
    { accessorKey: "order", header: "Order #", cell: ({ row }) => row.original.order?.order_number
      ? <span className="font-mono text-[12px]">{row.original.order.order_number}</span>
      : <span className="font-mono text-[11px] text-muted-foreground">{row.original.order_id?.slice(0, 8) ?? "—"}</span> },
    { id: "account", header: "Customer", cell: ({ row }) => row.original.account?.company_name ?? <span className="text-muted-foreground text-[12px]">—</span> },
    { accessorKey: "quantity", header: "Qty", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.quantity ?? "—"}</span> },
    { accessorKey: "unit_price", header: "Unit Price", cell: ({ row }) => row.original.unit_price != null ? <span className="font-mono text-[12px]">${Number(row.original.unit_price).toFixed(2)}</span> : "—" },
    { accessorKey: "line_total", header: "Total", cell: ({ row }) => row.original.line_total != null ? <span className="font-mono text-[12px] font-semibold">${Number(row.original.line_total).toFixed(2)}</span> : "—" },
    { accessorKey: "created_at", header: "Date", cell: ({ row }) => <DateTime value={row.original.order?.created_at ?? row.original.created_at} format="date-only" className="text-[12px]" /> },
  ];

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (items.length === 0) {
    return <EmptyState icon={TrendingUp} title="No sales yet" description="Orders containing this product will appear here along with a monthly volume chart." />;
  }

  return (
    <div className="space-y-6">
      {monthly.length >= 2 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-[13px] font-semibold text-foreground mb-4">Volume by month</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid var(--glass-border)", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <DataTable columns={columns} data={items} />
    </div>
  );
}

function LabResultsPanel({ productId }: { productId: string }) {
  const { data: results, loading } = useProductLabResults(productId);

  const stats = useMemo(() => {
    const total = results.length;
    const passed = results.filter((r: any) => r.lab_test_status === "Pass").length;
    const failed = results.filter((r: any) => String(r.lab_test_status ?? "").startsWith("Fail")).length;
    return { total, passed, failed, passRate: total > 0 ? (passed / total) * 100 : 0 };
  }, [results]);

  const columns: ColumnDef<any>[] = [
    { accessorKey: "test_completed_at", header: "Date", cell: ({ row }) => row.original.test_completed_at ? <DateTime value={row.original.test_completed_at} format="date-only" className="text-[12px]" /> : "—" },
    { accessorKey: "batch", header: "Batch", cell: ({ row }) => row.original.batch ? <span className="font-mono text-[11px]">{row.original.batch.external_id}</span> : "—" },
    { accessorKey: "thc_pct", header: "THC %", cell: ({ row }) => row.original.thc_pct != null ? <span className="font-mono text-[12px]">{Number(row.original.thc_pct).toFixed(2)}%</span> : "—" },
    { accessorKey: "cbd_pct", header: "CBD %", cell: ({ row }) => row.original.cbd_pct != null ? <span className="font-mono text-[12px]">{Number(row.original.cbd_pct).toFixed(2)}%</span> : "—" },
    {
      accessorKey: "lab_test_status", header: "Status",
      cell: ({ row }) => {
        const s = row.original.lab_test_status;
        if (!s) return "—";
        if (s === "Pass") return <StatusPill label="Pass" variant="success" />;
        if (String(s).startsWith("Fail")) return <StatusPill label={s} variant="critical" />;
        return <StatusPill label={s} variant="muted" />;
      },
    },
  ];

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (results.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="No lab results yet" description="Once batches of this product are tested, QA results will appear here." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tests" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Passed" value={stats.passed} accentClass="stat-accent-emerald" delay={0.05} />
        <StatCard label="Failed" value={stats.failed} accentClass={stats.failed > 0 ? "stat-accent-rose" : "stat-accent-emerald"} delay={0.1} />
        <StatCard label="Pass Rate" value={`${stats.passRate.toFixed(0)}%`} accentClass="stat-accent-teal" delay={0.15} />
      </div>
      <DataTable columns={columns} data={results} />
    </div>
  );
}

function PricingPanel({ productId }: { productId: string }) {
  const navigate = useNavigate();
  const { data: entries, loading } = useProductPricing(productId);

  const columns: ColumnDef<any>[] = [
    {
      id: "price_list", header: "Price List",
      cell: ({ row }) => row.original.price_list ? (
        <button onClick={() => navigate(`/settings/customer-setup/price-lists/${row.original.price_list.id}`)} className="text-[12px] text-primary hover:underline">
          {row.original.price_list.name}
        </button>
      ) : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    { id: "default", header: "Default", cell: ({ row }) => row.original.price_list?.is_default ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 uppercase tracking-wider">Default</span> : "—" },
    { accessorKey: "unit_price", header: "Price", cell: ({ row }) => <span className="font-mono text-[12px] font-semibold">${Number(row.original.unit_price).toFixed(2)}</span> },
    { id: "status", header: "Status", cell: ({ row }) => row.original.price_list?.is_active === false ? <StatusPill label="Archived" variant="muted" /> : <StatusPill label="Active" variant="success" /> },
  ];

  if (loading) return <div className="flex h-[30vh] items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={DollarSign}
        title="Not on any price list"
        description="Add this product to a price list from the Customer Setup page to offer custom pricing per account."
        primaryAction={<Button onClick={() => navigate("/settings/customer-setup?tab=price-lists")} className="gap-1.5">Go to Price Lists →</Button>}
      />
    );
  }
  return <DataTable columns={columns} data={entries} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/20">
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      </div>
      {children}
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

function Chip({
  on, label, color, icon: Icon,
}: {
  on: boolean; label: string;
  color: "blue" | "teal" | "purple" | "emerald" | "amber" | "red";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const palette: Record<string, string> = {
    blue: on ? "bg-blue-500/15 text-blue-500 border-blue-500/30" : "bg-muted/30 text-muted-foreground border-border",
    teal: on ? "bg-teal-500/15 text-teal-500 border-teal-500/30" : "bg-muted/30 text-muted-foreground border-border",
    purple: on ? "bg-purple-500/15 text-purple-500 border-purple-500/30" : "bg-muted/30 text-muted-foreground border-border",
    emerald: on ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" : "bg-muted/30 text-muted-foreground border-border",
    amber: on ? "bg-amber-500/15 text-amber-500 border-amber-500/30" : "bg-muted/30 text-muted-foreground border-border",
    red: on ? "bg-red-500/15 text-red-500 border-red-500/30" : "bg-muted/30 text-muted-foreground border-border",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[10px] font-semibold uppercase tracking-wider", palette[color])}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
      {!on && <span className="opacity-70 normal-case">· off</span>}
    </span>
  );
}
