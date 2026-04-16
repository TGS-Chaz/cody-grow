import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Users,
  Crown,
  UserCheck,
  MailQuestion,
  Shield,
  Sparkles,
  Lock,
  Mail,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Plus,
  Check,
  Minus,
  XCircle,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import EmptyState from "@/components/shared/EmptyState";
import StatusPill from "@/components/shared/StatusPill";
import CopyableId from "@/components/shared/CopyableId";
import DateTime from "@/components/shared/DateTime";
import UserAvatar from "@/components/shared/UserAvatar";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import { OrgMember, useOrgMembers, useOrgUserRoles, useMembersStats } from "@/hooks/useUsers";
import { Role, useRoles, useRoleMemberCounts } from "@/hooks/useRoles";
import { useAllPermissions, usePermissionMatrix, groupByCategory, CATEGORY_COLORS, CATEGORY_ORDER } from "@/hooks/usePermissions";
import { useEmployees } from "@/hooks/useEmployees";
import InviteMemberModal from "./InviteMemberModal";
import EditMemberModal from "./EditMemberModal";
import RoleFormModal from "./RoleFormModal";
import { cn } from "@/lib/utils";

type TabKey = "members" | "roles" | "matrix";

export default function UsersRolesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey) ?? "members";

  const setActiveTab = (t: TabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  // Tab switch shortcuts
  useShortcut(["1"], () => setActiveTab("members"), { description: "Switch to Team Members tab", scope: "Users & Roles" });
  useShortcut(["2"], () => setActiveTab("roles"), { description: "Switch to Roles tab", scope: "Users & Roles" });
  useShortcut(["3"], () => setActiveTab("matrix"), { description: "Switch to Permissions Matrix tab", scope: "Users & Roles" });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Users & Roles"
        description="Manage who has access to Cody Grow and what they can do"
        breadcrumbs={[{ label: "Settings", to: "/settings" }, { label: "Users & Roles" }]}
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="matrix">Permissions Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="members"><MembersTab active={activeTab === "members"} /></TabsContent>
        <TabsContent value="roles"><RolesTab active={activeTab === "roles"} /></TabsContent>
        <TabsContent value="matrix"><MatrixTab active={activeTab === "matrix"} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab 1: Team Members ──────────────────────────────────────────────────────

function MembersTab({ active }: { active: boolean }) {
  const navigate = useNavigate();
  const { data: members, loading } = useOrgMembers();
  const { data: userRoles } = useOrgUserRoles();
  const { data: roles } = useRoles();
  const { data: employees } = useEmployees();
  const stats = useMembersStats(members);

  // Map user_id → linked employee (for cross-linking)
  const employeeByUserId = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const e of employees) {
      if (e.user_id) map.set(e.user_id, { id: e.id, name: `${e.first_name} ${e.last_name}` });
    }
    return map;
  }, [employees]);
  const [searchValue, setSearchValue] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OrgMember | null>(null);
  const { setContext, clearContext } = useCodyContext();

  const membersSignature = useMemo(() => members.map((m) => m.user_id).join(","), [members]);
  const membersPayload = useMemo(
    () => ({
      count: stats.total,
      owners: stats.owners,
      recentlyActive: stats.recentlyActive,
      members: members.map((m) => ({
        email: m.email,
        name: m.full_name ?? `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim(),
        role: m.role,
        lastSignIn: m.last_sign_in_at,
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [membersSignature, stats.total, stats.owners, stats.recentlyActive],
  );

  useEffect(() => {
    if (!active) return;
    setContext({ context_type: "team_members_list", page_data: membersPayload });
    return () => clearContext();
  }, [active, setContext, clearContext, membersPayload]);

  useShortcut(["n"], () => setInviteOpen(true), {
    description: "Invite new member",
    scope: "Team Members",
    enabled: active && !inviteOpen && !editTarget,
  });
  useShortcut(["/"], () => {
    const el = document.querySelector<HTMLInputElement>("[data-filters-search]");
    el?.focus();
  }, { description: "Focus search", scope: "Team Members", enabled: active && !inviteOpen && !editTarget });

  // Map user_id → role names
  const rolesByUser = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const r of userRoles) {
      if (!map.has(r.user_id)) map.set(r.user_id, []);
      map.get(r.user_id)!.push({ id: r.role_id, name: r.role_name });
    }
    return map;
  }, [userRoles]);

  const roleIdsByUser = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of userRoles) {
      if (!map.has(r.user_id)) map.set(r.user_id, []);
      map.get(r.user_id)!.push(r.role_id);
    }
    return map;
  }, [userRoles]);

  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      (m.email ?? "").toLowerCase().includes(q) ||
      (m.full_name ?? "").toLowerCase().includes(q) ||
      (m.first_name ?? "").toLowerCase().includes(q) ||
      (m.last_name ?? "").toLowerCase().includes(q),
    );
  }, [members, searchValue]);

  const columns: ColumnDef<OrgMember>[] = useMemo(() => [
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => {
        const m = row.original;
        const initials = (m.first_name?.[0] ?? "") + (m.last_name?.[0] ?? "") || (m.email?.[0]?.toUpperCase() ?? "U");
        const displayName = (m.full_name ?? `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim()) || m.email?.split("@")[0] || "—";
        const linkedEmp = employeeByUserId.get(m.user_id);
        return (
          <div className="flex items-center gap-2.5">
            <UserAvatar avatarUrl={m.avatar_url} initials={initials} size={28} animated={false} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground truncate flex items-center gap-1.5">
                {displayName}
                {m.role === "owner" && <Crown className="w-3 h-3 text-amber-500 fill-amber-500" />}
              </div>
              {linkedEmp && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/settings/employees/${linkedEmp.id}`); }}
                  className="text-[10px] text-primary/80 hover:text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  Linked: {linkedEmp.name}
                </button>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email ? <CopyableId value={row.original.email} /> : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "roles",
      header: "Roles",
      cell: ({ row }) => {
        const assigned = rolesByUser.get(row.original.user_id) ?? [];
        if (assigned.length === 0) {
          return <span className="text-[11px] text-muted-foreground italic">No roles assigned</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {assigned.map((r) => (
              <span key={r.id} className="inline-flex items-center h-5 px-2 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
                {r.name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "last_sign_in_at",
      header: "Last Active",
      cell: ({ row }) => <DateTime value={row.original.last_sign_in_at} className="text-[12px] text-muted-foreground" />,
    },
    {
      id: "mfa",
      header: "MFA",
      cell: () => <StatusPill label="Unknown" variant="muted" />,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusPill label={row.original.role === "owner" ? "Owner" : "Active"} variant={row.original.role === "owner" ? "warning" : "success"} />,
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
              <DropdownMenuItem onClick={() => setEditTarget(row.original)}>
                <Edit className="w-3.5 h-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Mail className="w-3.5 h-3.5" /> Reset Password
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                View Activity
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setEditTarget(row.original)}>
                <Trash2 className="w-3.5 h-3.5" /> Remove from Org
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
  ], [rolesByUser, employeeByUserId, navigate]);

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Members" value={stats.total} accentClass="stat-accent-blue" delay={0} />
        <StatCard label="Owners" value={stats.owners} accentClass="stat-accent-amber" delay={0.05} />
        <StatCard label="Active (30d)" value={stats.recentlyActive} accentClass="stat-accent-emerald" delay={0.1} />
        <StatCard label="Pending Invites" value={stats.pendingInvites} accentClass="stat-accent-teal" delay={0.15} />
      </div>

      <FiltersBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search name or email…"
        actions={
          <Button onClick={() => setInviteOpen(true)} className="gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Invite Member
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        empty={{
          icon: Users,
          title: "Invite your team",
          description: "Cody Grow is built for teams. Invite growers, processors, and managers to collaborate.",
          action: (
            <Button onClick={() => setInviteOpen(true)} className="gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Invite First Member
            </Button>
          ),
        }}
      />

      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} roles={roles} />
      <EditMemberModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        member={editTarget}
        allRoles={roles}
        assignedRoleIds={editTarget ? (roleIdsByUser.get(editTarget.user_id) ?? []) : []}
      />
    </div>
  );
}

// ─── Tab 2: Roles ─────────────────────────────────────────────────────────────

function RolesTab({ active }: { active: boolean }) {
  const { data: roles, loading, createRole, updateRole, deleteRole } = useRoles();
  const memberCounts = useRoleMemberCounts();
  const { data: permissions } = useAllPermissions();
  const { matrix } = usePermissionMatrix(roles.map((r) => r.id));
  const { setContext, clearContext } = useCodyContext();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  const rolesSignature = useMemo(() => roles.map((r) => r.id).join(","), [roles]);
  const memberCountsSig = useMemo(() => Object.entries(memberCounts).map(([k, v]) => `${k}:${v}`).join(","), [memberCounts]);
  const matrixSig = useMemo(
    () => Object.entries(matrix).map(([k, v]) => `${k}:${v.size}`).join(","),
    [matrix],
  );
  const rolesPayload = useMemo(
    () => ({
      roles: roles.map((r) => ({
        name: r.name,
        is_system: r.is_system_role,
        description: r.description,
        memberCount: memberCounts[r.id] ?? 0,
        permissionCount: matrix[r.id]?.size ?? 0,
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rolesSignature, memberCountsSig, matrixSig],
  );

  useEffect(() => {
    if (!active) return;
    setContext({ context_type: "roles_list", page_data: rolesPayload });
    return () => clearContext();
  }, [active, setContext, clearContext, rolesPayload]);

  useShortcut(["n"], () => { setEditing(null); setFormOpen(true); }, {
    description: "Create custom role",
    scope: "Roles",
    enabled: active && !formOpen,
  });

  // Group categories of permissions for category-dot visualization
  const categoriesByPermissionId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of permissions) map[p.id] = p.category;
    return map;
  }, [permissions]);

  const stats = {
    total: roles.length,
    custom: roles.filter((r) => !r.is_system_role).length,
    system: roles.filter((r) => r.is_system_role).length,
  };

  const handleDuplicate = async (role: Role) => {
    try {
      const newRole = await createRole({ name: `${role.name} (Copy)`, description: role.description });
      toast.success(`Duplicated as "${newRole.name}"`);
      setEditing(newRole);
      setFormOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Duplicate failed");
    }
  };

  const handleDelete = async (role: Role) => {
    if (role.is_system_role) return;
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await deleteRole(role.id);
      toast.success(`Deleted "${role.name}"`);
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  };

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Roles" value={stats.total} accentClass="stat-accent-blue" delay={0} />
        <StatCard label="Custom" value={stats.custom} accentClass="stat-accent-teal" delay={0.05} />
        <StatCard label="System" value={stats.system} accentClass="stat-accent-amber" delay={0.1} />
      </div>

      <div className="flex items-center justify-end mb-4">
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Create Custom Role
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-[13px]">Loading roles…</div>
      ) : roles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No roles configured"
          description="Roles should have been seeded automatically. Something may have gone wrong with org setup."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => {
            const permCount = matrix[role.id]?.size ?? 0;
            const members = memberCounts[role.id] ?? 0;
            // Category presence for dots
            const categoriesWithPerms = new Set<string>();
            for (const pid of matrix[role.id] ?? []) {
              const cat = categoriesByPermissionId[pid];
              if (cat) categoriesWithPerms.add(cat);
            }

            return (
              <div
                key={role.id}
                className="rounded-xl border border-border bg-card p-5 group hover:shadow-lg hover:border-primary/20 transition-all"
                style={{ boxShadow: "0 1px 3px var(--shadow-color)" }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold text-foreground mb-0.5 truncate">{role.name}</h3>
                    <p className="text-[12px] text-muted-foreground line-clamp-2 min-h-[32px]">
                      {role.description ?? "—"}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded hover:bg-accent shrink-0">
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditing(role); setFormOpen(true); }}>
                        <Edit className="w-3.5 h-3.5" /> {role.is_system_role ? "View" : "Edit"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(role)}>
                        <Copy className="w-3.5 h-3.5" /> Duplicate
                      </DropdownMenuItem>
                      {!role.is_system_role && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(role)}>
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {role.is_system_role ? (
                    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-gray-500/15 text-gray-500 text-[10px] font-medium">
                      <Lock className="w-2.5 h-2.5" /> System
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-purple-500/15 text-purple-500 text-[10px] font-medium">
                      <Sparkles className="w-2.5 h-2.5" /> Custom
                    </span>
                  )}
                </div>

                {/* Category dots */}
                <div className="flex items-center gap-1.5 mb-3">
                  {CATEGORY_ORDER.map((cat) => {
                    const has = categoriesWithPerms.has(cat);
                    const cfg = CATEGORY_COLORS[cat] ?? { hex: "#6B7280" };
                    return (
                      <Tooltip key={cat}>
                        <TooltipTrigger asChild>
                          <span
                            className="w-2 h-2 rounded-full"
                            style={has ? { background: cfg.hex } : { border: `1px solid ${cfg.hex}`, opacity: 0.3 }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>{cat}{has ? " ✓" : ""}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-3 border-t border-border/50">
                  <span className="flex items-center gap-1 tabular-nums">
                    <Shield className="w-3 h-3" /> {permCount} permissions
                  </span>
                  <span className="flex items-center gap-1 tabular-nums">
                    <Users className="w-3 h-3" /> {members} {members === 1 ? "member" : "members"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RoleFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        editing={editing}
        allRoles={roles}
        onCreate={async (input, permissionIds) => {
          const role = await createRole(input);
          // permissions are saved inside the modal after create, see RoleFormModal
          return role;
        }}
        onUpdate={async (id, patch) => { await updateRole(id, patch); }}
      />
    </div>
  );
}

// ─── Tab 3: Permissions Matrix ────────────────────────────────────────────────

function MatrixTab({ active }: { active: boolean }) {
  const { data: roles } = useRoles();
  const { data: permissions } = useAllPermissions();
  const { matrix, loading } = usePermissionMatrix(roles.map((r) => r.id));
  const { setContext, clearContext } = useCodyContext();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const roleNamesKey = useMemo(() => roles.map((r) => r.name).join(","), [roles]);
  const matrixPayload = useMemo(
    () => ({
      roleCount: roles.length,
      permissionCount: permissions.length,
      roleNames: roles.map((r) => r.name),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roleNamesKey, roles.length, permissions.length],
  );

  useEffect(() => {
    if (!active) return;
    setContext({ context_type: "permissions_matrix", page_data: matrixPayload });
    return () => clearContext();
  }, [active, setContext, clearContext, matrixPayload]);

  const filteredPermissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return permissions.filter((p) => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.key.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [permissions, search, categoryFilter]);

  const grouped = useMemo(() => groupByCategory(filteredPermissions), [filteredPermissions]);

  return (
    <div>
      <FiltersBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search permissions…"
        activeChips={categoryFilter ? [{
          key: "cat", label: "Category", value: categoryFilter,
          onRemove: () => setCategoryFilter(null),
        }] : []}
        onClearAll={categoryFilter ? () => setCategoryFilter(null) : undefined}
        actions={
          <div className="flex items-center gap-1.5">
            <select
              value={categoryFilter ?? ""}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
              className="h-9 px-3 text-[12px] rounded-md bg-background border border-border"
            >
              <option value="">All categories</option>
              {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Button variant="outline" size="sm" disabled>Export CSV</Button>
          </div>
        }
      />

      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-[13px]">Loading matrix…</div>
      ) : roles.length === 0 || permissions.length === 0 ? (
        <EmptyState icon={Shield} title="Nothing to show yet" description="Roles and permissions must be seeded first." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "0 1px 3px var(--shadow-color)" }}>
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                <tr>
                  <th className="sticky left-0 bg-muted/60 h-10 px-3 text-left font-medium text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border" style={{ minWidth: 260 }}>
                    Permission
                  </th>
                  {roles.map((r) => (
                    <th key={r.id} className="h-10 px-2 text-center font-medium text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border whitespace-nowrap" style={{ minWidth: 80 }}>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-semibold text-foreground text-[10px]">{r.name}</span>
                        {r.is_system_role && <span className="text-[8px] text-muted-foreground/60 uppercase">sys</span>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(grouped.entries()).map(([category, perms]) => {
                  const cfg = CATEGORY_COLORS[category] ?? { text: "text-gray-500", bg: "bg-gray-500/10", hex: "#6B7280" };
                  return (
                    <>
                      <tr key={`__hdr_${category}`} className="sticky top-10 z-[5]">
                        <td colSpan={roles.length + 1} className={cn("px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider", cfg.bg, cfg.text)}>
                          {category} · {perms.length} permission{perms.length === 1 ? "" : "s"}
                        </td>
                      </tr>
                      {perms.map((p) => (
                        <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="sticky left-0 bg-card px-3 py-2 text-foreground">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{p.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{p.key}</span>
                            </div>
                          </td>
                          {roles.map((r) => {
                            const allowed = matrix[r.id]?.has(p.id) ?? false;
                            return (
                              <td key={r.id} className="px-2 py-2 text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    {allowed ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                                    ) : r.is_system_role ? (
                                      <Minus className="w-3.5 h-3.5 text-muted-foreground/40 mx-auto" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5 text-red-500/50 mx-auto" />
                                    )}
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {r.name} {allowed ? "can" : "cannot"} {p.name.toLowerCase()}
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
