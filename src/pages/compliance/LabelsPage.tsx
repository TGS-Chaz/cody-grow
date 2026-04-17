import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Tag, Plus, Edit, Copy, Star, Loader2, Printer, Download, FileText, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import BarcodeRenderer from "@/components/shared/BarcodeRenderer";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useLabelTemplates, useCreateTemplate, useUpdateTemplate, useGenerateLabel,
  LabelTemplate, LabelFields, LabelData, DEFAULT_LABEL_CONFIG,
} from "@/hooks/useLabels";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";

const LABEL_TYPES = [
  { value: "inventory", label: "Inventory" },
  { value: "product", label: "Product" },
  { value: "box", label: "Box" },
  { value: "qa_sample", label: "QA Sample" },
  { value: "cover_page", label: "Cover Page" },
];

export default function LabelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "templates";
  const setTab = (t: string) => { const next = new URLSearchParams(searchParams); next.set("tab", t); setSearchParams(next, { replace: true }); };

  const { data: templates, loading, refresh } = useLabelTemplates();
  const updateTemplate = useUpdateTemplate();
  const [templateModal, setTemplateModal] = useState<LabelTemplate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { setContext, clearContext } = useCodyContext();
  useEffect(() => {
    setContext({ context_type: "labels_list", page_data: { templates: templates.length, by_type: templates.reduce<Record<string, number>>((acc, t) => { const k = t.type ?? "other"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {}) } });
    return () => clearContext();
  }, [setContext, clearContext, templates]);

  const setDefault = async (id: string) => {
    try {
      // Unset other defaults of the same type first
      const t = templates.find((x) => x.id === id);
      if (t?.type) {
        for (const other of templates) {
          if (other.id !== id && other.type === t.type && other.is_default) {
            await updateTemplate(other.id, { is_default: false });
          }
        }
      }
      await updateTemplate(id, { is_default: true });
      toast.success("Set as default");
      refresh();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title="Labels"
        description="Compliant label templates per WAC 314-55-105"
        breadcrumbs={[{ label: "Compliance" }, { label: "Labels" }]}
        actions={tab === "templates" ? <Button onClick={() => { setTemplateModal(null); setModalOpen(true); }} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Template</Button> : null}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="generate">Generate Labels</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : templates.length === 0 ? (
            <EmptyState icon={Tag} title="No templates yet" description="Create a template with WAC-required fields." action={<Button onClick={() => { setTemplateModal(null); setModalOpen(true); }} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Template</Button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((t) => (
                <TemplateCard key={t.id} template={t} onEdit={() => { setTemplateModal(t); setModalOpen(true); }} onSetDefault={() => setDefault(t.id)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="generate">
          <GenerateLabelsPanel templates={templates} />
        </TabsContent>
      </Tabs>

      <TemplateModal open={modalOpen} onClose={() => setModalOpen(false)} template={templateModal} onSuccess={() => refresh()} />
    </div>
  );
}

function TemplateCard({ template, onEdit, onSetDefault }: { template: LabelTemplate; onEdit: () => void; onSetDefault: () => void }) {
  const config = template.layout_config as LabelFields;
  const fieldCount = Object.entries(config ?? {}).filter(([k, v]) => k.startsWith("include_") && v === true).length;
  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-[13px] font-semibold">{template.name}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {template.type && <span className="inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">{template.type.replace(/_/g, " ")}</span>}
            {template.is_default && <span className="inline-flex items-center gap-1 h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-primary/15 text-primary"><Star className="w-2.5 h-2.5 fill-primary" /> Default</span>}
          </div>
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground mb-3 space-y-0.5">
        <div>{fieldCount} field{fieldCount === 1 ? "" : "s"} included</div>
        <div>Barcode: <span className="font-mono">{config?.barcode_format ?? "Code128"}</span></div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5 flex-1"><Edit className="w-3.5 h-3.5" /> Edit</Button>
        {!template.is_default && <Button size="sm" variant="ghost" onClick={onSetDefault} className="gap-1.5"><Star className="w-3.5 h-3.5" /></Button>}
      </div>
    </div>
  );
}

function TemplateModal({ open, onClose, template, onSuccess }: { open: boolean; onClose: () => void; template: LabelTemplate | null; onSuccess?: () => void }) {
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const [name, setName] = useState("");
  const [type, setType] = useState("inventory");
  const [config, setConfig] = useState<LabelFields>(DEFAULT_LABEL_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setType(template.type ?? "inventory");
      setConfig({ ...DEFAULT_LABEL_CONFIG, ...(template.layout_config as LabelFields) });
    } else {
      setName(""); setType("inventory"); setConfig(DEFAULT_LABEL_CONFIG);
    }
  }, [open, template]);

  const toggle = <K extends keyof LabelFields>(k: K) => setConfig((c) => ({ ...c, [k]: !c[k] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      if (template) {
        await updateTemplate(template.id, { name, type, config });
      } else {
        await createTemplate({ name, type, config });
      }
      toast.success(template ? "Template updated" : "Template created");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally { setSaving(false); }
  };

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<Tag className="w-4 h-4 text-primary" />} title={template ? "Edit template" : "Create label template"} subtitle="Configure required WAC 314-55-105 fields" />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!name.trim() || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
            {template ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flower Lot Default" /></Field>
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {LABEL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2 text-[11px]">
          <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span>WAC 314-55-105 requires UBI number, lot number, net weight, potency, universal cannabis symbol (min 3/4" × 3/4"), warning text, and not-for-kids symbol on edibles (min 3/4" × 1/2").</span>
        </div>

        <Section title="Required fields">
          <Toggle label="UBI Number" value={config.include_ubi} onChange={() => toggle("include_ubi")} />
          <Toggle label="Lot Number" value={config.include_lot_number} onChange={() => toggle("include_lot_number")} />
          <Toggle label="Net Weight" value={config.include_net_weight} onChange={() => toggle("include_net_weight")} />
          <Toggle label="THC/CBD Potency" value={config.include_potency} onChange={() => toggle("include_potency")} />
          <Toggle label="Universal Cannabis Symbol" value={config.include_universal_symbol} onChange={() => toggle("include_universal_symbol")} />
          <Toggle label="Warning Text" value={config.include_warning_text} onChange={() => toggle("include_warning_text")} />
        </Section>

        <Section title="Conditional fields">
          <Toggle label="Not For Kids Symbol (required for edibles)" value={config.include_not_for_kids} onChange={() => toggle("include_not_for_kids")} />
          <Toggle label="Harvest Date" value={config.include_harvest_date} onChange={() => toggle("include_harvest_date")} />
          <Toggle label="QR Code (links to COA / product info)" value={config.include_qr_code} onChange={() => toggle("include_qr_code")} />
        </Section>

        <Field label="Barcode format">
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 w-full">
            {(["Code128", "QR", "DataMatrix"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setConfig((c) => ({ ...c, barcode_format: f }))} className={cn("flex-1 h-9 text-[12px] font-medium rounded-md transition-colors", config.barcode_format === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {f}
              </button>
            ))}
          </div>
        </Field>

        {config.include_warning_text && (
          <Field label="Warning text"><textarea value={config.warning_text ?? ""} onChange={(e) => setConfig((c) => ({ ...c, warning_text: e.target.value }))} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" /></Field>
        )}
      </div>
    </ScrollableModal>
  );
}

function GenerateLabelsPanel({ templates }: { templates: LabelTemplate[] }) {
  const { orgId } = useOrg();
  const generate = useGenerateLabel();
  const [templateId, setTemplateId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [preview, setPreview] = useState<{ template: LabelTemplate; data: LabelData } | null>(null);
  const [batches, setBatches] = useState<Array<{ id: string; barcode: string }>>([]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase.from("grow_batches").select("id, barcode").eq("org_id", orgId).gt("current_quantity", 0).order("created_at", { ascending: false }).limit(50);
      setBatches((data ?? []) as any);
    })();
  }, [orgId]);

  useEffect(() => {
    if (templateId && batchId) {
      generate(batchId, templateId).then(setPreview);
    } else {
      setPreview(null);
    }
  }, [templateId, batchId, generate]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-[13px] font-semibold">Generate labels</h3>
        <Field label="Template">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Select template —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_default ? " · default" : ""}</option>)}
          </select>
        </Field>
        <Field label="Batch">
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Select batch —</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.barcode}</option>)}
          </select>
        </Field>
        <Field label="Quantity per batch">
          <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="font-mono" />
        </Field>
        <div className="flex items-center gap-2 pt-2">
          <Button disabled={!preview} onClick={() => toast.info("PDF generation — coming soon")} className="gap-1.5"><Download className="w-3.5 h-3.5" /> Generate PDF</Button>
          <Button variant="outline" disabled={!preview} onClick={() => toast.info("Zebra ZPL export — coming when Zebra integration is wired")} className="gap-1.5"><Printer className="w-3.5 h-3.5" /> Print to Zebra</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-[13px] font-semibold mb-3">Preview</h3>
        {preview ? <LabelPreview template={preview.template} data={preview.data} /> : (
          <EmptyState icon={FileText} title="Label preview" description="Select a template and batch to preview." />
        )}
      </div>
    </div>
  );
}

function LabelPreview({ template, data }: { template: LabelTemplate; data: LabelData }) {
  const config = template.layout_config as LabelFields;
  return (
    <div className="border-2 border-foreground p-4 rounded-lg bg-white text-black text-[11px] space-y-2" style={{ width: 280 }}>
      {config.include_ubi && <div className="flex justify-between"><span className="font-semibold">UBI:</span><span className="font-mono">{data.ubi_number}</span></div>}
      <div className="font-bold text-[13px]">{data.product_name}</div>
      {data.strain_name && <div className="italic">{data.strain_name}</div>}
      {config.include_lot_number && <div className="flex justify-between"><span className="font-semibold">Lot:</span><span className="font-mono">{data.lot_number}</span></div>}
      {config.include_net_weight && <div className="flex justify-between"><span className="font-semibold">Net Weight:</span><span className="font-mono">{data.net_weight_grams.toFixed(1)}g</span></div>}
      {config.include_potency && (
        <div className="flex justify-between gap-2 border-t border-b py-1">
          <span>THC: <span className="font-bold">{data.thc_total_pct != null ? `${Number(data.thc_total_pct).toFixed(2)}%` : "—"}</span></span>
          <span>CBD: <span className="font-bold">{data.cbd_total_pct != null ? `${Number(data.cbd_total_pct).toFixed(2)}%` : "—"}</span></span>
        </div>
      )}
      {config.include_harvest_date && data.harvest_date && (
        <div className="flex justify-between"><span className="font-semibold">Harvested:</span><span>{new Date(data.harvest_date).toLocaleDateString()}</span></div>
      )}
      <div className="flex items-center gap-2 pt-1">
        {config.include_universal_symbol && (
          <div className="w-10 h-10 border-2 border-foreground flex items-center justify-center font-bold text-[10px]">THC</div>
        )}
        {config.include_not_for_kids && (
          <div className="w-10 h-8 border-2 border-destructive flex items-center justify-center text-[7px] font-bold text-destructive">NOT FOR KIDS</div>
        )}
        <div className="flex-1 flex items-center justify-center h-10">
          <BarcodeRenderer
            value={data.lot_number}
            format={config.barcode_format === "QR" ? "qr" : config.barcode_format === "DataMatrix" ? "datamatrix" : "code128"}
            height={36}
            width={config.barcode_format === "QR" || config.barcode_format === "DataMatrix" ? 36 : undefined}
            showText={false}
            backgroundColor="#ffffff"
            foregroundColor="#000000"
          />
        </div>
      </div>
      {config.include_warning_text && (
        <div className="text-[8px] border-t pt-1 italic">{data.warning_text}</div>
      )}
    </div>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</h3>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 cursor-pointer hover:bg-accent/30 transition-colors">
      <input type="checkbox" checked={value} onChange={onChange} className="w-4 h-4 rounded border-border accent-primary" />
      <span className="text-[11px] font-medium">{label}</span>
    </label>
  );
}

void Copy;
