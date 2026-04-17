import { useMemo } from "react";
import type { Task } from "./useTasks";

export interface EmployeeBreakdown {
  user_id: string;
  name: string;
  completed: number;
  on_time: number;
  late: number;
  avg_completion_hours: number | null;
}

export interface TypeBreakdown {
  type: string;
  completed: number;
  avg_completion_hours: number | null;
}

export interface TrendPoint {
  date: string;   // YYYY-MM-DD
  completed: number;
}

export interface TaskAnalytics {
  total: number;
  completed: number;
  completionRate: number;     // 0-1
  avgCompletionHours: number | null;
  onTimeRate: number;         // 0-1 (completed on or before scheduled_end)
  byEmployee: EmployeeBreakdown[];
  byType: TypeBreakdown[];
  trend: TrendPoint[];        // last 30d
}

function hoursBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const ta = new Date(a).getTime(); const tb = new Date(b).getTime();
  if (!isFinite(ta) || !isFinite(tb)) return null;
  return Math.max(0, (tb - ta) / 3600000);
}

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

/**
 * Pure, memoized analytics calculator. Accepts the list returned by useTasks()
 * so the caller can apply filters (by date range, assignee, etc.) before
 * analysis. Avoids an extra fetch — analytics is a derivation, not a new query.
 */
export function useTaskAnalytics(tasks: Task[]): TaskAnalytics {
  return useMemo(() => {
    const completed = tasks.filter((t) => t.status === "completed");
    const completionRate = tasks.length === 0 ? 0 : completed.length / tasks.length;

    const durations: number[] = [];
    let onTime = 0;
    const byEmp = new Map<string, EmployeeBreakdown>();
    const byTyp = new Map<string, { completed: number; totals: number[] }>();
    const trendMap = new Map<string, number>();

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;

    for (const t of completed) {
      const start = (t as any).created_at as string | undefined;
      const done = (t as any).completed_at as string | undefined;
      const sched = (t as any).scheduled_end as string | undefined;
      const h = hoursBetween(start, done);
      if (h != null) durations.push(h);

      if (sched && done) {
        if (new Date(done).getTime() <= new Date(sched).getTime()) onTime++;
      }

      // Trend
      if (done) {
        const doneTs = new Date(done).getTime();
        if (doneTs >= thirtyDaysAgo) {
          const key = ymd(new Date(done));
          trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
        }
      }

      // By employee
      const uid = (t as any).assigned_to_user_id as string | null;
      if (uid) {
        const name = (t as any).assignee?.full_name ?? (t as any).assignee?.email ?? uid.slice(0, 6);
        const entry = byEmp.get(uid) ?? { user_id: uid, name, completed: 0, on_time: 0, late: 0, avg_completion_hours: null };
        entry.completed++;
        if (sched && done) {
          if (new Date(done).getTime() <= new Date(sched).getTime()) entry.on_time++;
          else entry.late++;
        }
        // Rolling avg
        if (h != null) {
          const prev = entry.avg_completion_hours;
          entry.avg_completion_hours = prev == null ? h : (prev * (entry.completed - 1) + h) / entry.completed;
        }
        byEmp.set(uid, entry);
      }

      // By type
      const typ = ((t as any).task_type as string | null) ?? "general";
      const tEntry = byTyp.get(typ) ?? { completed: 0, totals: [] };
      tEntry.completed++;
      if (h != null) tEntry.totals.push(h);
      byTyp.set(typ, tEntry);
    }

    const avgCompletionHours = durations.length === 0 ? null : durations.reduce((a, b) => a + b, 0) / durations.length;
    const onTimeRate = completed.length === 0 ? 0 : onTime / completed.length;

    const byEmployee = Array.from(byEmp.values()).sort((a, b) => b.completed - a.completed);
    const byType: TypeBreakdown[] = Array.from(byTyp.entries()).map(([type, v]) => ({
      type,
      completed: v.completed,
      avg_completion_hours: v.totals.length === 0 ? null : v.totals.reduce((a, b) => a + b, 0) / v.totals.length,
    })).sort((a, b) => b.completed - a.completed);

    // Fill trend for every day of the 30-day window
    const trend: TrendPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = ymd(d);
      trend.push({ date: key, completed: trendMap.get(key) ?? 0 });
    }

    return {
      total: tasks.length,
      completed: completed.length,
      completionRate,
      avgCompletionHours,
      onTimeRate,
      byEmployee,
      byType,
      trend,
    };
  }, [tasks]);
}
