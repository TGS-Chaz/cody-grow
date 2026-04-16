import { ReactNode } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterChip {
  key: string;
  label: string;
  value: string | number;
  onRemove: () => void;
}

interface FiltersBarProps {
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  activeChips?: FilterChip[];
  onClearAll?: () => void;
  /** Right-side slot — usually saved views / columns / export */
  actions?: ReactNode;
  className?: string;
}

export default function FiltersBar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search…",
  activeChips = [],
  onClearAll,
  actions,
  className,
}: FiltersBarProps) {
  return (
    <div className={cn("flex flex-col gap-2 mb-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              data-filters-search
              className="w-full h-9 pl-8 pr-3 text-[13px] rounded-md bg-background border border-border placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {actions}
        </div>
      </div>
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <SlidersHorizontal className="w-3 h-3 text-muted-foreground" />
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              onClick={chip.onRemove}
              className="group inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-primary/10 border border-primary/20 text-[11px] text-primary hover:bg-primary/15 transition-colors"
            >
              <span className="font-medium">{chip.label}:</span>
              <span>{chip.value}</span>
              <X className="w-3 h-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
          {onClearAll && (
            <button
              onClick={onClearAll}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
