import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyableIdProps {
  value: string;
  /** Optional: show only first/last N chars with ellipsis */
  truncate?: number;
  className?: string;
}

export default function CopyableId({ value, truncate, className }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  const display = truncate && value.length > truncate * 2 + 3
    ? `${value.slice(0, truncate)}…${value.slice(-truncate)}`
    : value;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <span
      onClick={handleCopy}
      title={`Click to copy: ${value}`}
      className={cn(
        "group inline-flex items-center gap-1 font-mono text-[11px] bg-muted/30 text-foreground rounded-sm px-1.5 py-0.5 cursor-pointer hover:bg-muted/60 transition-colors",
        className,
      )}
    >
      {display}
      {copied ? (
        <Check className="w-3 h-3 text-primary" />
      ) : (
        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity" />
      )}
    </span>
  );
}
