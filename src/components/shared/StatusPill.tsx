import { CheckCircle2, AlertTriangle, AlertOctagon, Info, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "critical" | "info" | "muted";

const VARIANT_CONFIG: Record<StatusVariant, { bg: string; text: string; icon: LucideIcon }> = {
  success:  { bg: "bg-emerald-500/15", text: "text-emerald-500", icon: CheckCircle2 },
  warning:  { bg: "bg-amber-500/15", text: "text-amber-500", icon: AlertTriangle },
  critical: { bg: "bg-red-500/15", text: "text-red-500", icon: AlertOctagon },
  info:     { bg: "bg-blue-500/15", text: "text-blue-500", icon: Info },
  muted:    { bg: "bg-gray-500/15", text: "text-gray-500", icon: Info },
};

interface StatusPillProps {
  label: string;
  variant?: StatusVariant;
  icon?: LucideIcon;
  className?: string;
}

export default function StatusPill({ label, variant = "info", icon: OverrideIcon, className }: StatusPillProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = OverrideIcon ?? config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-5 px-2.5 rounded-full text-[11px] font-medium",
        config.bg,
        config.text,
        className,
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
