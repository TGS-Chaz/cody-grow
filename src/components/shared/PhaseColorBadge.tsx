import { cn } from "@/lib/utils";

/**
 * Canonical phase color map — used for badges, card borders, status dots, icons.
 * Aligns with the design system phase colors.
 */
export const PHASE_COLORS: Record<string, { bg: string; text: string; hex: string; label: string }> = {
  // Cultivation phases
  immature:         { bg: "bg-blue-500/15", text: "text-blue-500", hex: "#3B82F6", label: "Immature" },
  seed:             { bg: "bg-blue-500/15", text: "text-blue-500", hex: "#3B82F6", label: "Seed" },
  clone:            { bg: "bg-blue-500/15", text: "text-blue-500", hex: "#3B82F6", label: "Clone" },
  vegetative:       { bg: "bg-emerald-500/15", text: "text-emerald-500", hex: "#10B981", label: "Vegetative" },
  flowering:        { bg: "bg-purple-500/15", text: "text-purple-500", hex: "#A855F7", label: "Flowering" },
  ready_for_harvest:{ bg: "bg-amber-500/15", text: "text-amber-500", hex: "#F59E0B", label: "Ready for Harvest" },
  harvesting:       { bg: "bg-amber-500/15", text: "text-amber-500", hex: "#F59E0B", label: "Harvesting" },
  harvested:        { bg: "bg-orange-500/15", text: "text-orange-500", hex: "#F97316", label: "Harvested" },

  // Processing phases
  drying:           { bg: "bg-orange-500/15", text: "text-orange-500", hex: "#F97316", label: "Drying" },
  curing:           { bg: "bg-orange-600/15", text: "text-orange-600", hex: "#EA580C", label: "Curing" },
  cured:            { bg: "bg-primary/15", text: "text-primary", hex: "#00D4AA", label: "Cured" },

  // Inventory states
  available:        { bg: "bg-primary/15", text: "text-primary", hex: "#00D4AA", label: "Available" },
  completed:        { bg: "bg-primary/15", text: "text-primary", hex: "#00D4AA", label: "Completed" },
  active:           { bg: "bg-emerald-500/15", text: "text-emerald-500", hex: "#10B981", label: "Active" },

  // Terminal states
  destroyed:        { bg: "bg-red-500/15", text: "text-red-500", hex: "#EF4444", label: "Destroyed" },
  failed:           { bg: "bg-red-500/15", text: "text-red-500", hex: "#EF4444", label: "Failed" },
  sold:             { bg: "bg-gray-500/15", text: "text-gray-500", hex: "#6B7280", label: "Sold" },
  transferred:      { bg: "bg-gray-500/15", text: "text-gray-500", hex: "#6B7280", label: "Transferred" },

  // Default fallback
  default:          { bg: "bg-gray-500/15", text: "text-gray-500", hex: "#6B7280", label: "Unknown" },
};

export function phaseToConfig(phase: string | null | undefined) {
  if (!phase) return PHASE_COLORS.default;
  return PHASE_COLORS[phase.toLowerCase()] ?? PHASE_COLORS.default;
}

interface PhaseColorBadgeProps {
  phase: string | null | undefined;
  /** Optional override label — otherwise uses the map's `label` */
  label?: string;
  className?: string;
}

export default function PhaseColorBadge({ phase, label, className }: PhaseColorBadgeProps) {
  const config = phaseToConfig(phase);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-5 px-2.5 rounded-full text-[11px] font-medium",
        config.bg,
        config.text,
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: config.hex }} />
      {label ?? config.label}
    </span>
  );
}
