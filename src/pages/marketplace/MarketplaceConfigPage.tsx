import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store, Plus, ExternalLink, Copy, Edit, Archive, Loader2, Lock, Globe, Users,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useMarketplaceMenus, useCreateMenu, useUpdateMenu, useMarketplaceItems,
  useAddToMarketplace, useRemoveFromMarketplace, MarketplaceMenu,
} from "@/hooks/useMarketplace";

export default function MarketplaceConfigPage() {
  const navigate = useNavigate();
  const { data: menus, loading, refresh } = useMarketplaceMenus();
  const { data: items, refresh: refreshItems } = useMarketplaceItems();
  const updateMenu = useUpdateMenu();
  const addToMarketplace = useAddToMarketplace();
  const removeFromMarketplace = useRemoveFromMarketplace();

  const [createOpen, setCreateOpen] = useState(false);
  const [editMenu, setEditMenu] = useState<MarketplaceMenu | null>(null);

  const { setContext, clearContext } = useCodyContext();
  useEffect(() => {
    setContext({ context_type: "marketplace_config", page_data: { menus: menus.length, items: items.length } });
    return () => clearContext();
  }, [setContext, clearContext, menus.length, items.length]);

  const menuColumns: ColumnDef<MarketplaceMenu>[] = useMemo(() => [
    { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="text-[13px] font-semibold">{row.original.name}</span> },
    { id: "url", header: "Public URL", cell: ({ row }) => {
      const url = `${window.location.origin}/menu/${row.original.public_slug}`;
      return row.original.public_slug ? (
        <button onClick={async () => { await navigator.clipboard.writeText(url); toast.success("Link copied"); }} className="flex items-center gap-1.5 text-[11px] text-primary hover:underline font-mono">
          <Copy className="w-3 h-3" /> /menu/{row.original.public_slug}
        </button>
      ) : <span className="text-muted-foreground">—</span>;
    } },
    { accessorKey: "item_count", header: "Items", cell: ({ row }) => <span className="font-mono text-[12px]">{row.original.item_count ?? 0}</span> },
    { id: "visibility", header: "Visibility", cell: ({ row }) => (
      <div className="flex items-center gap-1 flex-wrap">
        {row.original.is_public && <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-500 uppercase tracking-wider"><Globe className="w-2.5 h-2.5" />Public</span>}
        {row.original.password_protected && <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-500 uppercase tracking-wider"><Lock className="w-2.5 h-2.5" />Password</span>}
        {(row.original.visible_to_accounts?.length ?? 0) > 0 && <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-500 uppercase tracking-wider"><Users className="w-2.5 h-2.5" />Restricted</span>}
      </div>
    ) },
    { accessorKey: "is_active", header: "Status", cell: ({ row }) => <StatusPill label={row.original.is_active ? "Active" : "Archived"} variant={row.original.is_active ? "success" : "muted"} /> },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="p-1 rounded hover:bg-accent">⋯</button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditMenu(row.original)}><Edit className="w-3.5 h-3.5" /> Edit</DropdownMenuItem>
              {row.original.public_slug && (
                <DropdownMenuItem onClick={() => window.open(`/menu/${row.original.public_slug}`, "_blank")}>
                  <ExternalLink className="w-3.5 h-3.5" /> View Public Page
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={async () => { try { await updateMenu(row.original.id, { is_active: !row.original.is_active }); toast.success(row.original.is_active ? "Archived" : "Reactivated"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                <Archive className="w-3.5 h-3.5" /> {row.original.is_active ? "Archive" : "Reactivate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate]);

  const batchColumns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: "barcode", header: "Batch", cell: ({ row }) => <button onClick={() => navigate(`/inventory/batches/${row.original.id}`)} className="font-mono text-[12px] text-primary hover:underline">{row.original.barcode}</button> },
    { id: "product", header: "Product", cell: ({ row }) => row.original.product?.name ?? <span className="text-muted-foreground">—</span> },
    { id: "strain", header: "Strain", cell: ({ row }) => row.original.strain?.name ?? <span className="text-muted-foreground">—</span> },
    { accessorKey: "current_quantity", header: "Available", cell: ({ row }) => <span className="font-mono text-[12px]">{Number(row.original.current_quantity).toFixed(0)}g</span> },
    { accessorKey: "unit_cost", header: "Price", cell: ({ row }) => row.original.product?.unit_price != null ? <span className="font-mono text-[12px]">${Number(row.original.product.unit_price).toFixed(2)}</span> : <span className="text-muted-foreground">—</span> },
    { id: "menus", header: "On Menus", cell: ({ row }) => {
      const onMenus = (row.original.marketplace_menu_ids ?? []) as string[];
      if (onMenus.length === 0) return <span className="text-muted-foreground">—</span>;
      return <div className="flex items-center gap-1 flex-wrap">{onMenus.slice(0, 2).map((mid) => { const m = menus.find((x) => x.id === mid); return <span key={mid} className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-primary/15 text-primary">{m?.name ?? mid.slice(0, 6)}</span>; })}{onMenus.length > 2 && <span className="text-[10px] text-muted-foreground">+{onMenus.length - 2}</span>}</div>;
    } },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-7 px-2 text-[11px]">Manage</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menus.map((m) => {
              const onMenu = (row.original.marketplace_menu_ids ?? []).includes(m.id);
              return (
                <DropdownMenuItem key={m.id} onClick={async () => {
                  try {
                    if (onMenu) { await removeFromMarketplace(row.original.id, m.id); toast.success(`Removed from ${m.name}`); }
                    else { await addToMarketplace(row.original.id, m.id); toast.success(`Added to ${m.name}`); }
                    refreshItems(); refresh();
                  } catch (err: any) { toast.error(err?.message ?? "Failed"); }
                }}>
                  <input type="checkbox" checked={onMenu} readOnly className="accent-primary" />
                  {m.name}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [navigate, menus, addToMarketplace, removeFromMarketplace, refreshItems, refresh]);

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title="Marketplace"
        description="Your B2B wholesale storefront"
        breadcrumbs={[{ label: "Marketplace" }]}
        actions={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Menu</Button>}
      />

      <div className="mb-8">
        <h3 className="text-[13px] font-semibold mb-3">Menus ({menus.length})</h3>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : menus.length === 0 ? (
          <EmptyState icon={Store} title="No menus yet" description="Create a public menu to share inventory with wholesale customers." action={<Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Menu</Button>} />
        ) : (
          <DataTable columns={menuColumns} data={menus} />
        )}
      </div>

      <div>
        <h3 className="text-[13px] font-semibold mb-3">Inventory for marketplace ({items.length})</h3>
        <DataTable columns={batchColumns} data={items} empty={{ icon: Store, title: "No available batches", description: "Available batches will appear here. Add them to a menu to share publicly." }} />
      </div>

      <MenuModal open={createOpen || !!editMenu} onClose={() => { setCreateOpen(false); setEditMenu(null); }} menu={editMenu} onSuccess={() => refresh()} />
    </div>
  );
}

function MenuModal({ open, onClose, menu, onSuccess }: { open: boolean; onClose: () => void; menu: MarketplaceMenu | null; onSuccess?: () => void }) {
  const createMenu = useCreateMenu();
  const updateMenu = useUpdateMenu();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [bannerUrl, setBannerUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (menu) {
      setName(menu.name);
      setDescription(menu.description ?? "");
      setSlug(menu.public_slug ?? "");
      setIsPublic(menu.is_public ?? true);
      setBannerUrl(menu.banner_url ?? "");
      setContactEmail(menu.contact_email ?? "");
      setContactPhone(menu.contact_phone ?? "");
    } else {
      setName(""); setDescription(""); setSlug(""); setIsPublic(true);
      setBannerUrl(""); setContactEmail(""); setContactPhone("");
    }
  }, [open, menu]);

  useEffect(() => {
    if (!menu && name && !slug) setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
  }, [name, slug, menu]);

  const valid = name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      if (menu) {
        await updateMenu(menu.id, {
          name, description: description || null, public_slug: slug || null,
          is_public: isPublic, banner_url: bannerUrl || null,
          contact_email: contactEmail || null, contact_phone: contactPhone || null,
        });
        toast.success("Menu updated");
      } else {
        await createMenu({
          name, description: description || null, public_slug: slug || undefined, is_public: isPublic,
          banner_url: bannerUrl || null, contact_email: contactEmail || null, contact_phone: contactPhone || null,
        });
        toast.success("Menu created");
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<Store className="w-4 h-4 text-primary" />} title={menu ? "Edit menu" : "Create marketplace menu"} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Store className="w-3.5 h-3.5" />}
            {menu ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Public slug" helper="Used in /menu/:slug URL">
          <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="font-mono" />
        </Field>
        <Field label="Banner URL"><Input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://..." /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact email"><Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></Field>
          <Field label="Contact phone"><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
          <span className="text-[12px] font-medium">Public (anyone with the link can view)</span>
        </label>
      </div>
    </ScrollableModal>
  );
}

function Field({ label, required, helper, children }: { label: string; required?: boolean; helper?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {helper && <p className="text-[11px] text-muted-foreground/70">{helper}</p>}
    </div>
  );
}
