import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceArea, CartesianGrid,
} from "recharts";
import { EnvReading, EnvTimeRange } from "@/hooks/useAreas";

export type EnvMetric = "temperature" | "humidity" | "vpd" | "co2";

interface TargetRange { min: number | null; max: number | null }

interface Props {
  data: EnvReading[];
  metric: EnvMetric;
  targetRange: TargetRange;
  timeRange: EnvTimeRange;
  height?: number;
}

const METRIC_COLORS: Record<EnvMetric, string> = {
  temperature: "#EF4444",
  humidity: "#3B82F6",
  vpd: "#14B8A6",
  co2: "#10B981",
};

const METRIC_LABELS: Record<EnvMetric, string> = {
  temperature: "Temperature (°F)",
  humidity: "Humidity (%)",
  vpd: "VPD (kPa)",
  co2: "CO₂ (ppm)",
};

const METRIC_UNIT: Record<EnvMetric, string> = {
  temperature: "°F",
  humidity: "%",
  vpd: " kPa",
  co2: " ppm",
};

function readingValue(r: EnvReading, metric: EnvMetric): number | null {
  switch (metric) {
    case "temperature": return r.temperature_f;
    case "humidity": return r.humidity_pct;
    case "vpd": return r.vpd;
    case "co2": return r.co2_ppm;
  }
}

function formatValue(v: number | null, metric: EnvMetric): string {
  if (v == null) return "—";
  if (metric === "vpd") return `${v.toFixed(2)}${METRIC_UNIT[metric]}`;
  if (metric === "co2") return `${Math.round(v)}${METRIC_UNIT[metric]}`;
  return `${v.toFixed(1)}${METRIC_UNIT[metric]}`;
}

/**
 * Reusable environmental time-series chart. Shows a reference area for the
 * target range so it's easy to see when readings drift out of spec. Color
 * varies by metric (red=temp, blue=humidity, teal=vpd, green=co2).
 */
export default function EnvironmentChart({ data, metric, targetRange, timeRange, height = 220 }: Props) {
  const color = METRIC_COLORS[metric];
  const label = METRIC_LABELS[metric];

  const series = useMemo(() => data.map((r) => ({
    t: new Date(r.recorded_at).getTime(),
    v: readingValue(r, metric),
  })).filter((d) => d.v != null), [data, metric]);

  const tickFormatter = (v: number) => {
    const d = new Date(v);
    if (timeRange === "24h") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const domain = useMemo(() => {
    const values = series.map((d) => d.v as number);
    if (values.length === 0) return undefined;
    const lo = Math.min(...values, targetRange.min ?? Infinity);
    const hi = Math.max(...values, targetRange.max ?? -Infinity);
    // Add 10% padding on each side
    const pad = (hi - lo) * 0.1 || 1;
    return [Math.max(0, lo - pad), hi + pad];
  }, [series, targetRange]);

  if (series.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5" style={{ height }}>
        <h4 className="text-[12px] font-semibold text-foreground mb-2">{label}</h4>
        <div className="h-[calc(100%-2rem)] flex items-center justify-center text-[12px] text-muted-foreground">
          No readings for this time range
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[12px] font-semibold text-foreground">{label}</h4>
        {targetRange.min != null && targetRange.max != null && (
          <span className="text-[10px] text-muted-foreground font-mono">
            Target: {formatValue(targetRange.min, metric)}–{formatValue(targetRange.max, metric)}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={tickFormatter}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            domain={domain as any}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            width={48}
          />
          {targetRange.min != null && targetRange.max != null && (
            <ReferenceArea
              y1={targetRange.min}
              y2={targetRange.max}
              fill="#10B981"
              fillOpacity={0.08}
              stroke="#10B981"
              strokeOpacity={0.2}
              strokeDasharray="3 3"
            />
          )}
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid var(--glass-border)",
              borderRadius: 8,
              fontSize: 11,
            }}
            labelFormatter={(v: any) => new Date(Number(v)).toLocaleString("en-US", {
              month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
            })}
            formatter={(v: any) => {
              const num = Number(v);
              const inRange = targetRange.min == null || targetRange.max == null
                ? null
                : num >= targetRange.min && num <= targetRange.max;
              return [
                formatValue(num, metric),
                inRange == null ? label : (inRange ? `${label} ✓` : `${label} ⚠`),
              ] as [string, string];
            }}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
