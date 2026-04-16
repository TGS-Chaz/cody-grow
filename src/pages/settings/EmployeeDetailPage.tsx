import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  MoreHorizontal,
  Clock,
  Archive,
  Link2,
  Unlink,
  User,
  Phone,
  Mail,
  ShieldAlert,
  Calendar,
  Loader2,
  CheckCircle2,
  LogIn,
  UserX,
  FileText,
  BookOpen,
  AlertTriangle,
  Activity,
  Users as UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import StatusPill from "@/components/shared/StatusPill";
import CopyableId from "@/components/shared/CopyableId";
import DateTime from "@/components/shared/DateTime";
import UserAvatar from "@/components/shared/UserAvatar";
import EmptyState from "@/components/shared/EmptyState";
import CodyInsightsPanel from "@/components/cody/CodyInsightsPanel";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useEmployee,
  useEmployees,
  useEmployeeTasks,
  useEmployeeTrainingRecords,
  useEmployeeTimeEntries,
  DEPARTMENT_COLORS,
} from "@/hooks/useEmployees";
import EmployeeFormModal from "./EmployeeFormModal";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  active:     { variant: "success" as const, label: "Active" },
  on_leave:   { variant: "warning" as const, label: "On Leave" },
  terminated: { variant: "muted" as const, label: "Terminated" },
  seasonal:   { variant: "info" as const, label: "Seasonal" },
  contractor: { variant: "info" as const, label: "Contractor" },
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: employee, loading, refresh } = useEmployee(id);
  const { updateEmployee, terminateEmployee, data: allEmployees } = useEmployees();
  const [editOpen, setEditOpen] = useState(false);
  const { setContext, clearContext } = useCodyContext();

  const { data: timeEntries } = useEmployeeTimeEntries(employee?.id);
  const { data: tasks } = useEmployeeTasks(employee?.id);
  const { data: training } = useEmployeeTrainingRecords(employee?.id);

  // Weekly hours (this week)
  const weeklyHours = useMemo(() => {
    const now = Date.now();
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    let total = 0;
    for (const t of timeEntries) {
      if (!t.clock_in_at) continue;
      const inAt = new Date(t.clock_in_at).getTime();
      if (inAt < weekStart) continue;
      const outAt = t.clock_out_at ? new Date(t.clock_out_at).getTime() : now;
      total += (outAt - inAt) / 3600000;
    }
    return Math.round(total * 10) / 10;
  }, [timeEntries]);

  const tasksByStatus = useMemo(() => {
    const map = { pending: [] as any[], in_progress: [] as any[], completed: [] as any[], other: [] as any[] };
    for (const t of tasks) {
      if (t.status === "pending") map.pending.push(t);
      else if (t.status === "in_progress") map.in_progress.push(t);
      else if (t.status === "completed") map.completed.push(t);
      else map.other.push(t);
    }
    return map;
  }, [tasks]);

  const licenseExpiringSoon = useMemo(() => {
    if (!employee?.wa_drivers_license_expires) return false;
    const t = new Date(employee.wa_drivers_license_expires).getTime();
    return t - Date.now() < 30 * 24 * 60 * 60 * 1000 && t > Date.now();
  }, [employee]);

  const takenUserIds = useMemo(() => allEmployees.filter((e) => e.user_id).map((e) => e.user_id!), [allEmployees]);

  // Stabilize Cody context payload with primitive deps so the setContext effect
  // doesn't fire on every render (which would cascade through the provider).
  const employeeId = employee?.id ?? null;
  const employeeSignature = employee
    ? `${employee.updated_at}|${employee.user_id ?? ""}|${employee.employment_status}`
    : "";
  const pendingCount = tasksByStatus.pending.length;
  const inProgressCount = tasksByStatus.in_progress.length;
  const completedCount = tasksByStatus.completed.length;
  const trainingCount = training.length;

  const codyPayload = useMemo(() => {
    if (!employee) return null;
    return {
      employee: {
        name: `${employee.first_name} ${employee.last_name}`,
        department: employee.department,
        job_title: employee.job_title,
        status: employee.employment_status,
        has_system_access: !!employee.user_id,
        facility: employee.facility?.name,
        hire_date: employee.hire_date,
      },
      weekly_hours: weeklyHours,
      tasks_pending: pendingCount,
      tasks_in_progress: inProgressCount,
      tasks_completed: completedCount,
      training_count: trainingCount,
      license_expiring: licenseExpiringSoon,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, employeeSignature, weeklyHours, pendingCount, inProgressCount, completedCount, trainingCount, licenseExpiringSoon]);

  useEffect(() => {
    if (!codyPayload) return;
    setContext({ context_type: "employee_detail", context_id: employeeId, page_data: codyPayload });
    return () => clearContext();
  }, [setContext, clearContext, codyPayload, employeeId]);

  useShortcut(["e"], () => setEditOpen(true), {
    description: "Edit employee",
    scope: "Employee",
    enabled: !!employee && !editOpen,
  });
  useShortcut(["c"], () => {
    toast("Clock in/out requires the time-tracker Edge Function (coming soon).");
  }, {
    description: "Clock in/out",
    scope: "Employee",
    enabled: !!employee?.user_id && !editOpen,
  });

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <EmptyState
          icon={UsersIcon}
          title="Employee not found"
          description="This record may have been archived or does not exist."
          primaryAction={<Button onClick={() => navigate("/settings/employees")}>← Back to employees</Button>}
        />
      </div>
    );
  }

  const initials = (employee.first_name?.[0] ?? "") + (employee.last_name?.[0] ?? "");
  const displayName = `${employee.first_name} ${employee.last_name}`;
  const deptCfg = employee.department ? DEPARTMENT_COLORS[employee.department] : null;
  const statusCfg = STATUS_CONFIG[employee.employment_status];

  const tenure = employee.hire_date
    ? (() => {
        const ms = Date.now() - new Date(employee.hire_date).getTime();
        const years = Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25));
        const months = Math.floor((ms / (1000 * 60 * 60 * 24 * 30.4)) % 12);
        if (years >= 1) return `${years}y ${months}m`;
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        if (days >= 30) return `${months} mo`;
        return `${days} days`;
      })()
    : "—";

  const handleTerminate = async () => {
    if (!confirm(`Terminate ${displayName}? This will set status to Terminated and record today's date.`)) return;
    try {
      await terminateEmployee(employee.id);
      toast.success("Employee terminated");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={displayName}
        description={
          employee.job_title && deptCfg
            ? `${employee.job_title} · ${deptCfg.label}`
            : employee.job_title ?? deptCfg?.label ?? "Employee"
        }
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Employees", to: "/settings/employees" },
          { label: displayName },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/settings/employees")} className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
            {employee.user_id && (
              <Button
                size="sm"
                onClick={() => toast("Clock in/out requires the time-tracker Edge Function (coming soon).")}
                className="gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Clock className="w-3.5 h-3.5" /> Clock In
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Edit className="w-3.5 h-3.5" /> Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!employee.user_id && (
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Link2 className="w-3.5 h-3.5" /> Link System User
                  </DropdownMenuItem>
                )}
                {employee.user_id && (
                  <DropdownMenuItem onClick={async () => { await updateEmployee(employee.id, { user_id: null }); refresh(); toast.success("Unlinked"); }}>
                    <Unlink className="w-3.5 h-3.5" /> Unlink System User
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {employee.employment_status !== "terminated" && (
                  <DropdownMenuItem onClick={handleTerminate} className="text-destructive">
                    <Archive className="w-3.5 h-3.5" /> Terminate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Hero */}
      <div className="flex items-start gap-5 mb-6 rounded-xl border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px var(--shadow-color)" }}>
        <UserAvatar avatarUrl={employee.avatar_url} initials={initials || "E"} size={80} animated={false} />
        <div className="flex-1 min-w-0">
          <h2 className="text-[20px] font-bold text-foreground leading-tight">
            {displayName}
            {employee.preferred_name && <span className="text-muted-foreground font-normal text-[14px] ml-2">({employee.preferred_name})</span>}
          </h2>
          {employee.job_title && <p className="text-[13px] text-muted-foreground mt-0.5">{employee.job_title}</p>}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {deptCfg && (
              <span className={cn("inline-flex items-center gap-1.5 h-5 px-2.5 rounded-full text-[11px] font-medium", deptCfg.bg, deptCfg.text)}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: deptCfg.hex }} />
                {deptCfg.label}
              </span>
            )}
            <StatusPill label={statusCfg.label} variant={statusCfg.variant} />
            {employee.user_id ? (
              <span className="inline-flex items-center gap-1.5 h-5 px-2.5 rounded-full bg-primary/15 text-primary text-[11px] font-medium">
                <LogIn className="w-3 h-3" /> System Access
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 h-5 px-2.5 rounded-full bg-gray-500/15 text-gray-500 text-[11px] font-medium">
                <UserX className="w-3 h-3" /> No System Access
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Key info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KeyInfo label="Employee #" value={employee.employee_number ? <CopyableId value={employee.employee_number} /> : "—"} />
        <KeyInfo label="Tenure" value={tenure} hint={employee.hire_date ? <DateTime value={employee.hire_date} format="date-only" className="text-[11px] text-muted-foreground" /> : null} />
        <KeyInfo
          label="Facility"
          value={
            employee.facility
              ? <button onClick={() => navigate(`/settings/facilities/${employee.facility!.id}`)} className="text-primary hover:underline">{employee.facility.name}</button>
              : "—"
          }
        />
        <KeyInfo
          label="System Access"
          value={
            employee.user_id
              ? <button onClick={() => navigate("/settings/users")} className="text-primary hover:underline">View on Users</button>
              : <span className="text-muted-foreground">None</span>
          }
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="time">Time & Attendance</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="training">Training & SOPs</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Contact
              </h3>
              <div className="space-y-2 text-[13px]">
                <InfoRow icon={Mail} label="Email" value={employee.email ?? "—"} />
                <InfoRow icon={Phone} label="Phone" value={employee.phone ?? "—"} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Emergency Contact
              </h3>
              <div className="space-y-2 text-[13px]">
                <InfoRow icon={User} label="Name" value={employee.emergency_contact_name ?? "—"} />
                <InfoRow icon={Phone} label="Phone" value={employee.emergency_contact_phone ?? "—"} />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Compliance
              </h3>
              <div className="space-y-2 text-[13px]">
                <InfoRow icon={Calendar} label="Birthdate" value={employee.birthdate ? <DateTime value={employee.birthdate} format="date-only" /> : "—"} />
                <InfoRow icon={Calendar} label="Driver's License" value={employee.wa_drivers_license ?? "—"} />
                <InfoRow
                  icon={Calendar}
                  label="License Expires"
                  value={employee.wa_drivers_license_expires
                    ? <span className={cn("inline-flex items-center gap-1", licenseExpiringSoon && "text-amber-500")}>
                        {licenseExpiringSoon && <AlertTriangle className="w-3 h-3" />}
                        <DateTime value={employee.wa_drivers_license_expires} format="date-only" />
                      </span>
                    : "—"}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-[13px] font-semibold text-foreground mb-3">Recent Activity</h3>
              <p className="text-[12px] text-muted-foreground">Activity feed will appear here once the employee logs actions in the system.</p>
            </div>
            <CodyInsightsPanel entity_type="employee" entity_id={employee.id} limit={4} />
          </div>
        </TabsContent>

        <TabsContent value="time">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <StatCard label="Hours This Week" value={weeklyHours} accentClass="stat-accent-emerald" />
            <StatCard label="Tasks Completed" value={tasksByStatus.completed.length} accentClass="stat-accent-teal" />
            <StatCard label="Entries (30d)" value={timeEntries.length} accentClass="stat-accent-blue" />
          </div>
          {timeEntries.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No time entries yet"
              description="Clock-ins and time tracking will appear here once the employee uses the system or kiosk."
              primaryAction={<Button disabled>Clock In Now</Button>}
            />
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
              {timeEntries.slice(0, 20).map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 text-[13px]">
                  <div className="flex items-center gap-3">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <DateTime value={t.clock_in_at} />
                    {t.task_type && <span className="text-[11px] text-muted-foreground">· {t.task_type}</span>}
                  </div>
                  <span className="text-[12px] text-muted-foreground tabular-nums">
                    {t.clock_out_at ? `${Math.round(((new Date(t.clock_out_at).getTime() - new Date(t.clock_in_at).getTime()) / 3600000) * 10) / 10}h` : "In progress"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          {tasks.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No tasks assigned" description="Assign tasks to this employee from grow cycles, harvests, or production runs." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TaskColumn title="Pending" items={tasksByStatus.pending} accent="stat-accent-amber" />
              <TaskColumn title="In Progress" items={tasksByStatus.in_progress} accent="stat-accent-blue" />
              <TaskColumn title="Completed" items={tasksByStatus.completed} accent="stat-accent-emerald" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="training">
          {training.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No training records yet"
              description="Record SOP training, certifications, and onboarding completion for compliance."
              primaryAction={<Button disabled>Schedule Training</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {training.map((t) => (
                <div key={t.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[13px] font-semibold text-foreground truncate">{t.sop?.title ?? t.training_type ?? "Training"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Completed <DateTime value={t.completed_at} format="date-only" />
                    {t.expires_at && <> · Expires <DateTime value={t.expires_at} format="date-only" /></>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="compliance">
          <EmptyState
            icon={FileText}
            title="No compliance documents uploaded"
            description="Upload license photos, background checks, I-9s, and other compliance docs tied to this employee."
            primaryAction={<Button disabled>Upload Document</Button>}
          />
        </TabsContent>

        <TabsContent value="activity">
          <EmptyState
            icon={Activity}
            title="No audit log entries"
            description="System actions taken by this employee will appear here — for WSLCB audits and internal accountability."
          />
        </TabsContent>
      </Tabs>

      <EmployeeFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editing={employee}
        onSave={async (input) => { await updateEmployee(employee.id, input); refresh(); }}
        takenUserIds={takenUserIds}
      />
    </div>
  );
}

function KeyInfo({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <div className="text-[14px] font-medium text-foreground">{value}</div>
      {hint && <div className="mt-0.5">{hint}</div>}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground w-24 shrink-0">{label}:</span>
      <span className="text-foreground truncate">{value}</span>
    </div>
  );
}

function TaskColumn({ title, items, accent }: { title: string; items: any[]; accent: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-3", accent)}>
      <div className="flex items-center justify-between px-1 mb-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        <span className="text-[11px] font-mono text-foreground tabular-nums">{items.length}</span>
      </div>
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-4">None</p>
        ) : (
          items.slice(0, 20).map((t) => (
            <div key={t.id} className="rounded-md border border-border bg-background p-2.5 text-[12px]">
              <div className="font-medium text-foreground">{t.title}</div>
              {t.scheduled_start && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  <DateTime value={t.scheduled_start} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
