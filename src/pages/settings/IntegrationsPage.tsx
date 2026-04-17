import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plug, Calculator, CreditCard, MessageSquare, Mail, Thermometer,
  Gauge, Printer, Loader2, CheckCircle2, Webhook, Code2, ChevronRight,
  Sparkles, TrendingUp, ArrowUpRight,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useCodyContext } from "@/hooks/useCodyContext";
import { useOrgSettings, IntegrationConfig } from "@/hooks/useOrgSettings";
import { useProductAccess } from "@/hooks/useProductAccess";
import { useOrg } from "@/lib/org";
import { callEdgeFunction } from "@/lib/edge-function";
import { toast } from "sonner";
import IntegrationConfigModal, {
  IntegrationDefinition, IntegrationField,
} from "./IntegrationConfigModal";
import { cn } from "@/lib/utils";

/** Build the static catalogue of integrations. Fields are consumed by
 * IntegrationConfigModal via its generic field-driven renderer. */
const INTEGRATIONS: IntegrationDefinition[] = [
  // Accounting
  {
    key: "quickbooks",
    name: "QuickBooks Online",
    description: "Sync invoices, payments, and COGS data",
    icon: Calculator,
    accentClass: "bg-emerald-500/15 text-emerald-500",
    fields: [
      { key: "sync_customers", label: "Sync customers", type: "toggle", helper: "Push grow_accounts → QBO customers" },
      { key: "sync_invoices", label: "Sync invoices", type: "toggle", helper: "Push grow_invoices → QBO invoices" },
      { key: "sync_payments", label: "Sync payments", type: "toggle", helper: "Push grow_payments → QBO payments" },
      { key: "sync_frequency", label: "Sync Frequency", type: "select", options: [
        { value: "manual", label: "Manual" },
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
      ] },
    ],
  },
  {
    key: "xero",
    name: "Xero",
    description: "Alternative accounting integration",
    icon: Calculator,
    accentClass: "bg-blue-500/15 text-blue-500",
    comingSoon: true,
    fields: [
      { key: "tenant_id", label: "Xero Tenant ID", type: "text", mono: true },
      { key: "sync_frequency", label: "Sync Frequency", type: "select", options: [
        { value: "realtime", label: "Real-time" }, { value: "daily", label: "Daily" }, { value: "manual", label: "Manual" },
      ] },
    ],
  },
  // Payments
  {
    key: "stripe",
    name: "Stripe",
    description: "Process payments and manage subscriptions",
    icon: CreditCard,
    accentClass: "bg-purple-500/15 text-purple-500",
    comingSoon: true,
    fields: [
      { key: "mode", label: "Mode", type: "select", options: [
        { value: "test", label: "Test" }, { value: "live", label: "Live" },
      ] },
      { key: "publishable_key", label: "Publishable Key", type: "text", mono: true, placeholder: "pk_test_..." },
      { key: "secret_key", label: "Secret Key", type: "password", placeholder: "sk_test_..." },
      { key: "webhook_secret", label: "Webhook Signing Secret", type: "password", placeholder: "whsec_...", helper: "Used to verify incoming Stripe webhooks" },
    ],
  },
  // Communication
  {
    key: "twilio",
    name: "Twilio / SMS",
    description: "Send SMS alerts, delivery notifications, and recall notices",
    icon: MessageSquare,
    accentClass: "bg-red-500/15 text-red-500",
    fields: [
      { key: "account_sid", label: "Account SID", type: "text", mono: true, placeholder: "AC..." },
      { key: "auth_token", label: "Auth Token", type: "password" },
      { key: "from_number", label: "From Number", type: "text", mono: true, placeholder: "+15095551234", helper: "Must be a Twilio-verified number" },
      { key: "test_to", label: "Test To", type: "text", mono: true, placeholder: "+15095550000", helper: "Click Test SMS below to send a test message here" },
    ],
  },
  {
    key: "smtp",
    name: "Email (SMTP)",
    description: "Custom email sending for invoices, reports, and notifications",
    icon: Mail,
    accentClass: "bg-blue-500/15 text-blue-500",
    comingSoon: true,
    fields: [
      { key: "host", label: "SMTP Host", type: "text", mono: true, placeholder: "smtp.yourcompany.com" },
      { key: "port", label: "Port", type: "number", placeholder: "587", min: 1, max: 65535 },
      { key: "username", label: "Username", type: "text" },
      { key: "password", label: "Password", type: "password" },
      { key: "from_address", label: "From Address", type: "email", placeholder: "noreply@yourcompany.com" },
      { key: "use_tls", label: "Use TLS", type: "toggle", helper: "Recommended for port 587" },
    ],
  },
  // Hardware
  {
    key: "aranet",
    name: "Aranet",
    description: "Environmental sensors — temperature, humidity, CO₂, VPD",
    icon: Thermometer,
    accentClass: "bg-emerald-500/15 text-emerald-500",
    comingSoon: true,
    fields: [
      { key: "api_key", label: "Aranet Cloud API Key", type: "password" },
      { key: "poll_interval_minutes", label: "Poll Interval (minutes)", type: "number", min: 1, max: 60, placeholder: "5" },
      { key: "auto_assign_areas", label: "Auto-assign sensors to areas", type: "toggle", helper: "Match sensor tags to area names when possible" },
    ],
  },
  {
    key: "trolmaster",
    name: "TrolMaster",
    description: "Hydro-X environmental control system integration",
    icon: Gauge,
    accentClass: "bg-blue-500/15 text-blue-500",
    comingSoon: true,
    fields: [
      { key: "api_endpoint", label: "API Endpoint", type: "url", mono: true, placeholder: "https://api.trolmaster.com/v2" },
      { key: "api_key", label: "API Key", type: "password" },
    ],
  },
  {
    key: "zebra",
    name: "Zebra Printers",
    description: "Print CCRS-compliant labels directly from Cody Grow",
    icon: Printer,
    accentClass: "bg-gray-500/15 text-gray-500",
    comingSoon: true,
    fields: [
      { key: "printer_ip", label: "Printer IP / Hostname", type: "text", mono: true, placeholder: "192.168.1.50" },
      { key: "printer_port", label: "Port", type: "number", placeholder: "9100" },
      { key: "label_size", label: "Default Label Size", type: "select", options: [
        { value: "4x6", label: '4" × 6"' },
        { value: "2x1", label: '2" × 1"' },
        { value: "3x2", label: '3" × 2"' },
        { value: "4x2", label: '4" × 2"' },
      ] },
    ],
  },
  // Cannabis ecosystem (auto-connected if the user owns the sibling product)
  {
    key: "cody_crm",
    name: "Cody CRM",
    description: "Sync customers, orders, and sales data with your CRM",
    icon: Sparkles,
    accentClass: "bg-primary/15 text-primary",
    autoConnected: true,
    fields: [
      { key: "sync_direction", label: "Sync Direction", type: "select", options: [
        { value: "both", label: "Bi-directional" },
        { value: "grow_to_crm", label: "Grow → CRM" },
        { value: "crm_to_grow", label: "CRM → Grow" },
      ] },
      { key: "sync_accounts", label: "Sync customer accounts", type: "toggle" },
      { key: "sync_orders", label: "Sync orders", type: "toggle" },
      { key: "sync_contacts", label: "Sync contacts", type: "toggle" },
    ],
  },
  {
    key: "cody_intel",
    name: "Cody Intel",
    description: "Market intelligence, competitor pricing, and demand signals",
    icon: TrendingUp,
    accentClass: "bg-purple-500/15 text-purple-500",
    autoConnected: true,
    fields: [
      { key: "share_anonymized_sales", label: "Share anonymized sales data", type: "toggle", helper: "Contributes to market-wide pricing and demand signals. Always anonymized." },
      { key: "receive_price_alerts", label: "Receive price optimization alerts", type: "toggle" },
      { key: "receive_demand_alerts", label: "Receive demand forecasting alerts", type: "toggle" },
    ],
  },
  // Other
  {
    key: "webhooks",
    name: "Webhooks",
    description: "Send events to any URL — Zapier, Make, n8n, custom apps",
    icon: Webhook,
    accentClass: "bg-orange-500/15 text-orange-500",
    fields: [
      { key: "webhooks", label: "Webhook Endpoints", type: "webhooks", helper: "Each endpoint receives POST requests for the events you select" },
    ],
  },
  {
    key: "api_access",
    name: "API Access",
    description: "REST API for custom integrations and third-party apps",
    icon: Code2,
    accentClass: "bg-indigo-500/15 text-indigo-500",
    fields: [
      { key: "api_key", label: "API Key", type: "api-key", helper: "Use this key in the Authorization header: Bearer cgrow_..." },
      { key: "rate_limit", label: "Rate Limit (requests/minute)", type: "number", min: 10, max: 1000, placeholder: "60" },
    ],
  },
];

export default function IntegrationsPage() {
  const { data: settings, loading, updateIntegration } = useOrgSettings();
  const crmAccess = useProductAccess("crm");
  const intelAccess = useProductAccess("intel");
  const { setContext, clearContext } = useCodyContext();

  const [activeIntegration, setActiveIntegration] = useState<IntegrationDefinition | null>(null);

  const integrations = settings?.integrations ?? {};

  const isConnected = (key: string): boolean => {
    if (key === "cody_crm") return crmAccess.hasAccess;
    if (key === "cody_intel") return intelAccess.hasAccess;
    return !!integrations[key]?.connected;
  };

  const connectedCount = useMemo(() => {
    return INTEGRATIONS.filter((i) => isConnected(i.key)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrations, crmAccess.hasAccess, intelAccess.hasAccess]);

  const payload = useMemo(() => ({
    integrations: {
      connected: connectedCount,
      total: INTEGRATIONS.length,
      connected_keys: INTEGRATIONS.filter((i) => isConnected(i.key)).map((i) => i.key),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [connectedCount]);

  useEffect(() => {
    setContext({ context_type: "integrations_list", page_data: payload });
    return () => clearContext();
  }, [setContext, clearContext, payload]);

  const handleSave = async (key: string, patch: IntegrationConfig) => {
    await updateIntegration(key, patch);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Integrations"
        description="Connect Cody Grow with your other business tools"
        breadcrumbs={[{ label: "Settings", to: "/settings" }, { label: "Integrations" }]}
        actions={
          <div className="text-[12px] text-muted-foreground">
            <span className="font-semibold text-foreground">{connectedCount}</span> of {INTEGRATIONS.length} connected
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTEGRATIONS.map((integration, i) => {
          const connected = isConnected(integration.key);
          const autoConnected = integration.autoConnected && connected;
          return (
            <motion.div
              key={integration.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="rounded-xl border border-border bg-card p-5 flex flex-col hover:shadow-lg hover:border-primary/20 transition-all"
              style={{ boxShadow: "0 1px 3px var(--shadow-color)" }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={cn("shrink-0 w-10 h-10 rounded-lg flex items-center justify-center", integration.accentClass)}>
                  <integration.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-foreground">{integration.name}</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                    {integration.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto pt-3">
                <StatusBadge connected={connected} autoConnected={autoConnected} comingSoon={integration.comingSoon} />
                <Button
                  size="sm"
                  variant={connected ? "outline" : "default"}
                  onClick={() => setActiveIntegration(integration)}
                  className="gap-1.5"
                >
                  {connected ? "Configure" : integration.comingSoon ? "Preview" : "Connect"}
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
              {integration.comingSoon && !autoConnected && (
                <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wider mt-2">Coming soon</p>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 rounded-lg border border-dashed border-border bg-card/50 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Plug className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-foreground">Need a different integration?</p>
            <p className="text-[11px] text-muted-foreground">Use the Webhooks or API Access options to connect anything custom.</p>
          </div>
        </div>
        <a
          href="https://lcb.wa.gov/ccrs/integrators"
          target="_blank"
          rel="noreferrer"
          className="text-[12px] font-medium text-primary hover:text-primary/80 transition-colors whitespace-nowrap inline-flex items-center gap-1"
        >
          Request integration <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>

      {activeIntegration && (
        <IntegrationConfigModal
          open={!!activeIntegration}
          onClose={() => setActiveIntegration(null)}
          integration={activeIntegration}
          initialConfig={integrations[activeIntegration.key]}
          onSave={(patch) => handleSave(activeIntegration.key, patch)}
          customPanel={
            activeIntegration.key === "quickbooks" ? <QuickBooksPanel config={integrations.quickbooks} onRefresh={() => { /* settings auto-refresh via hook */ }} /> :
            activeIntegration.key === "twilio" ? <TwilioPanel config={integrations.twilio} /> :
            null
          }
        />
      )}
    </div>
  );
}

// ─── QuickBooks connect / sync / disconnect panel ──────────────────────────
function QuickBooksPanel({ config, onRefresh }: { config?: IntegrationConfig; onRefresh: () => void }) {
  const { orgId } = useOrg();
  const connected = !!config?.connected;
  const companyName = (config?.config as any)?.company_name;
  const lastSync = (config?.config as any)?.last_sync_at;
  const lastResult = (config?.config as any)?.last_sync_result;
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);

  const handleConnect = async () => {
    if (!orgId) return;
    setBusy("connect");
    try {
      const res = await callEdgeFunction<{ auth_url: string }>("quickbooks-auth", { action: "authorize_url", org_id: orgId });
      const w = window.open(res.auth_url, "qbo_auth", "width=720,height=820");
      if (!w) { toast.error("Popup blocked — enable popups and retry"); return; }
      const listener = (ev: MessageEvent) => {
        if (ev.data?.type === "qbo_success") {
          toast.success("QuickBooks connected");
          window.removeEventListener("message", listener);
          onRefresh();
          setTimeout(() => window.location.reload(), 500);
        } else if (ev.data?.type === "qbo_error") {
          toast.error(ev.data.message ?? "QBO connect failed");
          window.removeEventListener("message", listener);
        }
      };
      window.addEventListener("message", listener);
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
    finally { setBusy(null); }
  };

  const handleSync = async () => {
    if (!orgId) return;
    setBusy("sync");
    try {
      const res = await callEdgeFunction<{ ok: boolean; counts: any; errors: string[] }>("quickbooks-sync", { org_id: orgId, sync_type: "all" }, 120_000);
      const { counts, errors } = res;
      toast.success(`Synced ${counts.customers} customers, ${counts.invoices} invoices, ${counts.payments} payments${errors.length ? ` · ${errors.length} error${errors.length === 1 ? "" : "s"}` : ""}`);
      if (errors.length > 0) console.warn("QBO sync errors:", errors);
      onRefresh();
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) { toast.error(err?.message ?? "Sync failed"); }
    finally { setBusy(null); }
  };

  const handleDisconnect = async () => {
    if (!orgId) return;
    if (!window.confirm("Disconnect QuickBooks? Tokens will be cleared — you'll need to re-authorize.")) return;
    setBusy("disconnect");
    try {
      await callEdgeFunction("quickbooks-auth", { action: "disconnect", org_id: orgId });
      toast.success("QuickBooks disconnected");
      onRefresh();
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
    finally { setBusy(null); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold">{connected ? `Connected${companyName ? ` · ${companyName}` : ""}` : "Not connected"}</p>
          <p className="text-[11px] text-muted-foreground">
            {connected
              ? (lastSync ? `Last synced ${new Date(lastSync).toLocaleString()}${lastResult ? ` (${lastResult.counts?.customers ?? 0}c / ${lastResult.counts?.invoices ?? 0}i / ${lastResult.counts?.payments ?? 0}p)` : ""}` : "Not synced yet")
              : "Connect to sync customers, invoices, and payments."}
          </p>
        </div>
        {connected ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={handleSync} disabled={busy !== null} className="gap-1.5">
              {busy === "sync" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
              Sync Now
            </Button>
            <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={busy !== null}>
              Disconnect
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={handleConnect} disabled={busy !== null} className="gap-1.5">
            {busy === "connect" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Connect
          </Button>
        )}
      </div>
      {!connected && (
        <p className="text-[10px] text-muted-foreground italic">
          Requires QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI server-side.
        </p>
      )}
    </div>
  );
}

// ─── Twilio test-sms panel ─────────────────────────────────────────────────
function TwilioPanel({ config }: { config?: IntegrationConfig }) {
  const { orgId } = useOrg();
  const connected = !!config?.connected;
  const testTo = (config?.config as any)?.test_to;
  const [busy, setBusy] = useState(false);

  const handleTest = async () => {
    if (!orgId) return;
    if (!testTo) { toast.error("Set a Test To number below first"); return; }
    setBusy(true);
    try {
      await callEdgeFunction("send-sms", { org_id: orgId, to: testTo, message: "Cody Grow test SMS — your Twilio integration is working." });
      toast.success(`Test SMS sent to ${testTo}`);
    } catch (err: any) { toast.error(err?.message ?? "Test failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
      <div>
        <p className="text-[13px] font-semibold">{connected ? "Connected" : "Not connected"}</p>
        <p className="text-[11px] text-muted-foreground">
          {connected ? "Send a test message to verify." : "Fill in Account SID / Auth Token / From Number below to enable SMS."}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={handleTest} disabled={busy || !testTo} className="gap-1.5">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
        Test SMS
      </Button>
    </div>
  );
}

function StatusBadge({ connected, autoConnected, comingSoon }: { connected: boolean; autoConnected?: boolean; comingSoon?: boolean }) {
  if (autoConnected) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 uppercase tracking-wider">
        <CheckCircle2 className="w-2.5 h-2.5" /> Auto-connected
      </span>
    );
  }
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 uppercase tracking-wider">
        <CheckCircle2 className="w-2.5 h-2.5" /> Connected
      </span>
    );
  }
  if (comingSoon) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
        Not connected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
      Not connected
    </span>
  );
}

void Plug;
void Array<IntegrationField>;
