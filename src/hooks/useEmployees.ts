import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export type EmploymentStatus = "active" | "on_leave" | "terminated" | "seasonal" | "contractor";
export type Department =
  | "cultivation" | "processing" | "packaging" | "quality"
  | "sales" | "fulfillment" | "delivery" | "admin" | "management" | "other";

export interface Employee {
  id: string;
  org_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  preferred_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  employee_number: string | null;
  job_title: string | null;
  department: Department | null;
  hire_date: string | null;
  termination_date: string | null;
  employment_status: EmploymentStatus;
  wa_drivers_license: string | null;
  wa_drivers_license_expires: string | null;
  birthdate: string | null;
  user_id: string | null;
  is_system_user: boolean;
  facility_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Joined facility (optional) */
  facility?: { id: string; name: string } | null;
}

export interface EmployeeInput {
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  preferred_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  employee_number?: string | null;
  job_title?: string | null;
  department: Department;
  hire_date?: string | null;
  termination_date?: string | null;
  employment_status?: EmploymentStatus;
  wa_drivers_license?: string | null;
  wa_drivers_license_expires?: string | null;
  birthdate?: string | null;
  user_id?: string | null;
  is_system_user?: boolean;
  facility_id?: string | null;
  notes?: string | null;
}

export const DEPARTMENT_COLORS: Record<Department, { bg: string; text: string; hex: string; label: string }> = {
  cultivation: { bg: "bg-emerald-500/15", text: "text-emerald-500", hex: "#10B981", label: "Cultivation" },
  processing:  { bg: "bg-orange-500/15", text: "text-orange-500", hex: "#F97316", label: "Processing" },
  packaging:   { bg: "bg-purple-500/15", text: "text-purple-500", hex: "#A855F7", label: "Packaging" },
  quality:     { bg: "bg-blue-500/15", text: "text-blue-500", hex: "#3B82F6", label: "Quality" },
  sales:       { bg: "bg-primary/15", text: "text-primary", hex: "#00D4AA", label: "Sales" },
  fulfillment: { bg: "bg-amber-500/15", text: "text-amber-500", hex: "#F59E0B", label: "Fulfillment" },
  delivery:    { bg: "bg-pink-500/15", text: "text-pink-500", hex: "#F472B6", label: "Delivery" },
  admin:       { bg: "bg-gray-500/15", text: "text-gray-500", hex: "#6B7280", label: "Admin" },
  management:  { bg: "bg-indigo-500/15", text: "text-indigo-500", hex: "#6366F1", label: "Management" },
  other:       { bg: "bg-gray-500/15", text: "text-gray-500", hex: "#6B7280", label: "Other" },
};

export function useEmployees() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Two queries: fetch employees + fetch facilities (for name lookup), then combine client-side.
      // Avoids PostgREST foreign-table-join 400s and keeps the hook robust if RLS on either table changes.
      const [empRes, facRes] = await Promise.all([
        supabase.from("grow_employees").select("*").eq("org_id", orgId).order("last_name"),
        supabase.from("grow_facilities").select("id, name").eq("org_id", orgId),
      ]);
      if (cancelled) return;
      if (empRes.error) {
        setError(empRes.error.message);
        setLoading(false);
        return;
      }
      const facilityById = new Map<string, { id: string; name: string }>();
      (facRes.data ?? []).forEach((f: any) => facilityById.set(f.id, f));
      const merged = (empRes.data ?? []).map((e: any) => ({
        ...e,
        facility: e.facility_id ? facilityById.get(e.facility_id) ?? null : null,
      })) as Employee[];
      setError(null);
      setData(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const createEmployee = useCallback(
    async (input: EmployeeInput): Promise<Employee> => {
      if (!orgId) throw new Error("No active org");

      // Auto-generate employee_number if blank + facility selected
      let employeeNumber = input.employee_number?.trim();
      if (!employeeNumber && input.facility_id) {
        const { data: fac } = await supabase.from("grow_facilities").select("license_number").eq("id", input.facility_id).maybeSingle();
        if (fac?.license_number) {
          const { count } = await supabase
            .from("grow_employees")
            .select("id", { count: "exact", head: true })
            .eq("org_id", orgId)
            .eq("facility_id", input.facility_id);
          const seq = String((count ?? 0) + 1).padStart(4, "0");
          employeeNumber = `EMP-${fac.license_number}-${seq}`;
        }
      }

      const payload = {
        ...input,
        org_id: orgId,
        employee_number: employeeNumber || null,
        is_system_user: !!input.user_id,
      };
      const { data: row, error: err } = await supabase
        .from("grow_employees")
        .insert(payload)
        .select("*")
        .single();
      if (err) throw err;
      refresh();
      return row as any as Employee;
    },
    [orgId, refresh],
  );

  const updateEmployee = useCallback(
    async (id: string, patch: Partial<EmployeeInput>): Promise<Employee> => {
      const payload: any = { ...patch };
      if ("user_id" in patch) payload.is_system_user = !!patch.user_id;
      const { data: row, error: err } = await supabase
        .from("grow_employees")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (err) throw err;
      refresh();
      return row as any as Employee;
    },
    [refresh],
  );

  const terminateEmployee = useCallback(
    async (id: string, termination_date?: string) => {
      const { error } = await supabase
        .from("grow_employees")
        .update({
          employment_status: "terminated",
          termination_date: termination_date ?? new Date().toISOString().slice(0, 10),
        })
        .eq("id", id);
      if (error) throw error;
      refresh();
    },
    [refresh],
  );

  return { data, loading, error, refresh, createEmployee, updateEmployee, terminateEmployee };
}

export function useEmployee(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId || !id) { setData(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row, error: err } = await supabase
        .from("grow_employees")
        .select("*")
        .eq("id", id)
        .eq("org_id", orgId)
        .maybeSingle();
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      let withFacility: Employee | null = null;
      if (row) {
        if ((row as any).facility_id) {
          const { data: fac } = await supabase
            .from("grow_facilities")
            .select("id, name")
            .eq("id", (row as any).facility_id)
            .maybeSingle();
          if (cancelled) return;
          withFacility = { ...(row as any), facility: fac ?? null } as Employee;
        } else {
          withFacility = { ...(row as any), facility: null } as Employee;
        }
      }
      setError(null);
      setData(withFacility);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}

export function useEmployeeStats(employees: Employee[]) {
  return useMemo(() => {
    const now = Date.now();
    const in30 = now + 30 * 24 * 60 * 60 * 1000;
    return {
      total: employees.length,
      active: employees.filter((e) => e.employment_status === "active").length,
      systemUsers: employees.filter((e) => !!e.user_id).length,
      licenseExpiring: employees.filter((e) => {
        if (!e.wa_drivers_license_expires) return false;
        const t = new Date(e.wa_drivers_license_expires).getTime();
        return t <= in30 && t >= now;
      }).length,
    };
  }, [employees]);
}

/** Placeholder hooks — return empty arrays until we build the related pages */
export function useEmployeeTimeEntries(employeeId: string | null | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) { setData([]); setLoading(false); return; }
    (async () => {
      const { data: rows } = await supabase
        .from("grow_time_entries")
        .select("*")
        .eq("employee_id", employeeId)
        .order("clock_in_at", { ascending: false })
        .limit(50);
      setData(rows ?? []);
      setLoading(false);
    })();
  }, [employeeId]);

  return { data, loading };
}

export function useEmployeeTasks(employeeId: string | null | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) { setData([]); setLoading(false); return; }
    (async () => {
      const { data: rows } = await supabase
        .from("grow_tasks")
        .select("*")
        .eq("assigned_to_employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(100);
      setData(rows ?? []);
      setLoading(false);
    })();
  }, [employeeId]);

  return { data, loading };
}

export function useEmployeeTrainingRecords(employeeId: string | null | undefined) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) { setData([]); setLoading(false); return; }
    (async () => {
      const { data: rows } = await supabase
        .from("grow_training_records")
        .select("*, sop:grow_sops(title, category)")
        .eq("employee_id", employeeId)
        .order("completed_at", { ascending: false });
      setData(rows ?? []);
      setLoading(false);
    })();
  }, [employeeId]);

  return { data, loading };
}

export function useLinkEmployeeToUser() {
  return useCallback(async (employeeId: string, userId: string | null) => {
    const { error } = await supabase
      .from("grow_employees")
      .update({ user_id: userId, is_system_user: !!userId })
      .eq("id", employeeId);
    if (error) throw error;
  }, []);
}
