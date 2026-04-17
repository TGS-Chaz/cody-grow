import { useEffect, useState } from "react";
import { Loader2, Eye, EyeOff, X as XIcon, Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegrationConfig } from "@/hooks/useOrgSettings";
import { cn } from "@/lib/utils";

/**
 * A single config field on an integration form. Each integration contributes a
 * list of these; the modal renders them generically so each integration doesn't
 * need its own bespoke component.
 */
export type IntegrationField =
  | { key: string; label: string; type: "text" | "password" | "url" | "email"; placeholder?: string; helper?: string; required?: boolean; mono?: boolean }
  | { key: string; label: string; type: "number"; placeholder?: string; helper?: string; min?: number; max?: number; required?: boolean }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; helper?: string; required?: boolean }
  | { key: string; label: string; type: "toggle"; helper?: string }
  | { key: string; label: string; type: "multi-select"; options: { value: string; label: string }[]; helper?: string }
  | { key: string; label: string; type: "webhooks"; helper?: string }
  | { key: string; label: string; type: "api-key"; helper?: string };

export interface IntegrationDefinition {
  key: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  /** Visible form fields for the config modal. */
  fields: IntegrationField[];
  /** When true, the card is always shown as connected — used for Cody CRM/Intel. */
  autoConnected?: boolean;
  /** When true, the configure button is disabled with a "Coming soon" affordance. */
  comingSoon?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  integration: IntegrationDefinition;
  /** Existing config blob for this integration. */
  initialConfig: IntegrationConfig | null | undefined;
  onSave: (patch: IntegrationConfig) => Promise<void>;
  /** Optional custom UI rendered above the form (for integrations that need
   * bespoke connect/sync buttons — e.g. OAuth flows). */
  customPanel?: React.ReactNode;
}

/** Small sub-shape for webhook entries stored under config.webhooks. */
interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

const WEBHOOK_EVENT_OPTIONS = [
  { value: "order.created", label: "Order created" },
  { value: "order.completed", label: "Order completed" },
  { value: "plant.destroyed", label: "Plant destroyed" },
  { value: "harvest.completed", label: "Harvest completed" },
  { value: "manifest.shipped", label: "Manifest shipped" },
  { value: "lab_test.failed", label: "Lab test failed" },
  { value: "recall.opened", label: "Recall opened" },
  { value: "calibration.logged", label: "Calibration logged" },
];

export default function IntegrationConfigModal({ open, onClose, integration, initialConfig, onSave, customPanel }: Props) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [connected, setConnected] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [revealKeys, setRevealKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setValues(initialConfig?.config ?? {});
    setConnected(initialConfig?.connected ?? false);
    setRevealKeys({});
  }, [open, initialConfig]);

  const set = (k: string, v: any) => setValues((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    // Light validation — required fields must be non-empty
    for (const f of integration.fields) {
      if ((f as any).required && !values[f.key]) {
        toast.error(`${f.label} is required`);
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        connected,
        connected_at: connected ? (initialConfig?.connected_at ?? new Date().toISOString()) : undefined,
        config: values,
      });
      toast.success(`${integration.name} ${connected ? "connected" : "saved"}`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleReveal = (key: string) => setRevealKeys((r) => ({ ...r, [key]: !r[key] }));

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="md"
      header={
        <ModalHeader
          icon={<div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", integration.accentClass)}><integration.icon className="w-4 h-4" /></div>}
          title={`Configure ${integration.name}`}
          subtitle={integration.description}
        />
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="min-w-[100px]">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        {customPanel}
        {/* Connection toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex-1">
            <p className="text-[13px] font-medium text-foreground">Connection Status</p>
            <p className="text-[11px] text-muted-foreground">Toggle to mark this integration as connected</p>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={connected} onChange={(e) => setConnected(e.target.checked)} className="sr-only peer" />
            <div className="relative w-10 h-5 bg-muted rounded-full peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:bg-primary" />
          </label>
        </div>

        {integration.fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
              {field.label}
              {(field as any).required && <span className="text-destructive ml-0.5">*</span>}
            </label>

            {field.type === "text" || field.type === "email" || field.type === "url" ? (
              <Input
                type={field.type === "email" ? "email" : "text"}
                value={values[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={field.mono ? "font-mono" : undefined}
              />
            ) : field.type === "password" ? (
              <div className="relative">
                <Input
                  type={revealKeys[field.key] ? "text" : "password"}
                  value={values[field.key] ?? ""}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="font-mono pr-9"
                />
                <button
                  type="button"
                  onClick={() => toggleReveal(field.key)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent text-muted-foreground"
                  aria-label={revealKeys[field.key] ? "Hide" : "Reveal"}
                >
                  {revealKeys[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            ) : field.type === "number" ? (
              <Input
                type="number"
                value={values[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value ? Number(e.target.value) : "")}
                min={field.min}
                max={field.max}
                placeholder={field.placeholder}
                className="font-mono"
              />
            ) : field.type === "select" ? (
              <select
                value={values[field.key] ?? ""}
                onChange={(e) => set(field.key, e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Select —</option>
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : field.type === "toggle" ? (
              <label className="flex items-center gap-2 cursor-pointer select-none h-10">
                <input
                  type="checkbox"
                  checked={!!values[field.key]}
                  onChange={(e) => set(field.key, e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <span className="text-[13px] text-foreground">Enabled</span>
              </label>
            ) : field.type === "multi-select" ? (
              <div className="flex flex-wrap gap-1.5">
                {field.options.map((o) => {
                  const selected = (values[field.key] ?? []).includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        const prev: string[] = values[field.key] ?? [];
                        set(field.key, selected ? prev.filter((v) => v !== o.value) : [...prev, o.value]);
                      }}
                      className={cn(
                        "inline-flex items-center h-7 px-2.5 rounded-full border text-[12px] font-medium transition-colors",
                        selected
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-muted/30 border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            ) : field.type === "webhooks" ? (
              <WebhooksEditor value={values[field.key] ?? []} onChange={(v) => set(field.key, v)} />
            ) : field.type === "api-key" ? (
              <ApiKeyField
                value={values[field.key] ?? ""}
                onChange={(v) => set(field.key, v)}
                revealed={!!revealKeys[field.key]}
                onToggleReveal={() => toggleReveal(field.key)}
              />
            ) : null}

            {(field as any).helper && <p className="text-[11px] text-muted-foreground/70">{(field as any).helper}</p>}
          </div>
        ))}
      </div>
    </ScrollableModal>
  );
}

// ─── Webhooks editor (list with add/remove) ──────────────────────────────────

function WebhooksEditor({ value, onChange }: { value: WebhookEntry[]; onChange: (v: WebhookEntry[]) => void }) {
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);

  const addWebhook = () => {
    if (!newUrl.trim()) { toast.error("URL is required"); return; }
    if (newEvents.length === 0) { toast.error("Select at least one event"); return; }
    onChange([
      ...value,
      { id: crypto.randomUUID(), url: newUrl.trim(), events: newEvents, active: true },
    ]);
    setNewUrl("");
    setNewEvents([]);
  };

  const removeWebhook = (id: string) => onChange(value.filter((w) => w.id !== id));
  const toggleWebhook = (id: string) => onChange(value.map((w) => w.id === id ? { ...w, active: !w.active } : w));
  const toggleNewEvent = (v: string) => setNewEvents((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((w) => (
            <li key={w.id} className="rounded-lg border border-border bg-card px-3 py-2 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Zap className={cn("w-3.5 h-3.5", w.active ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-[12px] font-mono text-foreground truncate">{w.url}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {w.events.map((e) => (
                    <span key={e} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{e}</span>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => toggleWebhook(w.id)} className="text-[11px] text-muted-foreground hover:text-foreground">
                {w.active ? "Disable" : "Enable"}
              </button>
              <button type="button" onClick={() => removeWebhook(w.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
        <Input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://your-app.com/webhooks/cody"
          className="font-mono text-[12px]"
        />
        <div className="flex flex-wrap gap-1.5">
          {WEBHOOK_EVENT_OPTIONS.map((o) => {
            const selected = newEvents.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleNewEvent(o.value)}
                className={cn(
                  "inline-flex items-center h-6 px-2 rounded-full border text-[11px] font-medium transition-colors",
                  selected ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/30 border-border text-muted-foreground",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addWebhook} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add webhook
        </Button>
      </div>
    </div>
  );
}

// ─── API key field (read-only with rotate action) ────────────────────────────

function ApiKeyField({
  value, onChange, revealed, onToggleReveal,
}: { value: string; onChange: (v: string) => void; revealed: boolean; onToggleReveal: () => void }) {
  const rotate = () => {
    if (!confirm("Rotate API key? The existing key will stop working immediately.")) return;
    onChange(`cgrow_${crypto.randomUUID().replace(/-/g, "")}`);
  };

  const masked = value ? `cgrow_${value.slice(-8).padStart(value.length - 6, "•")}` : "";

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={revealed ? value : (masked || "")}
          readOnly
          placeholder={value ? "" : "Click Generate to create an API key"}
          className="font-mono pr-9"
        />
        {value && (
          <button
            type="button"
            onClick={onToggleReveal}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent text-muted-foreground"
          >
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!value ? (
          <Button type="button" size="sm" variant="outline" onClick={rotate} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Generate API key
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => { await navigator.clipboard.writeText(value); toast.success("API key copied"); }}
            >
              Copy
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={rotate} className="text-destructive border-destructive/40 hover:bg-destructive/10">
              Rotate
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
