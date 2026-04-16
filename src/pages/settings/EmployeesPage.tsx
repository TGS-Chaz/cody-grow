import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Users,
  UserCheck,
  LogIn,
  AlertTriangle,
  Plus,
  MoreHorizontal,
  Edit,
  Eye,
  Archive,
  Clock,
  Link2,
  Download,
  UserX,
  Crown,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import FiltersBar, { FilterChip } from "@/components/shared/FiltersBar";
import StatusPill from "@/components/shared/StatusPill";
import CopyableId from "@/components/shared/CopyableId";
import DateTime from "@/components/shared/DateTime";
import UserAvatar from "@/components/shared/UserAvatar";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useEmployees,
  useEmployeeStats,
  DEPARTMENT_COLORS,
  Employee,
  Department,
  EmployeeInput,
  EmploymentStatus,
} from "@/hooks/useEmployees";
import { useFacilities } from "@/hooks/useFacilities";
import EmployeeFormModal from "./EmployeeFormModal";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<EmploymentStatus, { variant: "success" | "warning" | "muted" | "info"; label: string }> = {
  active:     { variant: "success", label: "Active" },
  on_leave:   { variant: "warning", label: "On Leave" },
  terminated: { variant: "muted", label: "Terminated" },
  seasonal:   { variant: "info", label: "Seasonal" },
  contractor: { variant: "info", label: "Contractor" },
};

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: employees, loading, createEmployee, updateEmployee } = useEmployees();
  const { data: facilities } = useFacilities();
  const stats = useEmployeeStats(employees);
  const [searchValue, setSearchValue] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "">("");
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | "">("");
  const [facilityFilter, setFacilityFilter] = useState<string>("");
  const [hasSystemFilter, setHasSystemFilter] = useState<"yes" | "no" | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const { setContext, clearContext } = useCodyContext();

  // Open modal if ?new=1 in URL (from CommandBar)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing(null);
      setModalOpen(true);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    setContext({
      context_type: "employees_list",
      page_data: {
        counts: stats,
        employees: employees.map((e) => ({
          name: `${e.first_name} ${e.last_name}`,
          department: e.department,
          status: e.employment_status,
          job_title: e.job_title,
          hasSystemAccess: !!e.user_id,
          facility: e.facility?.name,
        })),
      },
    });
    return () => clearContext();
  }, [setContext, clearContext, employees, stats]);

  useShortcut(["n"], () => { setEditing(null); setModalOpen(true); }, {
    description: "Add new employee",
    scope: "Employees",
    enabled: !modalOpen,
  });
  useShortcut(["/"], () => {
    document.querySelector<HTMLInputElement>("[data-filters-search]")?.focus();
  }, { description: "Focus search", scope: "Employees", enabled: !modalOpen });

  const takenUserIds = useMemo(() => employees.filter((e) => e.user_id).map((e) => e.user_id!), [employees]);

  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return employees.filter((e) => {
      if (q) {
        const hay = `${e.first_name} ${e.last_name} ${e.preferred_name ?? ""} ${e.email ?? ""} ${e.employee_number ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (deptFilter && e.department !== deptFilter) return false;
      if (statusFilter && e.employment_status !== statusFilter) return false;
      if (facilityFilter && e.facility_id !== facilityFilter) return false;
      if (hasSystemFilter === "yes" && !e.user_id) return false;
      if (hasSystemFilter === "no" && e.user_id) return false;
      return true;
    });
  }, [employees, searchValue, deptFilter, statusFilter, facilityFilter, hasSystemFilter]);

  const activeChips: FilterChip[] = useMemo(() => {
    const chips: FilterChip[] = [];
    if (deptFilter) chips.push({ key: "dept", label: "Dept", value: DEPARTMENT_COLORS[deptFilter].label, onRemove: () => setDeptFilter("") });
    if (statusFilter) chips.push({ key: "status", label: "Status", value: STATUS_VARIANT[statusFilter].label, onRemove: () => setStatusFilter("") });
    if (facilityFilter) {
      const f = facilities.find((x) => x.id === facilityFilter);
      chips.push({ key: "fac", label: "Facility", value: f?.name ?? "—", onRemove: () => setFacilityFilter("") });
    }
    if (hasSystemFilter) chips.push({ key: "sys", label: "System Access", value: hasSystemFilter === "yes" ? "Yes" : "No", onRemove: () => setHasSystemFilter("") });
    return chips;
  }, [deptFilter, statusFilter, facilityFilter, hasSystemFilter, facilities]);

  const clearAll = () => { setDeptFilter(""); setStatusFilter(""); setFacilityFilter(""); setHasSystemFilter(""); };

  const columns: ColumnDef<Employee>[] = useMemo(() => [
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => {
        const e = row.original;
        const initials = (e.first_name?.[0] ?? "") + (e.last_name?.[0] ?? "");
        const display = `${e.first_name} ${e.last_name}`;
        return (
          <div className="flex items-center gap-2.5">
            <UserAvatar avatarUrl={e.avatar_url} initials={initials || "E"} size={28} animated={false} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground truncate flex items-center gap-1.5">
                {display}
                {e.preferred_name && (
                  <span className="text-muted-foreground text-[11px] font-normal">({e.preferred_name})</span>
                )}
                {e.employment_status === "active" && e.department === "management" && (
                  <Crown className="w-3 h-3 text-amber-500" />
                )}
              </div>
              {e.job_title && <div className="text-[11px] text-muted-foreground truncate">{e.job_title}</div>}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "employee_number",
      header: "Employee #",
      cell: ({ row }) => row.original.employee_number
        ? <CopyableId value={row.original.employee_number} />
        : <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "department",
      header: "Department",
      cell: ({ row }) => {
        const d = row.original.department;
        if (!d) return <span className="text-muted-foreground">—</span>;
        const cfg = DEPARTMENT_COLORS[d];
        return (
          <span className={cn("inline-flex items-center gap-1.5 h-5 px-2.5 rounded-full text-[11px] font-medium", cfg.bg, cfg.text)}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.hex }} />
            {cfg.label}
          </span>
        );
      },
    },
    {
      id: "facility",
      header: "Facility",
      cell: ({ row }) => {
        const f = row.original.facility;
        if (!f) return <span className="text-muted-foreground text-[12px]">—</span>;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/settings/facilities/${f.id}`); }}
            className="text-[12px] text-primary hover:underline truncate"
          >
            {f.name}
          </button>
        );
      },
    },
    {
      accessorKey: "employment_status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.employment_status;
        const cfg = STATUS_VARIANT[s];
        return <StatusPill label={cfg.label} variant={cfg.variant} />;
      },
    },
    {
      accessorKey: "hire_date",
      header: "Hired",
      cell: ({ row }) => (
        row.original.hire_date
          ? <DateTime value={row.original.hire_date} format="date-only" className="text-[12px] text-muted-foreground" />
          : <span className="text-muted-foreground text-[12px]">—</span>
      ),
    },
    {
      id: "system_access",
      header: "Access",
      cell: ({ row }) => (
        row.original.user_id ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-primary">
                <LogIn className="w-3.5 h-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Has Cody Grow login</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-muted-foreground/50">
                <UserX className="w-3.5 h-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>No system access</TooltipContent>
          </Tooltip>
        )
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-accent">
                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/settings/employees/${row.original.id}`)}>
                <Eye className="w-3.5 h-3.5" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setEditing(row.original); setModalOpen(true); }}>
                <Edit className="w-3.5 h-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Clock className="w-3.5 h-3.5" /> Clock-in History
              </DropdownMenuItem>
              {!row.original.user_id && (
                <DropdownMenuItem onClick={() => { setEditing(row.original); setModalOpen(true); }}>
                  <Link2 className="w-3.5 h-3.5" /> Link to System User
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  if (confirm(`Archive ${row.original.first_name} ${row.original.last_name}?`)) {
                    await updateEmployee(row.original.id, { employment_status: "terminated" });
                  }
                }}
                className="text-destructive"
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
  ], [navigate, updateEmployee]);

  const handleSave = async (input: EmployeeInput) => {
    if (editing) await updateEmployee(editing.id, input);
    else await createEmployee(input);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Employees"
        description="People who work at your facility — with or without system access"
        breadcrumbs={[{ label: "Settings", to: "/settings" }, { label: "Employees" }]}
        actions={
          <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Employee
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Employees" value={stats.total} accentClass="stat-accent-blue" delay={0} />
        <StatCard label="Active" value={stats.active} accentClass="stat-accent-emerald" delay={0.05} />
        <StatCard label="System Users" value={stats.systemUsers} accentClass="stat-accent-teal" delay={0.1} />
        <StatCard
          label="License Expiring"
          value={stats.licenseExpiring}
          accentClass={stats.licenseExpiring > 0 ? "stat-accent-amber" : "stat-accent-emerald"}
          delay={0.15}
        />
      </div>

      <FiltersBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search name, email, or employee #…"
        activeChips={activeChips}
        onClearAll={activeChips.length > 0 ? clearAll : undefined}
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter((e.target.value as Department) || "")}
              className="h-9 px-3 text-[12px] rounded-md bg-background border border-border"
            >
              <option value="">All departments</option>
              {Object.entries(DEPARTMENT_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter((e.target.value as EmploymentStatus) || "")}
              className="h-9 px-3 text-[12px] rounded-md bg-background border border-border"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_VARIANT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select
              value={facilityFilter}
              onChange={(e) => setFacilityFilter(e.target.value)}
              className="h-9 px-3 text-[12px] rounded-md bg-background border border-border"
            >
              <option value="">All facilities</option>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select
              value={hasSystemFilter}
              onChange={(e) => setHasSystemFilter(e.target.value as "yes" | "no" | "")}
              className="h-9 px-3 text-[12px] rounded-md bg-background border border-border"
            >
              <option value="">Any access</option>
              <option value="yes">Has Login</option>
              <option value="no">No Login</option>
            </select>
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <Download className="w-3.5 h-3.5" /> Import CSV
            </Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        onRowClick={(e) => navigate(`/settings/employees/${e.id}`)}
        empty={{
          icon: Users,
          title: "Add your first employee",
          description: "Track everyone who works at your facility — from growers to drivers. Required for CCRS manifests, compliance audits, and task assignments.",
          action: (
            <div className="flex items-center gap-2">
              <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add First Employee
              </Button>
              <Button variant="outline" disabled className="gap-1.5">
                Import from CSV
              </Button>
            </div>
          ),
        }}
      />

      <EmployeeFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        editing={editing}
        onSave={handleSave}
        takenUserIds={takenUserIds}
      />
    </div>
  );
}

void UserCheck; void AlertTriangle;
