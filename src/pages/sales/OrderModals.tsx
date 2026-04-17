import { useEffect, useMemo, useState } from "react";
import { Loader2, ShoppingCart, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import { useCreateOrder, useAddOrderItem, Order, OrderItem } from "@/hooks/useOrders";
import { OrderSaleType } from "@/lib/schema-enums";

/** Wholesale-only sale types. RecreationalRetail stays in the enum for CCRS edge
 * cases but isn't featured in the order creation UI — Cody Grow is a producer
 * platform, not a POS. "Medical" maps to 'RecreationalMedical' (WA's term for
 * medical wholesale with excise tax exemption for DOH-compliant products). */
const WHOLESALE_SALE_TYPES: Array<{ value: OrderSaleType; label: string; hint: string }> = [
  { value: "Wholesale", label: "Wholesale", hint: "Standard B2B sale to a licensed retailer or processor" },
  { value: "RecreationalMedical", label: "Medical", hint: "Sale of DOH-compliant product — tax exempt for qualifying patients" },
];
import { cn } from "@/lib/utils";

export function CreateOrderModal({ open, onClose, onSuccess, initialAccountId }: {
  open: boolean; onClose: () => void; onSuccess?: (o: Order) => void; initialAccountId?: string;
}) {
  const { orgId } = useOrg();
  const createOrder = useCreateOrder();
  const [accountId, setAccountId] = useState("");
  const [saleType, setSaleType] = useState<OrderSaleType>("Wholesale");
  const [isTradeSample, setIsTradeSample] = useState(false);
  const [isNonCannabis, setIsNonCannabis] = useState(false);
  const [notes, setNotes] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ id: string; company_name: string; license_number: string | null; is_non_cannabis: boolean | null; default_delivery_notes: string | null }>>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    setAccountId(initialAccountId ?? "");
    setSaleType("Wholesale");
    setIsTradeSample(false);
    setIsNonCannabis(false);
    setNotes("");
    setDeliveryNotes("");
    (async () => {
      const { data } = await supabase.from("grow_accounts").select("id, company_name, license_number, is_non_cannabis, default_delivery_notes").eq("org_id", orgId).eq("is_active", true).order("company_name");
      setAccounts((data ?? []) as any);
    })();
  }, [open, orgId, initialAccountId]);

  const selected = useMemo(() => accounts.find((a) => a.id === accountId), [accounts, accountId]);

  useEffect(() => {
    if (selected?.is_non_cannabis) setIsNonCannabis(true);
    // Prefill delivery notes from the account's default, but only if the user
    // hasn't typed anything yet.
    if (selected?.default_delivery_notes && !deliveryNotes) {
      setDeliveryNotes(selected.default_delivery_notes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const valid = !!accountId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { toast.error("Select an account"); return; }
    setSaving(true);
    try {
      const order = await createOrder({
        account_id: accountId, sale_type: saleType,
        is_trade_sample: isTradeSample, is_non_cannabis: isNonCannabis,
        notes: notes.trim() || null,
        delivery_notes: deliveryNotes.trim() || null,
      } as any);
      toast.success(`Order ${order.order_number} created`);
      onSuccess?.(order);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Create failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<ShoppingCart className="w-4 h-4 text-primary" />} title="Create order" subtitle="Draft order — add items on the detail page" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
            Create Order
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Account" required>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Select account —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.company_name}{a.license_number ? ` · ${a.license_number}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Sale type" required>
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 w-full">
            {WHOLESALE_SALE_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setSaleType(t.value)} title={t.hint} className={cn(
                "flex-1 h-9 text-[12px] font-medium rounded-md transition-colors",
                saleType === t.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}>
                {t.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={isTradeSample} onChange={(e) => setIsTradeSample(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
            <span className="text-[12px] font-medium">Trade sample</span>
          </label>
          <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={isNonCannabis} onChange={(e) => setIsNonCannabis(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
            <span className="text-[12px] font-medium">Non-cannabis</span>
          </label>
        </div>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </Field>
        <Field label="Delivery notes">
          <textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} rows={3} placeholder="Special delivery instructions (parking, loading, contact)" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          {selected?.default_delivery_notes && <p className="text-[10px] text-muted-foreground mt-1">Pre-filled from account default — edit freely.</p>}
        </Field>
      </div>
    </ScrollableModal>
  );
}

// ─── Add Item ───────────────────────────────────────────────────────────────

export function AddOrderItemModal({ open, onClose, orderId, saleType, onSuccess }: {
  open: boolean; onClose: () => void; orderId: string; saleType: OrderSaleType | null; onSuccess?: (item: OrderItem) => void;
}) {
  const { orgId } = useOrg();
  const addItem = useAddOrderItem();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Array<{ id: string; name: string; category: string; ccrs_inventory_category: string | null; unit_price: number | null; is_doh_compliant: boolean | null; available_quantity: number }>>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    setProductId(""); setQuantity(""); setUnitPrice(""); setDiscount("");
    (async () => {
      const { data: productRows } = await supabase.from("grow_products").select("id, name, category, ccrs_inventory_category, unit_price, is_doh_compliant").eq("org_id", orgId).eq("is_active", true).order("name");
      const ids = ((productRows ?? []) as any[]).map((p) => p.id);
      const { data: batches } = ids.length > 0
        ? await supabase.from("grow_batches").select("product_id, current_quantity").in("product_id", ids).eq("is_available", true).gt("current_quantity", 0)
        : { data: [] };
      const byProduct = new Map<string, number>();
      (batches ?? []).forEach((b: any) => byProduct.set(b.product_id, (byProduct.get(b.product_id) ?? 0) + Number(b.current_quantity ?? 0)));
      setProducts(((productRows ?? []) as any[]).map((p) => ({ ...p, available_quantity: byProduct.get(p.id) ?? 0 })));
    })();
  }, [open, orgId]);

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);

  useEffect(() => {
    if (selected && !unitPrice) setUnitPrice(String(selected.unit_price ?? ""));
  }, [selected, unitPrice]);

  const isMedical = saleType === "RecreationalMedical";
  const medicalExempt = isMedical && selected?.is_doh_compliant;
  const subtotal = Number(quantity || 0) * Number(unitPrice || 0);
  const afterDiscount = Math.max(0, subtotal - Number(discount || 0));
  const tax = medicalExempt ? 0 : afterDiscount * 0.37;

  const valid = !!productId && Number(quantity) > 0 && Number(unitPrice) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !selected) return;
    setSaving(true);
    try {
      const item = await addItem({
        order_id: orderId,
        product_id: productId,
        quantity: Number(quantity),
        unit_price: Number(unitPrice),
        discount: discount ? Number(discount) : null,
        sale_type: saleType,
        is_doh_compliant: selected.is_doh_compliant ?? false,
      });
      toast.success("Item added");
      onSuccess?.(item);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally { setSaving(false); }
  };

  const grouped = useMemo(() => {
    const m = new Map<string, typeof products>();
    for (const p of products) {
      const k = p.ccrs_inventory_category ?? "Other";
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return Array.from(m.entries());
  }, [products]);

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<Package className="w-4 h-4 text-teal-500" />} title="Add line item" subtitle="Add a product to this order" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add Item
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Product" required>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Select product —</option>
            {grouped.map(([cat, list]) => (
              <optgroup key={cat} label={cat}>
                {list.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.available_quantity.toFixed(0)}g available</option>)}
              </optgroup>
            ))}
          </select>
          {selected && <p className="text-[11px] text-muted-foreground">{selected.available_quantity.toFixed(0)}g available across all batches</p>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity (g/units)" required>
            <Input type="number" step="0.1" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Unit price ($)" required>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
              <Input type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="font-mono pl-6" />
            </div>
          </Field>
        </div>
        <Field label="Discount ($)">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
            <Input type="number" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className="font-mono pl-6" />
          </div>
        </Field>
        {subtotal > 0 && (
          <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-1 text-[12px] font-mono">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            {Number(discount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-emerald-500">-${Number(discount).toFixed(2)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Tax{medicalExempt && " (medical exempt)"}</span><span>${tax.toFixed(2)}</span></div>
            <div className="flex justify-between pt-1 border-t border-border"><span className="font-semibold">Line total</span><span className="font-semibold">${(afterDiscount + tax).toFixed(2)}</span></div>
          </div>
        )}
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
