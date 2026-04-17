import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FileText, Loader2, Download, Copy, Printer, Send, Archive, MoreHorizontal, Truck, Building2,
  CalendarDays, User, Activity, ShieldCheck, Package, XCircle, RotateCcw, MessageSquare,
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
import CopyableId from "@/components/shared/CopyableId";
import BarcodeRenderer from "@/components/shared/BarcodeRenderer";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useManifest, useManifestItems, useUpdateManifest, useCancelManifest,
  Manifest, ManifestItem,
} from "@/hooks/useManifests";
import { useProfile } from "@/lib/profile";
import { generateManifestCSV, generateManifestCSVFilename } from "@/lib/ccrs/generateManifestCSV";
import { ProcessReturnModal } from "./ProcessReturnModal";
import { generateWCIAJSON } from "@/lib/ccrs/generateWCIAJSON";
import { useSendSMS, useSMSEnabled } from "@/hooks/useSMS";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "success" | "warning" | "critical" | "info" | "muted"> = {
  draft: "muted", generated: "info", uploaded_to_ccrs: "info", ccrs_confirmed: "info",
  in_transit: "warning", accepted: "success", rejected: "critical", cancelled: "critical",
};

export default function ManifestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const setActiveTab = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const { data: manifest, loading, refresh } = useManifest(id);
  const { data: items, loading: itemsLoading } = useManifestItems(id);
  const update = useUpdateManifest();
  const cancel = useCancelManifest();
  const [returnOpen, setReturnOpen] = useState(false);
  const smsEnabled = useSMSEnabled();
  const sendSMS = useSendSMS();
  const [smsSending, setSmsSending] = useState(false);
  const { profile } = useProfile();

  useEffect(() => {
    if (searchParams.get("print") === "1" && manifest) {
      setTimeout(() => window.print(), 300);
      const next = new URLSearchParams(searchParams);
      next.delete("print");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, manifest, setSearchParams]);

  const { setContext, clearContext } = useCodyContext();
  const payload = useMemo(() => {
    if (!manifest) return null;
    return {
      manifest: { external_id: manifest.external_id, type: manifest.manifest_type, status: manifest.status },
      origin: manifest.origin_license_name,
      destination: manifest.destination_license_name,
      items_count: items.length,
      total_quantity: items.reduce((s, i) => s + Number(i.quantity ?? 0), 0),
      total_value: items.reduce((s, i) => s + Number(i.quantity ?? 0) * Number(i.unit_price ?? 0), 0),
      ccrs_uploaded: !!manifest.ccrs_submitted_at,
    };
  }, [manifest, items]);
  useEffect(() => {
    if (!manifest || !payload) return;
    setContext({ context_type: "manifest_detail", context_id: manifest.id, page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload, manifest?.id]);

  useShortcut(["p"], () => window.print(), { description: "Print", scope: "Manifest Detail", enabled: !!manifest });

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!manifest) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState icon={FileText} title="Manifest not found" description="This manifest may have been cancelled or doesn't exist." primaryAction={<Button onClick={() => navigate("/sales/manifests")}>← Back</Button>} />
      </div>
    );
  }

  const totalQty = items.reduce((s, i) => s + Number(i.quantity ?? 0), 0);
  const totalValue = items.reduce((s, i) => s + Number(i.quantity ?? 0) * Number(i.unit_price ?? 0), 0);

  const csvContent = useMemo(() => generateManifestCSV({
    submittedBy: profile?.full_name ?? "system",
    submittedDate: new Date(),
    manifest: {
      externalIdentifier: manifest.external_id,
      originLicenseNumber: manifest.origin_license_number,
      originLicenseeName: manifest.origin_license_name,
      originAddress: manifest.origin_address,
      originPhone: manifest.origin_phone,
      originEmail: manifest.origin_email,
      destinationLicenseNumber: manifest.destination_license_number,
      destinationLicenseeName: manifest.destination_license_name,
      destinationAddress: manifest.destination_address,
      destinationPhone: manifest.destination_phone,
      destinationEmail: manifest.destination_email,
      transportationType: manifest.transportation_type,
      transporterLicenseNumber: manifest.transporter_license_number,
      driverName: manifest.driver_name,
      driverLicenseNumber: manifest.driver_license_number,
      vehicleMake: manifest.vehicle_make,
      vehicleModel: manifest.vehicle_model,
      vehicleYear: manifest.vehicle_year,
      vehicleColor: manifest.vehicle_color,
      vehicleVIN: manifest.vehicle_vin,
      vehicleLicensePlate: manifest.vehicle_license_plate,
      departureDateTime: manifest.departure_datetime,
      arrivalDateTime: manifest.arrival_datetime,
    },
    items: items.map((i) => ({
      inventoryExternalIdentifier: i.batch?.external_id ?? null,
      plantExternalIdentifier: i.plant_id ?? null,
      quantity: Number(i.quantity),
      unitPrice: i.unit_price,
      servingsPerUnit: i.servings_per_unit,
      labtestExternalIdentifier: i.labtest_external_identifier,
      createdBy: profile?.full_name ?? "system",
      createdDate: new Date(),
      operation: "Insert",
    })),
  }), [manifest, items, profile]);

  const wciaJSON = useMemo(() => generateWCIAJSON({
    manifest: {
      externalIdentifier: manifest.external_id,
      manifestType: manifest.manifest_type,
      departureDateTime: manifest.departure_datetime,
      arrivalDateTime: manifest.arrival_datetime,
      notes: manifest.notes,
    },
    origin: {
      licenseNumber: manifest.origin_license_number,
      licenseeName: manifest.origin_license_name,
      address: manifest.origin_address,
      phone: manifest.origin_phone,
      email: manifest.origin_email,
    },
    destination: {
      licenseNumber: manifest.destination_license_number,
      licenseeName: manifest.destination_license_name,
      address: manifest.destination_address,
      phone: manifest.destination_phone,
      email: manifest.destination_email,
    },
    transportation: {
      type: manifest.transportation_type,
      transporterLicenseNumber: manifest.transporter_license_number,
      driverName: manifest.driver_name,
      driverLicenseNumber: manifest.driver_license_number,
      vehicleMake: manifest.vehicle_make,
      vehicleModel: manifest.vehicle_model,
      vehicleYear: manifest.vehicle_year,
      vehicleColor: manifest.vehicle_color,
      vehicleVIN: manifest.vehicle_vin,
      vehicleLicensePlate: manifest.vehicle_license_plate,
    },
    items: items.map((i) => ({
      inventoryExternalIdentifier: i.batch?.external_id ?? null,
      plantExternalIdentifier: i.plant_id ?? null,
      productName: i.product?.name ?? null,
      productCategory: i.product?.ccrs_inventory_category ?? null,
      strainName: i.strain?.name ?? null,
      quantity: Number(i.quantity),
      unitPrice: i.unit_price,
      servingsPerUnit: i.servings_per_unit,
      labtestExternalIdentifier: i.labtest_external_identifier,
    })),
  }), [manifest, items]);

  const sendDeliverySMS = async () => {
    const to = manifest.destination_phone;
    if (!to) { toast.error("Destination phone not set on this manifest"); return; }
    const driverName = manifest.driver ? `${manifest.driver.first_name ?? ""} ${manifest.driver.last_name ?? ""}`.trim() : manifest.driver_name;
    const plate = manifest.vehicle?.license_plate ?? manifest.vehicle_license_plate ?? "—";
    const eta = manifest.departure_datetime ? new Date(manifest.departure_datetime).toLocaleString() : "TBD";
    const orderNo = manifest.order?.order_number ?? manifest.external_id.slice(-6);
    const message = `Your order ${orderNo} is on its way. ETA: ${eta}. Driver: ${driverName ?? "—"}, Vehicle: ${plate}.`;
    setSmsSending(true);
    try {
      await sendSMS({ to, message });
      toast.success(`SMS sent to ${to}`);
    } catch (err: any) { toast.error(err?.message ?? "SMS failed"); }
    finally { setSmsSending(false); }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={`Manifest ${manifest.external_id.slice(-6)}`}
        breadcrumbs={[
          { label: "Sales & Fulfillment" },
          { label: "Manifests", to: "/sales/manifests" },
          { label: manifest.external_id.slice(-6) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">{manifest.manifest_type.replace(/_/g, " ")}</span>
            {manifest.status && <StatusPill label={manifest.status.replace(/_/g, " ")} variant={STATUS_VARIANT[manifest.status] ?? "muted"} />}
            <Button variant="outline" onClick={() => downloadText(csvContent, generateManifestCSVFilename(manifest.origin_license_number))} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="w-9 h-9"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={async () => { try { await update(manifest.id, { wcia_json_data: wciaJSON, status: "generated" } as any); toast.success("WCIA JSON saved"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }}>
                  <Send className="w-3.5 h-3.5" /> Save WCIA JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => { try { await update(manifest.id, { ccrs_submitted_at: new Date().toISOString(), status: "uploaded_to_ccrs" } as any); toast.success("Marked uploaded"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }}>
                  <ShieldCheck className="w-3.5 h-3.5" /> Mark CCRS Uploaded (stub)
                </DropdownMenuItem>
                {smsEnabled && (manifest.status === "in_transit" || manifest.status === "generated" || manifest.status === "uploaded_to_ccrs") && (
                  <DropdownMenuItem onClick={sendDeliverySMS} disabled={smsSending}>
                    <MessageSquare className="w-3.5 h-3.5" /> Send Delivery SMS
                  </DropdownMenuItem>
                )}
                {manifest.manifest_type === "outbound" && manifest.status === "accepted" && (
                  <DropdownMenuItem onClick={() => setReturnOpen(true)}>
                    <RotateCcw className="w-3.5 h-3.5" /> Process Return
                  </DropdownMenuItem>
                )}
                {manifest.status !== "cancelled" && manifest.status !== "accepted" && (
                  <DropdownMenuItem onClick={async () => { try { await cancel(manifest.id); toast.success("Cancelled"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} className="text-destructive">
                    <XCircle className="w-3.5 h-3.5" /> Cancel
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-6 -mt-4 flex-wrap">
        <CopyableId value={manifest.external_id} className="text-[11px]" />
        <BarcodeRenderer value={manifest.external_id} format="code128" height={40} showText={false} />
        {manifest.order && (
          <>
            <span>·</span>
            <button onClick={() => navigate(`/sales/orders/${manifest.order!.id}`)} className="font-mono text-primary hover:underline">{manifest.order.order_number}</button>
          </>
        )}
        {manifest.departure_datetime && <><span>·</span><span>Departs <DateTime value={manifest.departure_datetime} /></span></>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <InfoCard icon={FileText} label="Type">
          <div className="text-[13px] font-semibold capitalize">{manifest.manifest_type.replace(/_/g, " ")}</div>
        </InfoCard>
        <InfoCard icon={ShieldCheck} label="Status">
          {manifest.status ? <StatusPill label={manifest.status.replace(/_/g, " ")} variant={STATUS_VARIANT[manifest.status] ?? "muted"} /> : "—"}
        </InfoCard>
        <InfoCard icon={Building2} label="Origin">
          <div className="text-[13px] font-medium truncate">{manifest.origin_license_name ?? "—"}</div>
          <div className="text-[10px] font-mono text-muted-foreground">{manifest.origin_license_number}</div>
        </InfoCard>
        <InfoCard icon={Building2} label="Destination">
          {manifest.account ? <button onClick={() => navigate(`/sales/accounts/${manifest.account!.id}`)} className="text-[13px] font-medium text-primary hover:underline text-left truncate block max-w-full">{manifest.account.company_name}</button> : <div className="text-[13px] font-medium truncate">{manifest.destination_license_name ?? "—"}</div>}
          <div className="text-[10px] font-mono text-muted-foreground">{manifest.destination_license_number}</div>
        </InfoCard>
        <InfoCard icon={Truck} label="Driver / Vehicle">
          <div className="text-[12px]">{manifest.driver_name ?? "—"}</div>
          {manifest.vehicle_license_plate && <div className="text-[10px] font-mono text-muted-foreground">{manifest.vehicle_license_plate}</div>}
        </InfoCard>
        <InfoCard icon={CalendarDays} label="Schedule">
          <div className="text-[11px]">Dep: {manifest.departure_datetime ? new Date(manifest.departure_datetime).toLocaleDateString() : "—"}</div>
          <div className="text-[11px]">Arr: {manifest.arrival_datetime ? new Date(manifest.arrival_datetime).toLocaleDateString() : "—"}</div>
        </InfoCard>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="items">Items ({items.length})</TabsTrigger>
          <TabsTrigger value="ccrs">CCRS</TabsTrigger>
          <TabsTrigger value="wcia">WCIA JSON</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <DocumentPreview manifest={manifest} items={items} totalQty={totalQty} totalValue={totalValue} />
        </TabsContent>
        <TabsContent value="items">
          <ItemsPanel items={items} loading={itemsLoading} />
        </TabsContent>
        <TabsContent value="ccrs">
          <CCRSPanel manifest={manifest} csvContent={csvContent} onMarkUploaded={async () => { try { await update(manifest.id, { ccrs_submitted_at: new Date().toISOString(), status: "uploaded_to_ccrs" } as any); toast.success("Marked uploaded"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} />
        </TabsContent>
        <TabsContent value="wcia">
          <WCIAPanel manifest={manifest} json={wciaJSON} onSave={async () => { try { await update(manifest.id, { wcia_json_data: wciaJSON, status: "generated" } as any); toast.success("WCIA JSON saved"); refresh(); } catch (err: any) { toast.error(err?.message ?? "Failed"); } }} />
        </TabsContent>
        <TabsContent value="documents">
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[14px] font-semibold mb-1">Documents</p>
            <p className="text-[12px] text-muted-foreground mb-3">CCRS-generated PDFs and COAs will appear here once uploaded.</p>
            {manifest.ccrs_manifest_pdf_url && <a href={manifest.ccrs_manifest_pdf_url} target="_blank" rel="noreferrer" className="text-[12px] text-primary hover:underline">View CCRS PDF →</a>}
          </div>
        </TabsContent>
        <TabsContent value="activity">
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[14px] font-semibold mb-1">Audit log coming soon</p>
            <p className="text-[12px] text-muted-foreground">Create, CSV generation, CCRS uploads, WCIA shares, and acceptance events will appear here.</p>
          </div>
        </TabsContent>
      </Tabs>

      <ProcessReturnModal open={returnOpen} onClose={() => setReturnOpen(false)} sourceManifestId={manifest.id} onSuccess={() => refresh()} />
    </div>
  );
}

// ─── Document preview (printable) ───────────────────────────────────────────
function DocumentPreview({ manifest, items, totalQty, totalValue }: { manifest: Manifest; items: ManifestItem[]; totalQty: number; totalValue: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 space-y-6 print:shadow-none print:border-0">
      <div className="text-center pb-4 border-b-2 border-foreground">
        <h2 className="text-[20px] font-bold tracking-tight">TRANSPORTATION MANIFEST</h2>
        <p className="text-[11px] text-muted-foreground mt-1">This is a preview — the official manifest PDF is generated by CCRS after CSV upload.</p>
        <div className="flex items-center justify-center gap-6 mt-3 text-[11px]">
          <span><span className="text-muted-foreground">Manifest ID:</span> <span className="font-mono font-semibold">{manifest.external_id}</span></span>
          <span><span className="text-muted-foreground">Type:</span> <span className="font-semibold capitalize">{manifest.manifest_type.replace(/_/g, " ")}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-1 text-[12px]">
          <h3 className="font-bold uppercase tracking-wider text-[11px]">Origin</h3>
          <div className="font-semibold">{manifest.origin_license_name ?? "—"}</div>
          <div className="font-mono text-muted-foreground">License: {manifest.origin_license_number}</div>
          <div>{manifest.origin_address ?? "—"}</div>
          {manifest.origin_phone && <div>{manifest.origin_phone}</div>}
          {manifest.origin_email && <div>{manifest.origin_email}</div>}
        </div>
        <div className="space-y-1 text-[12px]">
          <h3 className="font-bold uppercase tracking-wider text-[11px]">Destination</h3>
          <div className="font-semibold">{manifest.destination_license_name ?? "—"}</div>
          <div className="font-mono text-muted-foreground">License: {manifest.destination_license_number}</div>
          <div>{manifest.destination_address ?? "—"}</div>
          {manifest.destination_phone && <div>{manifest.destination_phone}</div>}
          {manifest.destination_email && <div>{manifest.destination_email}</div>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 pt-4 border-t border-border">
        <div className="space-y-1 text-[12px]">
          <h3 className="font-bold uppercase tracking-wider text-[11px]">Transportation</h3>
          <div>Type: <span className="font-semibold capitalize">{manifest.transportation_type?.replace(/_/g, " ") ?? "—"}</span></div>
          {manifest.transporter_license_number && <div>Transporter: <span className="font-mono">{manifest.transporter_license_number}</span></div>}
        </div>
        <div className="space-y-1 text-[12px]">
          <h3 className="font-bold uppercase tracking-wider text-[11px]">Driver</h3>
          <div>{manifest.driver_name ?? "—"}</div>
          {manifest.driver_license_number && <div className="font-mono text-muted-foreground">DL: {manifest.driver_license_number}</div>}
          {manifest.driver_phone && <div className="text-muted-foreground">{manifest.driver_phone}</div>}
        </div>
        <div className="space-y-1 text-[12px]">
          <h3 className="font-bold uppercase tracking-wider text-[11px]">Vehicle</h3>
          <div>{[manifest.vehicle_year, manifest.vehicle_make, manifest.vehicle_model].filter(Boolean).join(" ") || "—"}</div>
          {manifest.vehicle_license_plate && <div className="font-mono text-muted-foreground">Plate: {manifest.vehicle_license_plate}</div>}
          {manifest.vehicle_color && <div className="text-muted-foreground">{manifest.vehicle_color}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border text-[12px]">
        <div><span className="text-muted-foreground">Departure:</span> <span className="font-semibold">{manifest.departure_datetime ? new Date(manifest.departure_datetime).toLocaleString() : "—"}</span></div>
        <div><span className="text-muted-foreground">Estimated arrival:</span> <span className="font-semibold">{manifest.arrival_datetime ? new Date(manifest.arrival_datetime).toLocaleString() : "—"}</span></div>
      </div>

      <div className="pt-4 border-t-2 border-foreground">
        <h3 className="font-bold uppercase tracking-wider text-[11px] mb-3">Items ({items.length})</h3>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-foreground">
              <th className="text-left py-1.5">External ID</th>
              <th className="text-left py-1.5">Product</th>
              <th className="text-left py-1.5">Strain</th>
              <th className="text-right py-1.5">Qty</th>
              <th className="text-right py-1.5">Unit $</th>
              <th className="text-left py-1.5">Lab Test ID</th>
              <th className="text-right py-1.5">Line $</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-border/50">
                <td className="py-1.5 font-mono">{i.batch?.external_id ?? i.plant_id ?? "—"}</td>
                <td className="py-1.5">{i.product?.name ?? "—"}</td>
                <td className="py-1.5">{i.strain?.name ?? "—"}</td>
                <td className="py-1.5 text-right font-mono">{Number(i.quantity).toFixed(1)}</td>
                <td className="py-1.5 text-right font-mono">{i.unit_price != null ? `$${Number(i.unit_price).toFixed(2)}` : "—"}</td>
                <td className="py-1.5 font-mono text-[10px]">{i.labtest_external_identifier ?? "—"}</td>
                <td className="py-1.5 text-right font-mono font-semibold">{i.unit_price != null ? `$${(Number(i.quantity) * Number(i.unit_price)).toFixed(2)}` : "—"}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-foreground">
              <td colSpan={3} className="py-2 font-bold">TOTALS</td>
              <td className="py-2 text-right font-mono font-bold">{totalQty.toFixed(1)}</td>
              <td colSpan={2} />
              <td className="py-2 text-right font-mono font-bold">${totalValue.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {manifest.notes && (
        <div className="pt-4 border-t border-border text-[12px]">
          <h3 className="font-bold uppercase tracking-wider text-[11px] mb-1">Notes</h3>
          <p className="whitespace-pre-wrap">{manifest.notes}</p>
        </div>
      )}
    </div>
  );
}

// ─── Items ──────────────────────────────────────────────────────────────────
function ItemsPanel({ items, loading }: { items: ManifestItem[]; loading: boolean }) {
  const navigate = useNavigate();
  const columns: ColumnDef<ManifestItem>[] = useMemo(() => [
    { id: "external", header: "External ID", cell: ({ row }) => row.original.batch ? <CopyableId value={row.original.batch.external_id} className="text-[11px]" truncate={6} /> : row.original.plant_id ? <span className="font-mono text-[11px]">{row.original.plant_id}</span> : <span className="text-muted-foreground">—</span> },
    { id: "barcode", header: "Batch", cell: ({ row }) => row.original.batch ? <button onClick={() => navigate(`/inventory/batches/${row.original.batch!.id}`)} className="font-mono text-[12px] text-primary hover:underline">{row.original.batch.barcode}</button> : <span className="text-muted-foreground">—</span> },
    { id: "product", header: "Product", cell: ({ row }) => row.original.product?.name ?? <span className="text-muted-foreground">—</span> },
    { id: "strain", header: "Strain", cell: ({ row }) => row.original.strain?.name ?? <span className="text-muted-foreground">—</span> },
    { accessorKey: "quantity", header: "Qty", cell: ({ row }) => <span className="font-mono text-[12px]">{Number(row.original.quantity).toFixed(1)}</span> },
    { accessorKey: "unit_price", header: "Unit $", cell: ({ row }) => row.original.unit_price != null ? <span className="font-mono text-[12px]">${Number(row.original.unit_price).toFixed(2)}</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "labtest_external_identifier", header: "Lab Test", cell: ({ row }) => row.original.labtest_external_identifier ? <span className="font-mono text-[10px]">{row.original.labtest_external_identifier.slice(0, 8)}…</span> : <span className="text-muted-foreground">—</span> },
    { id: "total", header: "Total", cell: ({ row }) => row.original.unit_price != null ? <span className="font-mono text-[12px] font-semibold">${(Number(row.original.quantity) * Number(row.original.unit_price)).toFixed(2)}</span> : <span className="text-muted-foreground">—</span> },
  ], [navigate]);

  return (
    <DataTable
      columns={columns} data={items} loading={loading}
      empty={{ icon: Package, title: "No items", description: "Manifest items are auto-populated from linked order allocations." }}
    />
  );
}

// ─── CCRS ───────────────────────────────────────────────────────────────────
function CCRSPanel({ manifest, csvContent, onMarkUploaded }: { manifest: Manifest; csvContent: string; onMarkUploaded: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-[14px] font-semibold">Manifest.CSV</h3>
            <p className="text-[11px] text-muted-foreground mt-1">CCRS-format CSV ready to upload. Upload triggers CCRS to generate the official manifest PDF.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(csvContent); setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1500); }} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" /> {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" onClick={() => downloadText(csvContent, generateManifestCSVFilename(manifest.origin_license_number))} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Download CSV
            </Button>
          </div>
        </div>
        <pre className="rounded-lg border border-border bg-muted/30 p-3 text-[10px] font-mono overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed">{csvContent}</pre>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-[14px] font-semibold">Upload status</h3>
        {manifest.ccrs_submitted_at ? (
          <div className="flex items-center gap-2 text-[12px]">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Uploaded <DateTime value={manifest.ccrs_submitted_at} /></span>
            {manifest.ccrs_manifest_pdf_url && <a href={manifest.ccrs_manifest_pdf_url} target="_blank" rel="noreferrer" className="text-primary hover:underline ml-auto">View PDF →</a>}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-muted-foreground italic">Not yet uploaded to CCRS.</p>
            <Button size="sm" onClick={onMarkUploaded} className="gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Mark Uploaded (stub)</Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">Direct upload via SAW integration is on the roadmap. For now, copy/download the CSV and upload it through the CCRS portal manually.</p>
      </div>
    </div>
  );
}

// ─── WCIA ───────────────────────────────────────────────────────────────────
function WCIAPanel({ manifest, json, onSave }: { manifest: Manifest; json: any; onSave: () => void }) {
  const [copied, setCopied] = useState(false);
  const stringified = JSON.stringify(json, null, 2);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-[14px] font-semibold">WCIA JSON</h3>
            <p className="text-[11px] text-muted-foreground mt-1">B2B data exchange format for sharing transfer data with the receiving licensee.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(stringified); setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1500); }} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" /> {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadText(stringified, `manifest_${manifest.external_id}_wcia.json`, "application/json")} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Download JSON
            </Button>
            <Button size="sm" onClick={onSave} className="gap-1.5"><Send className="w-3.5 h-3.5" /> Save & Generate Link</Button>
          </div>
        </div>
        <pre className="rounded-lg border border-border bg-muted/30 p-3 text-[10px] font-mono overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed">{stringified}</pre>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-[12px] text-muted-foreground">
        Share this JSON with the receiving party so they can import the transfer data into their system without re-keying.
      </div>
    </div>
  );
}

function downloadText(content: string, filename: string, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

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

void Archive; void User; void cn;
