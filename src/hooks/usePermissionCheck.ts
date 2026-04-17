import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

/**
 * Returns the set of permission keys the current user has in the active org,
 * computed by: grow_user_roles → grow_role_permissions (is_allowed=true) → grow_permissions.key
 *
 * Org owners bypass the permission check (hasAny returns true). RLS still
 * enforces actual DB access — this hook is a UX filter only.
 */
export function useUserPermissions() {
  const { user } = useAuth();
  const { orgId, role } = useOrg();
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !orgId) { setKeys(new Set()); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      // 1) Get role ids for this user in this org
      const { data: userRoles } = await supabase
        .from("grow_user_roles")
        .select("role_id")
        .eq("user_id", user.id)
        .eq("org_id", orgId);
      const roleIds = Array.from(new Set(((userRoles ?? []) as any[]).map((r) => r.role_id).filter(Boolean)));
      if (roleIds.length === 0) { if (!cancelled) { setKeys(new Set()); setLoading(false); } return; }

      // 2) Get allowed permission ids for those roles
      const { data: rolePerms } = await supabase
        .from("grow_role_permissions")
        .select("permission_id")
        .in("role_id", roleIds)
        .eq("is_allowed", true);
      const permIds = Array.from(new Set(((rolePerms ?? []) as any[]).map((r) => r.permission_id).filter(Boolean)));
      if (permIds.length === 0) { if (!cancelled) { setKeys(new Set()); setLoading(false); } return; }

      // 3) Resolve permission keys
      const { data: perms } = await supabase
        .from("grow_permissions")
        .select("key")
        .in("id", permIds);
      if (cancelled) return;
      setKeys(new Set(((perms ?? []) as any[]).map((p) => p.key)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId]);

  // Owners see everything regardless of role assignments
  const isOwner = role === "owner" || role === "admin";
  return { keys, loading, isOwner };
}

export function useHasPermission(permissionKey: string): boolean {
  const { keys, isOwner, loading } = useUserPermissions();
  if (loading) return true; // optimistic — avoid flicker during first load
  if (isOwner) return true;
  return keys.has(permissionKey);
}

export function useHasAnyPermission(permissionKeys: string[]): boolean {
  const { keys, isOwner, loading } = useUserPermissions();
  if (loading) return true;
  if (isOwner) return true;
  if (permissionKeys.length === 0) return true;
  return permissionKeys.some((k) => keys.has(k));
}
