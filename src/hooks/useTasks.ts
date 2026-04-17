import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { subscribeToChanges } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface Task {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  task_type: string | null;
  priority: string | null;
  status: string | null;
  assigned_to_user_id: string | null;
  assigned_to_employee_id: string | null;
  assigned_to_team: string[] | null;
  sop_id: string | null;
  area_id: string | null;
  grow_cycle_id: string | null;
  plant_id: string | null;
  batch_id: string | null;
  harvest_id: string | null;
  production_run_id: string | null;
  template_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  started_at: string | null;
  completed_at: string | null;
  actual_duration_minutes: number | null;
  checklist_progress: any;
  completion_notes: string | null;
  completion_photos: string[] | null;
  blocking_tasks: string[] | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** joined */
  area?: { id: string; name: string } | null;
  cycle?: { id: string; name: string } | null;
  assignee?: { id: string; full_name: string | null; email: string | null } | null;
}

export interface TaskFilters {
  assigned_to?: string;
  status?: string;
  priority?: string;
  area_id?: string;
  cycle_id?: string;
  type?: string;
  overdue?: boolean;
}

export function useTasks(filters: TaskFilters = {}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const sig = [filters.assigned_to, filters.status, filters.priority, filters.area_id, filters.cycle_id, filters.type, filters.overdue].join(":");

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("grow_tasks").select("*").eq("org_id", orgId);
      if (filters.assigned_to) q = q.eq("assigned_to_user_id", filters.assigned_to);
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.priority) q = q.eq("priority", filters.priority);
      if (filters.area_id) q = q.eq("area_id", filters.area_id);
      if (filters.cycle_id) q = q.eq("grow_cycle_id", filters.cycle_id);
      if (filters.type) q = q.eq("task_type", filters.type);
      if (filters.overdue) q = q.lt("scheduled_end", new Date().toISOString()).not("status", "in", "(completed,cancelled)");
      const { data: rows } = await q.order("scheduled_end", { ascending: true, nullsFirst: false });
      const areaIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.area_id).filter(Boolean)));
      const cycleIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.grow_cycle_id).filter(Boolean)));
      const userIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.assigned_to_user_id).filter(Boolean)));
      const [aRes, cRes, uRes] = await Promise.all([
        areaIds.length > 0 ? supabase.from("grow_areas").select("id, name").in("id", areaIds) : Promise.resolve({ data: [] }),
        cycleIds.length > 0 ? supabase.from("grow_cycles").select("id, name").in("id", cycleIds) : Promise.resolve({ data: [] }),
        userIds.length > 0 ? supabase.from("organization_members").select("id, full_name, email").in("id", userIds) : Promise.resolve({ data: [] }),
      ]);
      const aById = new Map<string, any>((aRes.data ?? []).map((a: any) => [a.id, a]));
      const cById = new Map<string, any>((cRes.data ?? []).map((c: any) => [c.id, c]));
      const uById = new Map<string, any>((uRes.data ?? []).map((u: any) => [u.id, u]));
      if (cancelled) return;
      setData(((rows ?? []) as any[]).map((r) => ({
        ...r,
        area: r.area_id ? aById.get(r.area_id) ?? null : null,
        cycle: r.grow_cycle_id ? cById.get(r.grow_cycle_id) ?? null : null,
        assignee: r.assigned_to_user_id ? uById.get(r.assigned_to_user_id) ?? null : null,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, orgId, tick, sig]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Realtime: any task change for this org → refetch (best-effort)
  useEffect(() => {
    if (!orgId) return;
    const sub = subscribeToChanges(`tasks:${orgId}`, [
      { table: "grow_tasks", filter: `org_id=eq.${orgId}`, callback: () => setTick((t) => t + 1) },
    ]);
    return () => sub.unsubscribe();
  }, [orgId]);

  return { data, loading, refresh };
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  task_type?: string | null;
  priority?: string;
  assigned_to_user_id?: string | null;
  assigned_to_employee_id?: string | null;
  sop_id?: string | null;
  area_id?: string | null;
  grow_cycle_id?: string | null;
  plant_id?: string | null;
  batch_id?: string | null;
  harvest_id?: string | null;
  production_run_id?: string | null;
  template_id?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  checklist_progress?: any;
  blocking_tasks?: string[];
}

/** Insert an in-app notification for the assignee when a task has one. */
async function notifyAssignment(orgId: string, task: Task) {
  if (!task.assigned_to_user_id) return;
  // Avoid duplicates: look for an existing assignment notification for this task
  const { data: existing } = await supabase
    .from("grow_in_app_notifications")
    .select("id")
    .eq("user_id", task.assigned_to_user_id)
    .eq("entity_type", "task")
    .eq("entity_id", task.id)
    .eq("event_key", "task_assigned")
    .maybeSingle();
  if (existing) return;
  const dueBit = task.scheduled_end ? ` Due ${new Date(task.scheduled_end).toLocaleString()}.` : "";
  await supabase.from("grow_in_app_notifications").insert({
    org_id: orgId,
    user_id: task.assigned_to_user_id,
    event_key: "task_assigned",
    title: `New task: ${task.title}`,
    content: `Priority: ${task.priority ?? "medium"}.${dueBit}`,
    action_url: "/operations/tasks",
    entity_type: "task",
    entity_id: task.id,
  });

  // Urgent tasks also trigger SMS (best-effort; silent failure)
  if (task.priority === "urgent") {
    try {
      const { data: member } = await supabase
        .from("organization_members")
        .select("phone")
        .eq("id", task.assigned_to_user_id)
        .maybeSingle();
      const phone = (member as any)?.phone;
      if (phone) {
        await supabase.functions.invoke("send-sms", {
          body: { org_id: orgId, to: phone, message: `URGENT task: ${task.title}.${dueBit}` },
        });
      }
    } catch { /* SMS is best-effort */ }
  }
}

export function useCreateTask() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  return useCallback(async (input: CreateTaskInput): Promise<Task> => {
    if (!orgId) throw new Error("No active org");
    const { data, error } = await supabase.from("grow_tasks").insert({
      org_id: orgId,
      ...input,
      status: "pending",
      priority: input.priority ?? "medium",
      created_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    const task = data as unknown as Task;
    await notifyAssignment(orgId, task);
    return task;
  }, [orgId, user?.id]);
}

export function useUpdateTask() {
  const { orgId } = useOrg();
  return useCallback(async (id: string, patch: Partial<Task>) => {
    const { data, error } = await supabase.from("grow_tasks").update(patch as any).eq("id", id).select("*").single();
    if (error) throw error;
    // If this update sets/changes the assignee, notify them
    if (orgId && (patch as any).assigned_to_user_id) {
      await notifyAssignment(orgId, data as unknown as Task);
    }
  }, [orgId]);
}

export function useCompleteTask() {
  return useCallback(async (id: string, notes?: string | null, photos?: string[]) => {
    const { error } = await supabase.from("grow_tasks").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completion_notes: notes ?? null,
      completion_photos: photos ?? null,
    }).eq("id", id);
    if (error) throw error;
  }, []);
}

export function useDeleteTask() {
  return useCallback(async (id: string) => {
    const { error } = await supabase.from("grow_tasks").delete().eq("id", id);
    if (error) throw error;
  }, []);
}

export function useTaskStats(tasks: Task[]) {
  return useMemo(() => {
    const now = Date.now();
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let overdue = 0;
    tasks.forEach((t) => {
      const s = t.status ?? "pending";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      const p = t.priority ?? "medium";
      byPriority[p] = (byPriority[p] ?? 0) + 1;
      if (t.scheduled_end && new Date(t.scheduled_end).getTime() < now && s !== "completed" && s !== "cancelled") overdue++;
    });
    return {
      total: tasks.length,
      pending: byStatus.pending ?? 0,
      in_progress: byStatus.in_progress ?? 0,
      completed: byStatus.completed ?? 0,
      cancelled: byStatus.cancelled ?? 0,
      overdue,
      byPriority,
    };
  }, [tasks]);
}

export function useTaskTemplates() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_task_templates").select("*").eq("org_id", orgId).eq("is_active", true).order("name");
      if (cancelled) return;
      setData((rows ?? []) as any[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId]);

  return { data, loading };
}
