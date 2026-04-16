import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Lock, Copy, Info, Shield } from "lucide-react";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Role, useRolePermissions, useUpdateRolePermissions } from "@/hooks/useRoles";
import { useAllPermissions, groupByCategory, CATEGORY_COLORS } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

interface RoleFormModalProps {
  open: boolean;
  onClose: () => void;
  /** If editing an existing role */
  editing?: Role | null;
  /** All roles for "Copy permissions from" select */
  allRoles: Role[];
  /** Create a new role */
  onCreate?: (input: { name: string; description: string | null }, permissionIds: string[]) => Promise<Role>;
  /** Update existing role name/description */
  onUpdate?: (id: string, patch: { name?: string; description?: string | null }) => Promise<void>;
}

export default function RoleFormModal({ open, onClose, editing, allRoles, onCreate, onUpdate }: RoleFormModalProps) {
  const isEditMode = !!editing;
  const isSystemRole = editing?.is_system_role ?? false;
  const isReadOnly = isSystemRole;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [copyFromRoleId, setCopyFromRoleId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const { data: permissions } = useAllPermissions();
  const { data: currentPerms } = useRolePermissions(editing?.id);
  const { data: copyFromPerms } = useRolePermissions(copyFromRoleId || null);
  const updateRolePermissions = useUpdateRolePermissions();

  const grouped = useMemo(() => groupByCategory(permissions), [permissions]);

  // Seed selected set when modal opens or editing role changes
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setCopyFromRoleId("");
      setSelectedIds(new Set(currentPerms.filter((p) => p.is_allowed).map((p) => p.permission_id)));
    } else {
      setName("");
      setDescription("");
      setCopyFromRoleId("");
      setSelectedIds(new Set());
    }
    setNameError(null);
  }, [open, editing, currentPerms]);

  // When user picks a role to copy from, seed selected set from it
  useEffect(() => {
    if (!copyFromRoleId || isReadOnly) return;
    setSelectedIds(new Set(copyFromPerms.filter((p) => p.is_allowed).map((p) => p.permission_id)));
  }, [copyFromRoleId, copyFromPerms, isReadOnly]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const toggleOne = (pid: string) => {
    if (isReadOnly) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const setCategoryAll = (category: string, value: boolean) => {
    if (isReadOnly) return;
    const cat = grouped.get(category);
    if (!cat) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const p of cat) {
        if (value) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  };

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    const trimmed = name.trim();
    if (!trimmed) { setNameError("Name is required"); return; }
    setSaving(true);
    try {
      if (isEditMode && onUpdate) {
        await onUpdate(editing!.id, { name: trimmed, description: description.trim() || null });
        await updateRolePermissions(editing!.id, Array.from(selectedIds));
        toast.success("Role updated");
      } else if (onCreate) {
        const newRole = await onCreate(
          { name: trimmed, description: description.trim() || null },
          Array.from(selectedIds),
        );
        await updateRolePermissions(newRole.id, Array.from(selectedIds));
        toast.success("Role created");
      }
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const totalPermissions = permissions.length;
  const allowedCount = selectedIds.size;

  return (
    <ScrollableModal
      open={open}
      onClose={onClose}
      size="xl"
      customBody
      header={
        <ModalHeader
          icon={isSystemRole ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Shield className="w-4 h-4 text-primary" />}
          title={isEditMode ? (isSystemRole ? "View Role (system)" : "Edit Role") : "Create Custom Role"}
          subtitle={isSystemRole ? "System roles are read-only. Duplicate to customize." : "Configure role name, description, and permissions"}
        />
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[11px] text-muted-foreground">
            {isReadOnly && (
              <span>This is a system role. <button className="text-primary hover:underline" onClick={onClose}>Duplicate to customize</button>.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            {!isReadOnly && (
              <Button onClick={handleSave} disabled={saving} className="min-w-[100px]">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isEditMode ? "Save" : "Create Role"}
              </Button>
            )}
          </div>
        </div>
      }
    >
            {/* Body: two columns (customBody mode — we supply flex-1 min-h-0) */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Left: form */}
              <div className="w-[320px] shrink-0 p-6 border-r border-border overflow-y-auto min-h-0 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                    Name{!isReadOnly && <span className="text-destructive ml-0.5">*</span>}
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => { setName(e.target.value); setNameError(null); }}
                    placeholder="e.g. Senior Grower"
                    disabled={isReadOnly}
                    autoFocus={!isReadOnly}
                  />
                  {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    disabled={isReadOnly}
                    placeholder="What does this role do?"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60 resize-none"
                  />
                </div>

                {!isEditMode && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground flex items-center gap-1">
                      <Copy className="w-3 h-3" /> Copy permissions from
                    </label>
                    <select
                      value={copyFromRoleId}
                      onChange={(e) => setCopyFromRoleId(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Start from scratch</option>
                      {allRoles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-[11px] font-semibold text-foreground tabular-nums">
                    {allowedCount} <span className="font-normal text-muted-foreground">/ {totalPermissions} permissions allowed</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${totalPermissions > 0 ? (allowedCount / totalPermissions) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right: permissions matrix */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="px-6 py-5 space-y-3">
                  {Array.from(grouped.entries()).map(([category, perms]) => {
                    const cfg = CATEGORY_COLORS[category] ?? { bg: "bg-gray-500/15", text: "text-gray-500", hex: "#6B7280" };
                    const isCollapsed = collapsedCategories.has(category);
                    const allowedInCat = perms.filter((p) => selectedIds.has(p.id)).length;
                    const allSelected = allowedInCat === perms.length;
                    const someSelected = allowedInCat > 0 && !allSelected;

                    return (
                      <div key={category} className="rounded-lg border border-border overflow-hidden">
                        <div className={cn("flex items-center justify-between px-3 h-10 cursor-pointer hover:bg-muted/20", cfg.bg)}>
                          <button
                            onClick={() => toggleCategoryCollapse(category)}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                            <span className={cn("text-[12px] font-semibold", cfg.text)}>{category}</span>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {allowedInCat}/{perms.length}
                            </span>
                          </button>
                          {!isReadOnly && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setCategoryAll(category, true); }}
                                className="text-[10px] px-2 py-0.5 rounded hover:bg-background/60 text-muted-foreground hover:text-emerald-500"
                              >
                                Allow all
                              </button>
                              <span className="text-muted-foreground/40">·</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); setCategoryAll(category, false); }}
                                className="text-[10px] px-2 py-0.5 rounded hover:bg-background/60 text-muted-foreground hover:text-destructive"
                              >
                                Deny all
                              </button>
                            </div>
                          )}
                        </div>
                        {!isCollapsed && (
                          <div className="divide-y divide-border/50">
                            {perms.map((p) => {
                              const checked = selectedIds.has(p.id);
                              return (
                                <label
                                  key={p.id}
                                  className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 text-[13px] select-none",
                                    !isReadOnly && "cursor-pointer hover:bg-muted/20",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={isReadOnly}
                                    onChange={() => toggleOne(p.id)}
                                    className="w-3.5 h-3.5 rounded border-border accent-primary"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-foreground font-medium">{p.name}</div>
                                    <div className="text-[11px] text-muted-foreground font-mono">{p.key}</div>
                                  </div>
                                  {p.description && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent>{p.description}</TooltipContent>
                                    </Tooltip>
                                  )}
                                  <span className={cn(
                                    "text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0 w-14 text-center",
                                    checked ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/10 text-red-500/70",
                                  )}>
                                    {checked ? "Allow" : "Deny"}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

    </ScrollableModal>
  );
}
