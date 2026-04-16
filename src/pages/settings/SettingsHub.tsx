import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Building2,
  Warehouse,
  Users,
  UserCheck,
  Truck,
  ClipboardList,
  Scale,
  ShieldCheck,
  Sparkles,
  Plug,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { useCodyContext } from "@/hooks/useCodyContext";

interface SettingCategory {
  title: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind tint color classes for the icon bg */
  color: string;
  iconColor: string;
}

const CATEGORIES: SettingCategory[] = [
  {
    title: "Organization",
    description: "Company profile, branding, primary details",
    to: "/settings/organization",
    icon: Building2,
    color: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    title: "Facilities",
    description: "Licensed locations and canopy allotments",
    to: "/settings/facilities",
    icon: Warehouse,
    color: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
  {
    title: "Users & Roles",
    description: "Team members, permissions, RBAC matrix",
    to: "/settings/users",
    icon: Users,
    color: "bg-purple-500/10",
    iconColor: "text-purple-500",
  },
  {
    title: "Employees",
    description: "People at your facility (with or without system access)",
    to: "/settings/employees",
    icon: UserCheck,
    color: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  {
    title: "Fleet",
    description: "Drivers, vehicles, and delivery routes",
    to: "/settings/fleet",
    icon: Truck,
    color: "bg-orange-500/10",
    iconColor: "text-orange-500",
  },
  {
    title: "Customer Setup",
    description: "Account statuses, note attributes, price lists, discounts",
    to: "/settings/customer-setup",
    icon: ClipboardList,
    color: "bg-pink-500/10",
    iconColor: "text-pink-500",
  },
  {
    title: "Equipment",
    description: "Scales, sensors, calibration tracking",
    to: "/settings/equipment",
    icon: Scale,
    color: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
  {
    title: "CCRS & Compliance",
    description: "Integrator config, upload preferences, CCRS settings",
    to: "/settings/ccrs",
    icon: ShieldCheck,
    color: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  {
    title: "AI Preferences",
    description: "Enable AI features, thresholds, Cody customization",
    to: "/settings/ai",
    icon: Sparkles,
    color: "bg-gradient-to-br from-primary/15 to-purple-500/15",
    iconColor: "text-primary",
  },
  {
    title: "Integrations",
    description: "QuickBooks, Stripe, hardware devices, third-party apps",
    to: "/settings/integrations",
    icon: Plug,
    color: "bg-indigo-500/10",
    iconColor: "text-indigo-500",
  },
];

export default function SettingsHub() {
  const { setContext, clearContext } = useCodyContext();

  useEffect(() => {
    setContext({
      context_type: "settings_hub",
      page_data: { categories: CATEGORIES.map((c) => c.title) },
    });
    return () => clearContext();
  }, [setContext, clearContext]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Settings"
        description="Configure your organization, team, and operations"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES.map((cat, i) => (
          <motion.div
            key={cat.to}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <Link
              to={cat.to}
              className="group block rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
              style={{ boxShadow: "0 1px 3px var(--shadow-color)" }}
            >
              <div className="flex items-start gap-4">
                <div className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-lg ${cat.color}`}>
                  <cat.icon className={`w-5 h-5 ${cat.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-foreground mb-0.5 flex items-center gap-1.5">
                    {cat.title}
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </h3>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{cat.description}</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Get help */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 rounded-lg border border-dashed border-border bg-card/50 p-5 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <HelpCircle className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">First time here?</p>
            <p className="text-[11px] text-muted-foreground">Let Cody walk you through the essential setup steps.</p>
          </div>
        </div>
        <button
          onClick={() => {
            window.dispatchEvent(new Event("open-cody-chat"));
            window.dispatchEvent(new CustomEvent("cody-prefill", { detail: "Walk me through initial setup" }));
          }}
          className="text-[12px] font-medium text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
        >
          Get help setting up →
        </button>
      </motion.div>
    </div>
  );
}
