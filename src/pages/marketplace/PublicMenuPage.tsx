import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Store, Mail, Phone, Search, Loader2, Package, Leaf } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { usePublicMenu, useSubmitInquiry, MarketplaceBatch } from "@/hooks/useMarketplace";
import { cn } from "@/lib/utils";

export default function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const { menu, items, loading, error } = usePublicMenu(slug);
  const submitInquiry = useSubmitInquiry();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [strainFilter, setStrainFilter] = useState<string>("");
  const [inquiryBatch, setInquiryBatch] = useState<MarketplaceBatch | null>(null);

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.product?.ccrs_inventory_category).filter(Boolean))) as string[], [items]);
  const strains = useMemo(() => Array.from(new Set(items.map((i) => i.strain?.name).filter(Boolean))) as string[], [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !`${i.product?.name ?? ""} ${i.strain?.name ?? ""} ${i.barcode}`.toLowerCase().includes(q)) return false;
      if (categoryFilter && i.product?.ccrs_inventory_category !== categoryFilter) return false;
      if (strainFilter && i.strain?.name !== strainFilter) return false;
      return true;
    });
  }, [items, search, categoryFilter, strainFilter]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !menu) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <Store className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h1 className="text-[18px] font-semibold">Menu not found</h1>
          <p className="text-[13px] text-muted-foreground mt-2">{error ?? "This link may have expired or is not active."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Banner */}
      <div
        className="w-full h-48 md:h-64 bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 flex items-end"
        style={menu.banner_url ? { background: `url(${menu.banner_url}) center / cover no-repeat` } : undefined}
      >
        <div className="max-w-6xl w-full mx-auto px-6 pb-6 text-foreground">
          <h1 className="text-[28px] md:text-[36px] font-bold leading-tight" style={menu.banner_url ? { color: "white", textShadow: "0 2px 4px rgba(0,0,0,0.5)" } : undefined}>{menu.name}</h1>
          {menu.description && <p className="text-[14px] mt-2 opacity-90" style={menu.banner_url ? { color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.5)" } : undefined}>{menu.description}</p>}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Contact strip */}
        {(menu.contact_email || menu.contact_phone) && (
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 flex-wrap">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Contact</div>
            {menu.contact_email && (
              <a href={`mailto:${menu.contact_email}`} className="inline-flex items-center gap-2 text-[13px] text-primary hover:underline">
                <Mail className="w-3.5 h-3.5" /> {menu.contact_email}
              </a>
            )}
            {menu.contact_phone && (
              <a href={`tel:${menu.contact_phone}`} className="inline-flex items-center gap-2 text-[13px] text-primary hover:underline">
                <Phone className="w-3.5 h-3.5" /> {menu.contact_phone}
              </a>
            )}
          </div>
        )}

        {/* Search + filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products, strains…" className="pl-10 h-10" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-10 px-3 text-[12px] rounded-md bg-background border border-border">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={strainFilter} onChange={(e) => setStrainFilter(e.target.value)} className="h-10 px-3 text-[12px] rounded-md bg-background border border-border">
            <option value="">All strains</option>
            {strains.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="text-[12px] text-muted-foreground">
          Showing {filtered.length} of {items.length} available item{items.length === 1 ? "" : "s"}
        </div>

        {/* Product grid */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
            <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-[14px] font-semibold">No products match</h3>
            <p className="text-[12px] text-muted-foreground mt-1">Try clearing filters or search terms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((b) => (
              <ProductCard key={b.id} batch={b} onRequest={() => setInquiryBatch(b)} />
            ))}
          </div>
        )}

        <div className="text-center text-[11px] text-muted-foreground pt-8 pb-4 border-t border-border">
          Powered by <span className="font-semibold">Cody Grow</span>
        </div>
      </div>

      {inquiryBatch && (
        <InquiryModal menuId={menu.id} batch={inquiryBatch} onClose={() => setInquiryBatch(null)} onSuccess={async (data) => {
          try {
            await submitInquiry(menu.id, data);
            toast.success("Inquiry submitted", { description: "The supplier will be in touch shortly." });
            setInquiryBatch(null);
          } catch (err: any) { toast.error(err?.message ?? "Failed"); }
        }} />
      )}
    </div>
  );
}

function ProductCard({ batch, onRequest }: { batch: MarketplaceBatch; onRequest: () => void }) {
  const thc = batch.potency?.thc_total_pct;
  const cbd = batch.potency?.cbd_total_pct;
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Leaf className="w-4 h-4" />
        </div>
        {batch.strain?.type && (
          <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">{batch.strain.type}</span>
        )}
      </div>
      <div>
        <h4 className="text-[14px] font-semibold leading-tight">{batch.product?.name ?? "—"}</h4>
        {batch.strain?.name && <p className="text-[12px] text-muted-foreground italic mt-0.5">{batch.strain.name}</p>}
      </div>
      <div className="flex items-center gap-3 text-[11px] font-mono">
        {thc != null && <span className="inline-flex items-center gap-1"><span className="text-muted-foreground">THC</span><span className="font-bold text-emerald-500">{Number(thc).toFixed(1)}%</span></span>}
        {cbd != null && <span className="inline-flex items-center gap-1"><span className="text-muted-foreground">CBD</span><span className="font-bold text-blue-500">{Number(cbd).toFixed(1)}%</span></span>}
      </div>
      <div className="flex items-end justify-between gap-2 pt-2 border-t border-border/50 mt-auto">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Available</div>
          <div className={cn("font-mono text-[13px] font-semibold")}>{Number(batch.current_quantity).toFixed(0)}g</div>
        </div>
        {batch.product?.unit_price != null && (
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Price</div>
            <div className="font-mono text-[13px] font-semibold">${Number(batch.product.unit_price).toFixed(2)}</div>
          </div>
        )}
      </div>
      <Button size="sm" onClick={onRequest} className="w-full gap-1.5">
        Request Order
      </Button>
    </div>
  );
}

function InquiryModal({ menuId, batch, onClose, onSuccess }: { menuId: string; batch: MarketplaceBatch; onClose: () => void; onSuccess: (data: any) => void }) {
  const [companyName, setCompanyName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const valid = companyName.trim() && email.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    await onSuccess({
      company_name: companyName.trim(),
      license_number: licenseNumber.trim() || undefined,
      contact_email: email.trim(),
      phone: phone.trim() || undefined,
      message: `Interested in ${batch.product?.name ?? batch.barcode}${message ? `: ${message}` : ""}`,
    });
    setSaving(false);
    void menuId;
  };

  return (
    <ScrollableModal
      open={true} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<Mail className="w-4 h-4 text-primary" />} title="Request order" subtitle={batch.product?.name ?? batch.barcode} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            Send
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-[12px] space-y-1">
          <div><span className="text-muted-foreground">Product:</span> <span className="font-semibold">{batch.product?.name ?? "—"}</span></div>
          {batch.strain?.name && <div><span className="text-muted-foreground">Strain:</span> {batch.strain.name}</div>}
          <div><span className="text-muted-foreground">Available:</span> <span className="font-mono">{Number(batch.current_quantity).toFixed(0)}g</span></div>
        </div>
        <Field label="Company name" required><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></Field>
        <Field label="License #"><Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="font-mono" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
        <Field label="Message"><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" /></Field>
      </div>
    </ScrollableModal>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
