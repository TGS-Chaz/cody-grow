import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (n: number) => void;
  className?: string;
}

export default function PaginationControls({
  page, pageSize, totalCount, totalPages, onPageChange, onPageSizeChange, className,
}: PaginationControlsProps) {
  if (totalCount === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(totalCount, page * pageSize);
  return (
    <div className={`flex items-center justify-between px-2 py-3 text-[12px] text-muted-foreground ${className ?? ""}`}>
      <div>
        Showing <span className="font-semibold text-foreground">{from.toLocaleString()}</span>–<span className="font-semibold text-foreground">{to.toLocaleString()}</span> of <span className="font-semibold text-foreground">{totalCount.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
            className="h-8 px-2 text-[12px] rounded-md bg-background border border-border"
          >
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}/page</option>)}
          </select>
        )}
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="h-8 px-2 gap-1">
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </Button>
        <span className="font-mono text-[11px]">
          Page <span className="font-semibold text-foreground">{page}</span> / {totalPages}
        </span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="h-8 px-2 gap-1">
          Next <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
