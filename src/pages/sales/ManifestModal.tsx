import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Loader2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import { useCreateManifest, Manifest, CreateManifestInput } from "@/hooks/useManifests";
import {
  MANIFEST_TYPES, MANIFEST_TRANSPORTATION_TYPES, ManifestType,
} from "@/lib/schema-enums";
import { cn } from "@/lib/utils";

const MANIFEST_TYPE_LABELS: Record<ManifestType, string> = {
  outbound: "Outbound", inbound: "Inbound", return: "Return",
  qa_sample: "QA Sample", trade_sample: "Trade Sample",
};

const TRANSPORTATION_LABELS: Record<string, string> = {
  origin_licensee: "Origin Licensee",
  destination_licensee: "Destination Licensee",
  transporter_licensee: "Transporter Licensee",
};

export function CreateManifestModal({ open, onClose, onSuccess, initialOrderId, initialAccountId }: {
  open: boolean; onClose: () => void; onSuccess?: (m: Manifest) => void; initialOrderId?: string; initialAccountId?: string;
}) {
  const { orgId } = useOrg();
  const createManifest = useCreateManifest();

  const [orderId, setOrderId] = useState("");
  const [manifestType, setManifestType] = useState<ManifestType>("outbound");
  const [destLicense, setDestLicense] = useState("");
  const [destName, setDestName] = useState("");
  const [destAddress, setDestAddress] = useState("");
  const [destPhone, setDestPhone] = useState("");
  const [destEmail, setDestEmail] = useState("");

  const [originLicense, setOriginLicense] = useState("");
  const [originName, setOriginName] = useState("");
  const [originAddress, setOriginAddress] = useState("");
  const [originPhone, setOriginPhone] = useState("");
  const [originEmail, setOriginEmail] = useState("");

  const [transportationType, setTransportationType] = useState<string>("origin_licensee");
  const [transporterLicense, setTransporterLicense] = useState("");
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [departure, setDeparture] = useState<string>(() => {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [arrival, setArrival] = useState("");
  const [notes, setNotes] = useState("");
  const [showAll, setShowAll] = useState(true);
  const [saving, setSaving] = useState(false);

  const [orders, setOrders] = useState<Array<{ id: string; order_number: string; account_id: string; status: string | null }>>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; company_name: string; license_number: string | null; address_line1: string | null; city: string | null; state: string | null; zip: string | null; primary_contact_phone: string | null; primary_contact_email: string | null; preferred_delivery_days?: string[] | null; preferred_delivery_window?: string | null }>>([]);
  const [drivers, setDrivers] = useState<Array<{ id: string; first_name: string | null; last_name: string | null; license_number: string | null; phone: string | null; driver_type: string | null }>>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [routes, setRoutes] = useState<Array<{ id: string; name: string; color: string | null }>>([]);
  const [facilities, setFacilities] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    setOrderId(initialOrderId ?? "");
    setManifestType("outbound");
    setDestLicense(""); setDestName(""); setDestAddress(""); setDestPhone(""); setDestEmail("");
    setTransportationType("origin_licensee");
    setTransporterLicense(""); setDriverId(""); setVehicleId(""); setRouteId("");
    setArrival(""); setNotes("");
    setShowAll(true);
    (async () => {
      const [ordersRes, accountsRes, driversRes, vehiclesRes, routesRes, facilitiesRes] = await Promise.all([
        supabase.from("grow_orders").select("id, order_number, account_id, status").eq("org_id", orgId).in("status", ["allocated", "packaged"]).order("created_at", { ascending: false }),
        supabase.from("grow_accounts").select("id, company_name, license_number, address_line1, city, state, zip, primary_contact_phone, primary_contact_email, preferred_delivery_days, preferred_delivery_window").eq("org_id", orgId),
        supabase.from("grow_drivers").select("id, first_name, last_name, license_number, phone, driver_type").eq("org_id", orgId).eq("is_active", true),
        supabase.from("grow_vehicles").select("*").eq("org_id", orgId).eq("is_active", true),
        supabase.from("grow_routes").select("id, name, color").eq("org_id", orgId).order("name"),
        supabase.from("grow_facilities").select("*").eq("org_id", orgId),
      ]);
      setOrders((ordersRes.data ?? []) as any);
      setAccounts((accountsRes.data ?? []) as any);
      setDrivers((driversRes.data ?? []) as any);
      setVehicles((vehiclesRes.data ?? []) as any);
      setRoutes((routesRes.data ?? []) as any);
      setFacilities((facilitiesRes.data ?? []) as any);
      // Origin from primary facility
      const primary = ((facilitiesRes.data ?? []) as any[]).find((f) => f.is_primary) ?? (facilitiesRes.data ?? [])[0];
      if (primary) {
        setOriginLicense(primary.license_number ?? "");
        setOriginName(primary.name ?? "");
        setOriginAddress([primary.address_line1, primary.city, primary.state, primary.zip].filter(Boolean).join(", "));
        setOriginPhone(primary.phone ?? "");
        setOriginEmail(primary.email ?? "");
      }
    })();
  }, [open, orgId, initialOrderId]);

  const selectedOrder = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);
  const selectedAccount = useMemo(() => {
    if (selectedOrder) return accounts.find((a) => a.id === selectedOrder.account_id);
    if (initialAccountId) return accounts.find((a) => a.id === initialAccountId);
    return accounts.find((a) => a.license_number === destLicense);
  }, [selectedOrder, accounts, initialAccountId, destLicense]);

  useEffect(() => {
    if (!selectedAccount) return;
    if (!destLicense) setDestLicense(selectedAccount.license_number ?? "");
    setDestName(selectedAccount.company_name);
    setDestAddress([selectedAccount.address_line1, selectedAccount.city, selectedAccount.state, selectedAccount.zip].filter(Boolean).join(", "));
    setDestPhone(selectedAccount.primary_contact_phone ?? "");
    setDestEmail(selectedAccount.primary_contact_email ?? "");
  }, [selectedAccount]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDriver = drivers.find((d) => d.id === driverId);
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  const valid = !!destLicense && !!manifestType && !!originLicense;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { toast.error("Destination + origin + type required"); return; }
    setSaving(true);
    try {
      const input: CreateManifestInput = {
        manifest_type: manifestType,
        order_id: orderId || null,
        origin_license_number: originLicense.trim(),
        origin_license_name: originName || null,
        origin_address: originAddress || null,
        origin_phone: originPhone || null,
        origin_email: originEmail || null,
        destination_license_number: destLicense.trim(),
        destination_license_name: destName || null,
        destination_address: destAddress || null,
        destination_phone: destPhone || null,
        destination_email: destEmail || null,
        transportation_type: transportationType || null,
        transporter_license_number: transportationType === "transporter_licensee" ? transporterLicense : null,
        driver_id: driverId || null,
        driver_name: selectedDriver ? `${selectedDriver.first_name ?? ""} ${selectedDriver.last_name ?? ""}`.trim() : null,
        driver_license_number: selectedDriver?.license_number ?? null,
        driver_phone: selectedDriver?.phone ?? null,
        vehicle_id: vehicleId || null,
        vehicle_make: selectedVehicle?.make ?? null,
        vehicle_model: selectedVehicle?.model ?? null,
        vehicle_year: selectedVehicle?.year ?? null,
        vehicle_color: selectedVehicle?.color ?? null,
        vehicle_vin: selectedVehicle?.vin ?? null,
        vehicle_license_plate: selectedVehicle?.license_plate ?? null,
        route_id: routeId || null,
        departure_datetime: departure ? new Date(departure).toISOString() : null,
        arrival_datetime: arrival ? new Date(arrival).toISOString() : null,
        notes: notes.trim() || null,
      };
      const manifest = await createManifest(input);
      toast.success(`Manifest ${manifest.external_id.slice(-6)} created`);
      onSuccess?.(manifest);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Create failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<FileText className="w-4 h-4 text-primary" />} title="Create manifest" subtitle="Transportation document for CCRS compliance" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Create Manifest
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Order" helper="Optional — auto-fills destination + pulls allocations into manifest items">
          <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— No linked order —</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number} · {accounts.find((a) => a.id === o.account_id)?.company_name}</option>)}
          </select>
        </Field>
        <Field label="Manifest type" required>
          <select value={manifestType} onChange={(e) => setManifestType(e.target.value as ManifestType)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {MANIFEST_TYPES.filter((t) => t !== "inbound").map((t) => <option key={t} value={t}>{MANIFEST_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Destination license #" required><Input value={destLicense} onChange={(e) => setDestLicense(e.target.value)} className="font-mono" /></Field>
          <Field label="Destination name"><Input value={destName} onChange={(e) => setDestName(e.target.value)} /></Field>
        </div>

        <button type="button" onClick={() => setShowAll((v) => !v)} className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 pt-1">
          {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showAll ? "Hide all fields" : "Show all fields"}
        </button>

        <AnimatePresence initial={false}>
          {showAll && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="space-y-5 overflow-hidden">
              <Section title="Origin">
                {facilities.length === 0 && <p className="text-[11px] text-amber-500">No facility set — add one in Settings to auto-fill origin</p>}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Origin license #" required><Input value={originLicense} onChange={(e) => setOriginLicense(e.target.value)} className="font-mono" /></Field>
                  <Field label="Origin name"><Input value={originName} onChange={(e) => setOriginName(e.target.value)} /></Field>
                </div>
                <Field label="Origin address"><Input value={originAddress} onChange={(e) => setOriginAddress(e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Origin phone"><Input value={originPhone} onChange={(e) => setOriginPhone(e.target.value)} /></Field>
                  <Field label="Origin email"><Input type="email" value={originEmail} onChange={(e) => setOriginEmail(e.target.value)} /></Field>
                </div>
              </Section>

              <Section title="Destination details">
                <Field label="Destination address"><Input value={destAddress} onChange={(e) => setDestAddress(e.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Destination phone"><Input value={destPhone} onChange={(e) => setDestPhone(e.target.value)} /></Field>
                  <Field label="Destination email"><Input type="email" value={destEmail} onChange={(e) => setDestEmail(e.target.value)} /></Field>
                </div>
              </Section>

              <Section title="Transportation">
                <Field label="Transportation type">
                  <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 w-full">
                    {MANIFEST_TRANSPORTATION_TYPES.map((t) => (
                      <button key={t} type="button" onClick={() => setTransportationType(t)} className={cn("flex-1 h-9 text-[11px] font-medium rounded-md transition-colors", transportationType === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                        {TRANSPORTATION_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </Field>
                {transportationType === "transporter_licensee" && (
                  <Field label="Transporter license #"><Input value={transporterLicense} onChange={(e) => setTransporterLicense(e.target.value)} className="font-mono" /></Field>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Driver">
                    <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">— None —</option>
                      {drivers.map((d) => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}{d.driver_type ? ` · ${d.driver_type}` : ""}</option>)}
                    </select>
                  </Field>
                  <Field label="Vehicle">
                    <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">— None —</option>
                      {vehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} · {v.license_plate}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Route">
                  <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">— None —</option>
                    {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </Field>
              </Section>

              <Section title="Schedule">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Departure" required><Input type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} /></Field>
                  <Field label="Estimated arrival"><Input type="datetime-local" value={arrival} onChange={(e) => setArrival(e.target.value)} /></Field>
                </div>
                {(() => {
                  const prefDays = selectedAccount?.preferred_delivery_days ?? [];
                  const prefWindow = selectedAccount?.preferred_delivery_window;
                  if (!departure || (!prefDays.length && !prefWindow)) return null;
                  const dep = new Date(departure);
                  const depDay = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][dep.getDay()];
                  const mismatch = prefDays.length > 0 && !prefDays.includes(depDay);
                  if (!mismatch && !prefWindow) return null;
                  return (
                    <div className={cn("rounded-lg border p-3 text-[11px] flex items-start gap-2",
                      mismatch ? "border-amber-500/30 bg-amber-500/5 text-amber-500" : "border-border bg-muted/30")}>
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>
                        {mismatch && <>Note: {selectedAccount?.company_name} prefers deliveries on <span className="font-semibold capitalize">{prefDays.join(", ")}</span>. This manifest is scheduled for <span className="font-semibold capitalize">{depDay}</span>. </>}
                        {prefWindow && <>Preferred window: <span className="font-semibold">{prefWindow}</span>.</>}
                      </span>
                    </div>
                  );
                })()}
              </Section>

              <Field label="Notes">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
