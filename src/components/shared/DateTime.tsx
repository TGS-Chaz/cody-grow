import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type DateFormat = "auto" | "date-only" | "time-only" | "full";

interface DateTimeProps {
  value: string | Date | null | undefined;
  format?: DateFormat;
  className?: string;
}

function relativeLabel(d: Date, now: Date): string {
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffMs / 60000);
  const diffHr = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (Math.abs(diffSec) < 60) return "Just now";
  if (Math.abs(diffMin) < 60) {
    const m = Math.abs(diffMin);
    return `${m} minute${m === 1 ? "" : "s"} ${diffMs > 0 ? "ago" : "from now"}`;
  }
  if (Math.abs(diffHr) < 24) {
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `Today at ${time}`;
  }
  if (Math.abs(diffDays) < 7 && diffDays >= 0) {
    const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${weekday} at ${time}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DateTime({ value, format = "auto", className = "" }: DateTimeProps) {
  if (!value) return <span className={className + " text-muted-foreground"}>—</span>;

  const date = typeof value === "string" ? new Date(value) : value;
  if (isNaN(date.getTime())) return <span className={className + " text-muted-foreground"}>—</span>;

  const now = new Date();
  const exact = date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  let display: string;
  if (format === "date-only") {
    display = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } else if (format === "time-only") {
    display = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } else if (format === "full") {
    display = exact;
  } else {
    display = relativeLabel(date, now);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={date.toISOString()} className={className}>
          {display}
        </time>
      </TooltipTrigger>
      <TooltipContent>{exact}</TooltipContent>
    </Tooltip>
  );
}
