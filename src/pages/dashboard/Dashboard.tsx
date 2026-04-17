import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Leaf, Flower2, Scissors, Package, ShoppingCart, ShieldCheck, Clock, CheckCircle2,
  AlertTriangle, ArrowRight, CalendarDays,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useProfile, profileDisplayName } from "@/lib/profile";
import PageHeader from "@/components/shared/PageHeader";
import OrgHeader from "@/components/shared/OrgHeader";
import DateTime from "@/components/shared/DateTime";
import CodyInsightsPanel from "@/components/cody/CodyInsightsPanel";
import DemandForecastCard from "@/components/ai/DemandForecastCard";
import {
  useDashboardStats, useUpcomingHarvests, useTodaysTasks, useRecentActivity, useEnvironmentalAlerts,
} from "@/hooks/useDashboard";
import { useCompleteTask } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const { data: stats } = useDashboardStats();
  const { data: harvests } = useUpcomingHarvests(7);
  const { data: tasks, refresh: refreshTasks } = useTodaysTasks();
  const { data: activity } = useRecentActivity(10);
  const { data: alerts } = useEnvironmentalAlerts(5);
  const completeTask = useCompleteTask();

  const displayName = profileDisplayName(profile, user?.email);

  const ccrsColor = stats.ccrsPendingCategories === 0 ? "stat-accent-emerald" : stats.ccrsPendingCategories > 3 ? "stat-accent-amber" : "stat-accent-blue";

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader title={`${getGreeting()}, ${displayName}`} description="Here's what's happening today" actions={<OrgHeader />} />

      {/* Row 1: 6 key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <MetricCard icon={Leaf} label="Active Plants" value={stats.activePlants} color="emerald" onClick={() => navigate("/cultivation/plants")} />
        <MetricCard icon={Flower2} label="In Flower" value={stats.inFlower} color="purple" onClick={() => navigate("/cultivation/plants?phase=flowering")} />
        <MetricCard icon={Scissors} label="Upcoming Harvests" value={stats.upcomingHarvests} color="amber" onClick={() => navigate("/cultivation/harvests")} helper="next 7 days" />
        <MetricCard icon={Package} label="Available Inventory" value={`${(stats.availableWeightGrams / 1000).toFixed(1)}kg`} color="teal" onClick={() => navigate("/inventory/batches?available=true")} />
        <MetricCard icon={ShoppingCart} label="Open Orders" value={stats.openOrders} color="blue" onClick={() => navigate("/sales/orders")} />
        <MetricCard
          icon={stats.ccrsPendingCategories === 0 ? ShieldCheck : AlertTriangle}
          label="CCRS Status"
          value={stats.ccrsPendingCategories === 0 ? "Up to date" : `${stats.ccrsPendingCategories} pending`}
          color={stats.ccrsPendingCategories === 0 ? "emerald" : "amber"}
          onClick={() => navigate("/compliance/ccrs")}
        />
      </div>
      <span className="hidden">{ccrsColor}</span>

      {/* Row 2: Tasks + Harvests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PanelCard title="Today's Tasks" count={tasks.length} linkLabel="View All Tasks →" linkTo="/operations/tasks">
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              <p className="text-[13px] font-semibold">No tasks for today.</p>
              <p className="text-[11px] text-muted-foreground">Nice work!</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <button onClick={async () => { try { await completeTask(t.id); refreshTasks(); } catch {} }} className="w-4 h-4 rounded-full border border-border hover:bg-accent transition-colors shrink-0" />
                  <PriorityDot priority={t.priority} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate">{t.title}</div>
                    {t.area_id && <div className="text-[10px] text-muted-foreground">Context</div>}
                  </div>
                  {t.scheduled_end && <DateTime value={t.scheduled_end} format="date-only" className="text-[10px] text-muted-foreground" />}
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard title="Upcoming Harvests" count={harvests.length} linkLabel="View Grow Board →" linkTo="/cultivation/board">
          {harvests.length === 0 ? (
            <div className="text-center py-8 text-[12px] text-muted-foreground">No harvests scheduled within 7 days</div>
          ) : (
            <ul className="space-y-1">
              {harvests.map((h) => {
                const days = h.target_harvest_date ? Math.ceil((new Date(h.target_harvest_date).getTime() - Date.now()) / 86400000) : null;
                return (
                  <li key={h.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center text-[11px] font-bold font-mono">
                      {days != null ? (days < 0 ? "!" : days) : "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => navigate(`/cultivation/cycles/${h.id}`)} className="text-[12px] font-medium text-primary hover:underline truncate text-left block max-w-full">{h.name}</button>
                      <div className="text-[10px] text-muted-foreground">{h.strain?.name ?? "—"} · {h.area?.name ?? "—"} · {h.plant_count ?? 0} plants</div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{days != null ? `${days}d` : ""}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelCard>
      </div>

      {/* Row 3: Alerts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PanelCard title="Environmental Alerts" count={alerts.length} linkLabel="View Areas →" linkTo="/cultivation/areas">
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              <p className="text-[12px] text-muted-foreground">No active alerts</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <AlertTriangle className={cn("w-4 h-4", a.severity === "critical" ? "text-destructive" : a.severity === "warning" ? "text-amber-500" : "text-muted-foreground")} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate">{a.area?.name ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{a.alert_type ?? "—"}</div>
                  </div>
                  <DateTime value={a.created_at} className="text-[10px] text-muted-foreground" />
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard title="Recent Activity" count={activity.length} linkLabel="View Audit Log →" linkTo="/compliance/audit">
          {activity.length === 0 ? (
            <div className="text-center py-8 text-[12px] text-muted-foreground italic">No activity recorded yet</div>
          ) : (
            <ul className="space-y-1">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0 text-[12px]">
                    <span className="text-muted-foreground">{a.user_email ?? "system"}</span>{" "}
                    <span className="font-medium">{a.action.replace(/_/g, " ")}</span>{" "}
                    <span className="text-muted-foreground">{a.entity_type}</span>{" "}
                    {a.entity_name && <span className="font-medium truncate">{a.entity_name}</span>}
                  </div>
                  <DateTime value={a.created_at} className="text-[10px] text-muted-foreground shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      {/* Row 4: AI Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <DemandForecastCard daysAhead={30} />
        <CodyInsightsPanel />
      </div>
    </div>
  );
}

const COLOR_CLASS: Record<string, string> = {
  emerald: "stat-accent-emerald",
  purple: "stat-accent-blue",
  amber: "stat-accent-amber",
  teal: "stat-accent-teal",
  blue: "stat-accent-blue",
};

function MetricCard({ icon: Icon, label, value, color, onClick, helper }: { icon: any; label: string; value: number | string; color: string; onClick?: () => void; helper?: string }) {
  return (
    <button onClick={onClick} className={cn("text-left rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm", COLOR_CLASS[color] ?? "stat-accent-blue")}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="text-[22px] font-bold font-mono tabular-nums">{value}</div>
      {helper && <div className="text-[10px] text-muted-foreground mt-1">{helper}</div>}
    </button>
  );
}

function PanelCard({ title, count, linkLabel, linkTo, children }: { title: string; count: number; linkLabel: string; linkTo: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">{title}{count > 0 && <span className="ml-2 text-[11px] text-muted-foreground font-normal">({count})</span>}</h3>
        <button onClick={() => navigate(linkTo)} className="text-[11px] text-primary hover:underline flex items-center gap-1">{linkLabel}</button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function PriorityDot({ priority }: { priority: string | null }) {
  const color = priority === "urgent" ? "bg-red-500" : priority === "high" ? "bg-amber-500" : priority === "medium" ? "bg-blue-500" : "bg-muted-foreground/40";
  return <span className={cn("w-2 h-2 rounded-full shrink-0", color)} />;
}

void CalendarDays; void ArrowRight;
