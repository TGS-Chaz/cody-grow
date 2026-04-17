import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, Plus, MoreHorizontal, CheckCircle2, Edit, Trash2, LayoutGrid, List, Clock,
  AlertCircle, Loader2,
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ScrollableModal, { ModalHeader } from "@/components/ui/scrollable-modal";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { RowActionsCell } from "@/components/shared/DataTable";
import FiltersBar from "@/components/shared/FiltersBar";
import StatusPill from "@/components/shared/StatusPill";
import DateTime from "@/components/shared/DateTime";
import EmptyState from "@/components/shared/EmptyState";
import { useShortcut } from "@/components/shared/KeyboardShortcuts";
import { useCodyContext } from "@/hooks/useCodyContext";
import {
  useTasks, useCompleteTask, useDeleteTask, useCreateTask, useUpdateTask, useTaskStats, useTaskTemplates,
  Task, TaskFilters, CreateTaskInput,
} from "@/hooks/useTasks";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";
import { cn } from "@/lib/utils";

const COLUMN_KEYS = ["pending", "in_progress", "completed", "overdue"] as const;
type ColumnKey = typeof COLUMN_KEYS[number];
const COLUMN_LABELS: Record<ColumnKey, string> = {
  pending: "Pending", in_progress: "In Progress", completed: "Completed", overdue: "Overdue",
};
const COLUMN_COLORS: Record<ColumnKey, string> = {
  pending: "border-muted-foreground/30", in_progress: "border-amber-500/30", completed: "border-emerald-500/30", overdue: "border-red-500/30",
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-muted-foreground/40", medium: "bg-blue-500", high: "bg-amber-500", urgent: "bg-red-500",
};

export default function TasksPage() {
  const navigate = useNavigate();
  const { orgId } = useOrg();
  const [filters, setFilters] = useState<TaskFilters>({});
  const { data: tasks, loading, refresh } = useTasks(filters);
  const stats = useTaskStats(tasks);
  const update = useUpdateTask();
  const complete = useCompleteTask();
  const del = useDeleteTask();

  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const modalOpen = createOpen || !!editTask;

  useShortcut(["n"], () => setCreateOpen(true), { description: "Create task", scope: "Tasks", enabled: !modalOpen });
  useShortcut(["/"], () => document.querySelector<HTMLInputElement>("[data-filters-search]")?.focus(), { description: "Focus search", scope: "Tasks" });

  const { setContext, clearContext } = useCodyContext();
  useEffect(() => {
    setContext({ context_type: "tasks_list", page_data: { stats, view, filters } });
    return () => clearContext();
  }, [setContext, clearContext, stats, view, filters]);

  // On each Tasks page mount, scan for newly-overdue tasks and create a
  // one-time notification per (task, overdue) pair for the assignee.
  useEffect(() => {
    if (!orgId || tasks.length === 0) return;
    const now = Date.now();
    const overdue = tasks.filter((t) => {
      if (!t.scheduled_end) return false;
      if (t.status === "completed" || t.status === "cancelled") return false;
      return new Date(t.scheduled_end).getTime() < now;
    });
    if (overdue.length === 0) return;
    (async () => {
      for (const t of overdue) {
        if (!t.assigned_to_user_id) continue;
        const { data: existing } = await supabase
          .from("grow_in_app_notifications")
          .select("id")
          .eq("user_id", t.assigned_to_user_id)
          .eq("entity_type", "task")
          .eq("entity_id", t.id)
          .eq("event_key", "task_overdue")
          .maybeSingle();
        if (existing) continue;
        await supabase.from("grow_in_app_notifications").insert({
          org_id: orgId,
          user_id: t.assigned_to_user_id,
          event_key: "task_overdue",
          title: `Overdue task: ${t.title}`,
          content: `Was due ${new Date(t.scheduled_end!).toLocaleString()}.`,
          action_url: "/operations/tasks",
          entity_type: "task",
          entity_id: t.id,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, tasks.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => `${t.title} ${t.description ?? ""} ${t.assignee?.full_name ?? ""}`.toLowerCase().includes(q));
  }, [tasks, search]);

  const byColumn = useMemo(() => {
    const now = Date.now();
    const cols: Record<ColumnKey, Task[]> = { pending: [], in_progress: [], completed: [], overdue: [] };
    for (const t of filtered) {
      const s = t.status ?? "pending";
      const isOverdue = t.scheduled_end && new Date(t.scheduled_end).getTime() < now && s !== "completed" && s !== "cancelled";
      if (isOverdue) cols.overdue.push(t);
      else if (s === "completed") cols.completed.push(t);
      else if (s === "in_progress") cols.in_progress.push(t);
      else cols.pending.push(t);
    }
    return cols;
  }, [filtered]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (e: DragEndEvent) => {
    setDraggedId(null);
    const taskId = String(e.active.id);
    const targetCol = String(e.over?.id ?? "") as ColumnKey;
    if (!COLUMN_KEYS.includes(targetCol)) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    try {
      if (targetCol === "completed") { await complete(taskId); toast.success("Task completed"); }
      else if (targetCol === "overdue") return;
      else { await update(taskId, { status: targetCol } as any); }
      refresh();
    } catch (err: any) { toast.error(err?.message ?? "Failed"); }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1700px] mx-auto">
      <PageHeader
        title="Tasks"
        description="Work to do across the grow"
        breadcrumbs={[{ label: "Operations" }, { label: "Tasks" }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
              <button onClick={() => setView("kanban")} className={cn("h-8 px-3 text-[12px] rounded-md flex items-center gap-1.5", view === "kanban" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
                <LayoutGrid className="w-3.5 h-3.5" /> Kanban
              </button>
              <button onClick={() => setView("list")} className={cn("h-8 px-3 text-[12px] rounded-md flex items-center gap-1.5", view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>
                <List className="w-3.5 h-3.5" /> List
              </button>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Create Task</Button>
          </div>
        }
      />

      <FiltersBar
        searchValue={search} onSearchChange={setSearch}
        searchPlaceholder="Search task, assignee…"
        pageKey="tasks"
        currentFilters={{ ...filters, search }}
        onApplyView={(f) => {
          setFilters({ priority: f.priority, status: f.status });
          setSearch(f.search ?? "");
        }}
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={filters.priority ?? ""} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={filters.status ?? ""} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))} className="h-9 px-3 text-[12px] rounded-md bg-background border border-border">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : view === "kanban" ? (
        <DndContext sensors={sensors} onDragStart={(e) => setDraggedId(String(e.active.id))} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {COLUMN_KEYS.map((col) => (
              <KanbanColumn key={col} columnKey={col} tasks={byColumn[col]} onEdit={setEditTask} />
            ))}
          </div>
          <DragOverlay>
            {draggedId ? (() => {
              const t = tasks.find((x) => x.id === draggedId);
              return t ? <KanbanCard task={t} dragging /> : null;
            })() : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <ListView tasks={filtered} onComplete={async (id) => { await complete(id); refresh(); }} onDelete={async (id) => { await del(id); refresh(); }} onEdit={setEditTask} />
      )}

      <TaskModal open={createOpen || !!editTask} onClose={() => { setCreateOpen(false); setEditTask(null); }} task={editTask} onSuccess={() => refresh()} />
      {(() => { void stats; void navigate; void AlertCircle; void Clock; return null; })()}
    </div>
  );
}

// ─── Kanban ─────────────────────────────────────────────────────────────────

function KanbanColumn({ columnKey, tasks, onEdit }: { columnKey: ColumnKey; tasks: Task[]; onEdit: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });
  return (
    <div ref={setNodeRef} className={cn("rounded-xl border-2 transition-colors bg-muted/20 min-h-[500px]", COLUMN_COLORS[columnKey], isOver && "bg-primary/5")}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider">{COLUMN_LABELS[columnKey]}</h3>
        <span className="text-[11px] font-mono text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="p-2 space-y-2">
        <AnimatePresence>
          {tasks.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <DraggableKanbanCard task={t} onEdit={onEdit} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DraggableKanbanCard({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-30")} onDoubleClick={() => onEdit(task)}>
      <KanbanCard task={task} />
    </div>
  );
}

function KanbanCard({ task, dragging }: { task: Task; dragging?: boolean }) {
  const overdue = task.scheduled_end && new Date(task.scheduled_end).getTime() < Date.now() && task.status !== "completed";
  return (
    <div className={cn("rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors space-y-2", dragging && "shadow-lg")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className={cn("w-2 h-2 rounded-full shrink-0", PRIORITY_COLOR[task.priority ?? "medium"])} />
          <span className="text-[12px] font-medium truncate">{task.title}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {task.task_type && <span className="inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground">{task.task_type}</span>}
        {task.area && <span className="text-[10px] text-muted-foreground">{task.area.name}</span>}
        {task.cycle && <span className="text-[10px] text-muted-foreground">{task.cycle.name}</span>}
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        {task.assignee && <span className="text-muted-foreground truncate">{task.assignee.full_name ?? task.assignee.email}</span>}
        {task.scheduled_end && (
          <DateTime value={task.scheduled_end} format="date-only" className={cn("font-mono", overdue ? "text-destructive" : "text-muted-foreground")} />
        )}
      </div>
    </div>
  );
}

// ─── List ───────────────────────────────────────────────────────────────────

function ListView({ tasks, onComplete, onDelete, onEdit }: { tasks: Task[]; onComplete: (id: string) => void; onDelete: (id: string) => void; onEdit: (t: Task) => void }) {
  const columns: ColumnDef<Task>[] = useMemo(() => [
    { accessorKey: "title", header: "Title", cell: ({ row }) => <button onClick={() => onEdit(row.original)} className="text-[12px] font-medium text-primary hover:underline text-left">{row.original.title}</button> },
    { accessorKey: "task_type", header: "Type", cell: ({ row }) => row.original.task_type ? <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-medium bg-muted text-muted-foreground uppercase tracking-wider">{row.original.task_type}</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "priority", header: "Priority", cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 text-[12px] capitalize">
        <span className={cn("w-2 h-2 rounded-full", PRIORITY_COLOR[row.original.priority ?? "medium"])} />
        {row.original.priority ?? "medium"}
      </span>
    ) },
    { id: "assigned", header: "Assigned To", cell: ({ row }) => row.original.assignee?.full_name ?? row.original.assignee?.email ?? <span className="text-muted-foreground">—</span> },
    { id: "context", header: "Context", cell: ({ row }) => row.original.area?.name ?? row.original.cycle?.name ?? <span className="text-muted-foreground">—</span> },
    { accessorKey: "scheduled_end", header: "Due", cell: ({ row }) => {
      if (!row.original.scheduled_end) return <span className="text-muted-foreground">—</span>;
      const overdue = new Date(row.original.scheduled_end).getTime() < Date.now() && row.original.status !== "completed";
      const today = new Date(row.original.scheduled_end).toDateString() === new Date().toDateString();
      return <DateTime value={row.original.scheduled_end} format="date-only" className={cn("text-[12px]", overdue ? "text-destructive" : today ? "text-amber-500" : "text-muted-foreground")} />;
    } },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusPill label={row.original.status ?? "pending"} variant={row.original.status === "completed" ? "success" : row.original.status === "in_progress" ? "warning" : "info"} /> },
    {
      id: "actions", enableSorting: false, header: "",
      cell: ({ row }) => (
        <RowActionsCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button className="p-1 rounded hover:bg-accent"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(row.original)}><Edit className="w-3.5 h-3.5" /> Edit</DropdownMenuItem>
              {row.original.status !== "completed" && <DropdownMenuItem onClick={() => onComplete(row.original.id)}><CheckCircle2 className="w-3.5 h-3.5" /> Complete</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => onDelete(row.original.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </RowActionsCell>
      ),
    },
  ], [onComplete, onDelete, onEdit]);

  return <DataTable columns={columns} data={tasks} empty={{ icon: ClipboardList, title: "No tasks", description: "Create a task to track work." }} />;
}

// ─── Create/Edit Modal ─────────────────────────────────────────────────────

function TaskModal({ open, onClose, task, onSuccess }: { open: boolean; onClose: () => void; task: Task | null; onSuccess?: () => void }) {
  const { orgId } = useOrg();
  const create = useCreateTask();
  const update = useUpdateTask();
  const { data: templates } = useTaskTemplates();
  const [templateId, setTemplateId] = useState("");
  const [form, setForm] = useState<CreateTaskInput>({ title: "", priority: "medium" });
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !orgId) return;
    setShowAll(false);
    setTemplateId("");
    if (task) {
      setForm({
        title: task.title, description: task.description, task_type: task.task_type,
        priority: task.priority ?? "medium", assigned_to_user_id: task.assigned_to_user_id,
        sop_id: task.sop_id, area_id: task.area_id, grow_cycle_id: task.grow_cycle_id,
        scheduled_start: task.scheduled_start, scheduled_end: task.scheduled_end,
      });
    } else {
      setForm({ title: "", priority: "medium" });
    }
    (async () => {
      const [uRes, aRes, cRes] = await Promise.all([
        supabase.from("organization_members").select("id, full_name, email").eq("org_id", orgId),
        supabase.from("grow_areas").select("id, name").eq("org_id", orgId).eq("is_active", true),
        supabase.from("grow_cycles").select("id, name").eq("org_id", orgId).not("phase", "eq", "completed"),
      ]);
      setUsers((uRes.data ?? []) as any);
      setAreas((aRes.data ?? []) as any);
      setCycles((cRes.data ?? []) as any);
    })();
  }, [open, orgId, task]);

  useEffect(() => {
    if (!templateId) return;
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setForm((f) => ({
      ...f,
      title: t.title ?? f.title,
      description: t.description ?? f.description,
      task_type: t.task_type ?? f.task_type,
      priority: t.priority ?? f.priority,
      sop_id: t.sop_id ?? f.sop_id,
      template_id: t.id,
    }));
    setShowAll(true);
  }, [templateId, templates]);

  const valid = form.title.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { toast.error("Title required"); return; }
    setSaving(true);
    try {
      if (task) {
        await update(task.id, form as any);
        toast.success("Task updated");
      } else {
        await create(form);
        toast.success("Task created");
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally { setSaving(false); }
  };

  const setField = <K extends keyof CreateTaskInput>(k: K, v: CreateTaskInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <ScrollableModal
      open={open} onClose={onClose} size="md" onSubmit={handleSubmit}
      header={<ModalHeader icon={<ClipboardList className="w-4 h-4 text-primary" />} title={task ? "Edit task" : "Create task"} />}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={!valid || saving} className="min-w-[120px] gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
            {task ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="p-6 space-y-4">
        {!task && templates.length > 0 && (
          <Field label="From template (optional)">
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— Start from scratch —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Title" required>
          <Input value={form.title} onChange={(e) => setField("title", e.target.value)} />
        </Field>
        <Field label="Priority">
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 w-full">
            {(["low", "medium", "high", "urgent"] as const).map((p) => (
              <button key={p} type="button" onClick={() => setField("priority", p)} className={cn("flex-1 h-9 text-[12px] font-medium rounded-md transition-colors capitalize", form.priority === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <span className={cn("inline-block w-2 h-2 rounded-full mr-1.5", PRIORITY_COLOR[p])} />
                {p}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Assigned to">
          <select value={form.assigned_to_user_id ?? ""} onChange={(e) => setField("assigned_to_user_id", e.target.value || null)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">— Unassigned —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>)}
          </select>
        </Field>

        <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[12px] font-medium text-primary hover:text-primary/80">
          {showAll ? "Hide" : "Show"} all fields
        </button>

        {showAll && (
          <div className="space-y-4">
            <Field label="Type">
              <Input value={form.task_type ?? ""} onChange={(e) => setField("task_type", e.target.value)} placeholder="cultivation, harvest, processing…" />
            </Field>
            <Field label="Description">
              <textarea value={form.description ?? ""} onChange={(e) => setField("description", e.target.value)} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Area">
                <select value={form.area_id ?? ""} onChange={(e) => setField("area_id", e.target.value || null)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">— None —</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="Cycle">
                <select value={form.grow_cycle_id ?? ""} onChange={(e) => setField("grow_cycle_id", e.target.value || null)} className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">— None —</option>
                  {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Scheduled start"><Input type="datetime-local" value={form.scheduled_start?.slice(0, 16) ?? ""} onChange={(e) => setField("scheduled_start", e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
              <Field label="Due"><Input type="datetime-local" value={form.scheduled_end?.slice(0, 16) ?? ""} onChange={(e) => setField("scheduled_end", e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
            </div>
          </div>
        )}
      </div>
    </ScrollableModal>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

void EmptyState;
