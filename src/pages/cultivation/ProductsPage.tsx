import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Package, Sprout, Leaf, FlaskConical, ShoppingBag, Plus,
  MoreHorizontal, Edit, Archive, Copy, Eye, FolderOpen,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import StatusPill from "@/components/shared/StatusPill";
import CopyableId from "@/components/shared/CopyableId";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import { useProducts, useProductStats, Product, ProductInput } from "@/hooks/useProducts";
import { useProductLines, useProductLineStats, ProductLine, ProductLineInput } from "@/hooks/useProductLines";
import {
  CCRS_INVENTORY_CATEGORIES, CCRS_INVENTORY_CATEGORY_LABELS, CCRS_INVENTORY_CATEGORY_COLORS,
  CCRS_CATEGORY_TYPE_MAP,
  CcrsInventoryCategory, CcrsInventoryType,
} from "@/lib/schema-enums";
import ProductFormModal from "./ProductFormModal";
import ProductLineFormModal from "./ProductLineFormModal";
import { cn } from "@/lib/utils";

type TabKey = "products" | "lines";

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey) ?? "products";
  const setActiveTab = (t: TabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  useShortcut(["1"], () => setActiveTab("products"), { description: "Products tab", scope: "Products" });
  useShortcut(["2"], () => setActiveTab("lines"), { description: "Product Lines tab", scope: "Products" });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Products"
        description="Define your product catalog — every batch and sale traces here"
        breadcrumbs={[{ label: "Cultivation" }, { label: "Products" }]}
      />
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="mb-6">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="lines">Product Lines</TabsTrigger>
        </TabsList>
        <TabsContent value="products"><ProductsTab active={activeTab === "products"} /></TabsContent>
        <TabsContent value="lines"><LinesTab active={activeTab === "lines"} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab 1: Products ──────────────────────────────────────────────────────────

function ProductsTab({ active }: { active: boolean }) {
  const navigate = useNavigate();
  const { data: products, loading, createProduct, updateProduct, archiveProduct, duplicateProduct } = useProducts();
  const { data: lines } = useProductLines();
  const stats = useProductStats(products);

  const [searchValue, setSearchValue] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CcrsInventoryCategory | "">("");
  const [typeFilter, setTypeFilter] = useState<CcrsInventoryType | "">("");
  const [lineFilter, setLineFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "">("");
  const [medicalFilter, setMedicalFilter] = useState<"yes" | "no" | "">("");
  const [batchesFilter, setBatchesFilter] = useState<"yes" | "no" | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { setContext, clearContext } = useCodyContext();
  const sig = useMemo(() => products.map((p) => `${p.id}:${p.active_batch_count ?? 0}:${p.is_active ? 1 : 0}`).join(","), [products]);
  const payload = useMemo(() => ({
    counts: stats,
    products: products.map((p) => ({
      name: p.name,
      category: p.ccrs_inventory_category,
      type: p.ccrs_inventory_type,
      sku: p.sku,
      price: p.unit_price,
      active_batches: p.active_batch_count,
      product_line: p.product_line?.name,
      strain: p.strain?.name,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sig, stats.total]);

  useEffect(() => {
    if (!active) return;
    setContext({ context_type: "products_list", page_data: payload });
    return () => clearContext();
  }, [active, setContext, clearContext, payload]);

  useShortcut(["n"], () => { setEditing(null); setModalOpen(true); }, { description: "Add product", scope: "Products", enabled: active && !modalOpen });
  useShortcut(["/"], () => document.querySelector<HTMLInputElement>("[data-filters-search]")?.focus(), { description: "Focus search", scope: "Products", enabled: active && !modalOpen });

  // Reset type filter when category changes
  useEffect(() => {
    if (typeFilter && categoryFilter && !CCRS_CATEGORY_TYPE_MAP[categoryFilter].includes(typeFilter)) {
      setTypeFilter("");
    }
  }, [categoryFilter, typeFilter]);

  const typesForCategoryFilter = useMemo(() => {
    if (!categoryFilter) return [];
    return CCRS_CATEGORY_TYPE_MAP[categoryFilter];
  }, [categoryFilter]);

  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return products.filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.sku ?? ""} ${p.description ?? ""} ${p.upc ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categoryFilter && p.ccrs_inventory_category !== categoryFilter) return false;
      if (typeFilter && p.ccrs_inventory_type !== typeFilter) return false;
      if (lineFilter && p.product_line_id !== lineFilter) return false;
      if (statusFilter === "active" && !p.is_active) return false;
      if (statusFilter === "archived" && p.is_active) return false;
      if (medicalFilter === "yes" && !p.is_medical) return false;
      if (medicalFilter === "no" && p.is_medical) return false;
      if (batchesFilter === "yes" && (p.active_batch_count ?? 0) === 0) return false;
      if (batchesFilter === "no" && (p.active_batch_count ?? 0) > 0) return false;
      return true;
    });
  }, [products, searchValue, categoryFilter, typeFilter, lineFilter, statusFilter, medicalFilter, batchesFilter]);

  const handleSave = async (input: ProductInput) => {
    if (editing) return await updateProduct(editing.id, input);
    return await createProduct(input);
  };

  const columns: ColumnDef<Product>[] = useMemo(() => [
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => {
        const p = row.original;
        const color = p.ccrs_inventory_category ? CCRS_INVENTORY_CATEGORY_COLORS[p.ccrs_inventory_category] : null;
        return (
          <button onClick={() => navigate(`/cultivation/products/${p.id}`)} className="flex items-center gap-2 text-left">
            <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: color?.hex ?? "var(--glass-border)" }} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-primary hover:underline truncate">{p.name}</div>
              {p.is_medical && <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Medical</span>}
            </div>
          </button>
        );
      },
    },
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }) => row.original.sku ? <CopyableId value={row.original.sku} /> : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      accessorKey: "ccrs_inventory_category",
      header: "Category",
      cell: ({ row }) => {
        const c = row.original.ccrs_inventory_category;
        if (!c) return <span className="text-muted-foreground text-[12px]">—</span>;
        const color = CCRS_INVENTORY_CATEGORY_COLORS[c];
        return <span className={cn("inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium", color.bg, color.text)}>{CCRS_INVENTORY_CATEGORY_LABELS[c]}</span>;
      },
    },
    {
      accessorKey: "ccrs_inventory_type",
      header: "Type",
      cell: ({ row }) => row.original.ccrs_inventory_type
        ? <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">{row.original.ccrs_inventory_type}</span>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "product_line",
      header: "Line",
      cell: ({ row }) => row.original.product_line
        ? <span className="text-[12px]">{row.original.product_line.name}</span>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "strain",
      header: "Strain",
      cell: ({ row }) => row.original.strain
        ? <button onClick={(e) => { e.stopPropagation(); navigate(`/cultivation/strains/${row.original.strain!.id}`); }} className="text-[12px] text-primary hover:underline">{row.original.strain.name}</button>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      accessorKey: "unit_of_measure",
      header: "UoM",
      cell: ({ row }) => row.original.unit_of_measure ? <span className="text-[12px] capitalize">{row.original.unit_of_measure}</span> : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      accessorKey: "unit_price",
      header: "Price",
      cell: ({ row }) => row.original.unit_price != null
        ? <span className="font-mono text-[12px] tabular-nums">${Number(row.original.unit_price).toFixed(2)}</span>
        : <span className="text-muted-foreground text-[12px]">—</span>,
    },
    {
      id: "active_batches",
      header: "Batches",
      cell: ({ row }) => {
        const n = row.original.active_batch_count ?? 0;
        if (n === 0) return <span className="text-muted-foreground text-[12px]">0</span>;
        return <span className="font-mono text-[12px] tabular-nums">{n}</span>;
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => row.original.is_active ? <StatusPill label="Active" variant="success" /> : <StatusPill label="Archived" variant="muted" />,
    },
    {
      id: "actions",
      enableSorting: false,
      header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/cultivation/products/${row.original.id}`)}>
                <Eye className="w-3.5 h-3.5" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setEditing(row.original); setModalOpen(true); }}>
                <Edit className="w-3.5 h-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                const dup = await duplicateProduct(row.original);
                navigate(`/cultivation/products/${dup.id}`);
              }}>
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => { if (confirm(`Archive "${row.original.name}"?`)) await archiveProduct(row.original.id); }}
                className="text-destructive"
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate, archiveProduct, duplicateProduct]);

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Products" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Propagation" value={stats.propagation} accentClass="stat-accent-emerald" delay={0.05} />
        <StatCard label="Harvested" value={stats.harvested} accentClass="stat-accent-emerald" delay={0.1} />
        <StatCard label="Intermediate" value={stats.intermediate} accentClass="stat-accent-purple" delay={0.15} />
        <StatCard label="End Product" value={stats.endProduct} accentClass="stat-accent-teal" delay={0.2} />
      </div>

      <FiltersBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search name, SKU, description…"
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All categories</option>
              {CCRS_INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{CCRS_INVENTORY_CATEGORY_LABELS[c]}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border" disabled={!categoryFilter}>
              <option value="">{categoryFilter ? "All types" : "Select category first"}</option>
              {typesForCategoryFilter.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border" disabled={lines.length === 0}>
              <option value="">All lines</option>
              {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <select value={medicalFilter} onChange={(e) => setMedicalFilter(e.target.value as any)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">Any medical</option>
              <option value="yes">Medical</option>
              <option value="no">Not medical</option>
            </select>
            <select value={batchesFilter} onChange={(e) => setBatchesFilter(e.target.value as any)} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">Any batches</option>
              <option value="yes">Has active batches</option>
              <option value="no">No active batches</option>
            </select>
            <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Product
            </Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        empty={{
          icon: Package,
          title: products.length === 0 ? "Add your first product" : "No matches",
          description: products.length === 0
            ? "Products define what you produce and sell. Each product maps to a CCRS InventoryCategory and InventoryType for compliance reporting."
            : "No products match your current filters.",
          action: products.length === 0 ? (
            <div className="flex items-center gap-2">
              <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add First Product</Button>
              <Button variant="outline" disabled className="gap-1.5">Import from CCRS</Button>
            </div>
          ) : undefined,
        }}
      />

      <ProductFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSave={handleSave}
      />
    </div>
  );
}

// ─── Tab 2: Product Lines ─────────────────────────────────────────────────────

function LinesTab({ active }: { active: boolean }) {
  const { data: lines, loading, createLine, updateLine, archiveLine } = useProductLines();
  const stats = useProductLineStats(lines);
  const [searchValue, setSearchValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductLine | null>(null);

  const { setContext, clearContext } = useCodyContext();
  const sig = useMemo(() => lines.map((l) => `${l.id}:${l.product_count ?? 0}`).join(","), [lines]);
  const payload = useMemo(() => ({
    counts: stats,
    lines: lines.map((l) => ({ name: l.name, description: l.description, products: l.product_count, is_active: l.is_active })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sig, stats.total]);

  useEffect(() => {
    if (!active) return;
    setContext({ context_type: "product_lines_list", page_data: payload });
    return () => clearContext();
  }, [active, setContext, clearContext, payload]);

  useShortcut(["n"], () => { setEditing(null); setModalOpen(true); }, { description: "Add product line", scope: "Product Lines", enabled: active && !modalOpen });

  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => `${l.name} ${l.description ?? ""}`.toLowerCase().includes(q));
  }, [lines, searchValue]);

  const columns: ColumnDef<ProductLine>[] = useMemo(() => [
    { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="text-[13px] font-medium">{row.original.name}</span> },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="text-[12px] text-muted-foreground line-clamp-1">{row.original.description?.slice(0, 80) ?? "—"}</span>,
    },
    {
      id: "products",
      header: "Products",
      cell: ({ row }) => {
        const n = row.original.product_count ?? 0;
        if (n === 0) return <span className="text-muted-foreground text-[12px]">0</span>;
        return <span className="font-mono text-[12px] tabular-nums">{n}</span>;
      },
    },
    { accessorKey: "sort_order", header: "Sort", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.sort_order ?? 0}</span> },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => row.original.is_active ? <StatusPill label="Active" variant="success" /> : <StatusPill label="Archived" variant="muted" />,
    },
    {
      id: "actions",
      enableSorting: false,
      header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setEditing(row.original); setModalOpen(true); }}>
                <Edit className="w-3.5 h-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => { if (confirm(`Archive "${row.original.name}"? Products currently in this line will keep their reference.`)) await archiveLine(row.original.id); }}
                className="text-destructive"
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
  ], [archiveLine]);

  const handleSave = async (input: ProductLineInput) => {
    if (editing) await updateLine(editing.id, input);
    else await createLine(input);
  };

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Lines" value={stats.total} accentClass="stat-accent-blue" />
        <StatCard label="Active" value={stats.active} accentClass="stat-accent-emerald" delay={0.05} />
        <StatCard label="Products in Lines" value={stats.productsInLines} accentClass="stat-accent-teal" delay={0.1} />
      </div>

      <FiltersBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search product lines…"
        actions={
          <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Product Line
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        empty={{
          icon: FolderOpen,
          title: lines.length === 0 ? "Organize your catalog with product lines" : "No matches",
          description: lines.length === 0
            ? "Group similar products together for easier browsing, filtering, and reporting."
            : "No lines match your current search.",
          action: lines.length === 0 ? (
            <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add First Line</Button>
          ) : undefined,
        }}
      />

      <ProductLineFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSave={handleSave}
      />
    </div>
  );
}

void Sprout; void Leaf; void FlaskConical; void ShoppingBag;
