import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrg } from "@/lib/org";

export interface KioskEmployee {
  id: string;
  employee_number: string | null;
  first_name: string;
  last_name: string;
  job_title: string | null;
  facility_id: string | null;
  last_punch?: { punch_type: string; punched_at: string } | null;
}

/** Very lightweight session state kept in sessionStorage — no auth, meant for shared tablets. */
const SESSION_KEY = "cody_grow_kiosk_session";

export interface KioskSession {
  employeeId: string;
  employeeName: string;
  facilityId: string | null;
  sessionId: string;
  signedInAt: string;
}

export function useKioskSession() {
  const [session, setSession] = useState<KioskSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const signOut = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  const setKioskSession = useCallback((s: KioskSession | null) => {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
    setSession(s);
  }, []);

  return { session, setSession: setKioskSession, signOut };
}

/**
 * Look up employee by employee_number. PIN validation is optional — if the
 * employee has a matching kiosk session with a pin, require it; otherwise
 * employee_number is enough (many orgs don't use PINs on shared tablets).
 */
export function useKioskLogin() {
  const { orgId } = useOrg();
  return useCallback(async (employeeNumber: string, pin?: string): Promise<KioskEmployee | null> => {
    if (!orgId) throw new Error("No active org");
    const { data: employee } = await supabase.from("grow_employees")
      .select("id, employee_number, first_name, last_name, job_title, facility_id")
      .eq("org_id", orgId).eq("employee_number", employeeNumber.trim()).eq("employment_status", "active").maybeSingle();
    if (!employee) return null;
    // Optional PIN check against kiosk_sessions.pin_code for this employee's facility
    if (pin) {
      const { data: kioskSession } = await supabase.from("grow_kiosk_sessions")
        .select("pin_code").eq("org_id", orgId).eq("facility_id", employee.facility_id ?? "").maybeSingle();
      if (kioskSession && (kioskSession as any).pin_code && (kioskSession as any).pin_code !== pin) {
        return null;
      }
    }
    return employee as KioskEmployee;
  }, [orgId]);
}

export function useLatestPunch(employeeId: string | undefined) {
  const [punch, setPunch] = useState<any | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!employeeId) { setPunch(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("grow_time_clock_punches")
        .select("*").eq("employee_id", employeeId)
        .order("punched_at", { ascending: false }).limit(1);
      if (!cancelled) setPunch(((data ?? []) as any[])[0] ?? null);
    })();
    return () => { cancelled = true; };
  }, [employeeId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { punch, refresh, isClockedIn: punch?.punch_type === "in" };
}

export function useKioskPunch() {
  const { orgId } = useOrg();
  return useCallback(async (employeeId: string, punchType: "in" | "out") => {
    if (!orgId) throw new Error("No active org");
    const { error } = await supabase.from("grow_time_clock_punches").insert({
      org_id: orgId,
      employee_id: employeeId,
      punch_type: punchType,
      punched_at: new Date().toISOString(),
    });
    if (error) throw error;
  }, [orgId]);
}

export function useKioskTasks(employeeId: string | undefined) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!employeeId) { setTasks([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const { data } = await supabase.from("grow_tasks")
        .select("*").eq("assigned_to_employee_id", employeeId)
        .not("status", "in", "(completed,cancelled)")
        .order("scheduled_end", { ascending: true, nullsFirst: false }).limit(20);
      if (!cancelled) { setTasks((data ?? []) as any[]); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [employeeId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { tasks, loading, refresh };
}

export function useKioskScanPlant() {
  const { orgId } = useOrg();
  return useCallback(async (identifier: string) => {
    if (!orgId) return null;
    const { data } = await supabase.from("grow_plants")
      .select("*").eq("org_id", orgId).or(`plant_identifier.eq.${identifier},external_id.eq.${identifier}`).maybeSingle();
    if (!data) return null;
    const [strain, area] = await Promise.all([
      (data as any).strain_id ? supabase.from("grow_strains").select("name, type").eq("id", (data as any).strain_id).maybeSingle() : Promise.resolve({ data: null }),
      (data as any).area_id ? supabase.from("grow_areas").select("name").eq("id", (data as any).area_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return { ...(data as any), strain: (strain as any).data, area: (area as any).data };
  }, [orgId]);
}

export function useKioskScanBatch() {
  const { orgId } = useOrg();
  return useCallback(async (barcode: string) => {
    if (!orgId) return null;
    const { data } = await supabase.from("grow_batches")
      .select("*").eq("org_id", orgId).or(`barcode.eq.${barcode},external_id.eq.${barcode}`).maybeSingle();
    if (!data) return null;
    const [product, strain] = await Promise.all([
      (data as any).product_id ? supabase.from("grow_products").select("name, ccrs_inventory_category").eq("id", (data as any).product_id).maybeSingle() : Promise.resolve({ data: null }),
      (data as any).strain_id ? supabase.from("grow_strains").select("name, type").eq("id", (data as any).strain_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return { ...(data as any), product: (product as any).data, strain: (strain as any).data };
  }, [orgId]);
}

export function useKioskLog() {
  const { orgId } = useOrg();
  return useCallback(async (input: { area_id?: string | null; content: string; log_type?: string }) => {
    if (!orgId) throw new Error("No active org");
    const { error } = await supabase.from("grow_logs").insert({
      org_id: orgId,
      content: input.content,
      log_type: input.log_type ?? "general",
      area_id: input.area_id ?? null,
      recorded_at: new Date().toISOString(),
    });
    if (error) throw error;
  }, [orgId]);
}

/** Record a scale reading — audit trail for every kiosk weigh. */
export function useKioskScaleReading() {
  const { orgId } = useOrg();
  return useCallback(async (input: {
    weight_grams: number;
    entity_type?: string;
    entity_id?: string | null;
    operator_employee_id?: string | null;
  }) => {
    if (!orgId) throw new Error("No active org");
    const { error } = await supabase.from("grow_scale_readings").insert({
      org_id: orgId,
      weight_grams: input.weight_grams,
      entity_type: input.entity_type ?? "other",
      entity_id: input.entity_id ?? null,
      operator_employee_id: input.operator_employee_id ?? null,
      recorded_at: new Date().toISOString(),
    });
    if (error) throw error;
  }, [orgId]);
}

/** Active harvests for a kiosk weigh context — filters to drying/cured status. */
export function useKioskActiveHarvests() {
  const { orgId } = useOrg();
  const [data, setData] = useState<Array<{ id: string; name: string; status: string | null }>>([]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase.from("grow_harvests")
        .select("id, name, status").eq("org_id", orgId)
        .in("status", ["drying", "curing", "cured"]).order("created_at", { ascending: false });
      if (!cancelled) setData((rows ?? []) as any);
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  return data;
}

/** Record waste from inventory (batch adjustment) via kiosk. */
export function useKioskRecordInventoryWaste() {
  const { orgId } = useOrg();
  return useCallback(async (input: {
    batch_id: string;
    weight_grams: number;
    reason: string;
    detail?: string;
    operator_employee_id?: string | null;
  }) => {
    if (!orgId) throw new Error("No active org");
    // Create adjustment (negative delta) + update batch current_quantity
    const { data: batch } = await supabase.from("grow_batches")
      .select("current_quantity").eq("id", input.batch_id).maybeSingle();
    if (!batch) throw new Error("Batch not found");
    const current = Number((batch as any).current_quantity ?? 0);
    const next = current - input.weight_grams;
    if (next < 0) throw new Error("Would leave negative quantity");
    const now = new Date().toISOString();
    await supabase.from("grow_inventory_adjustments").insert({
      org_id: orgId,
      external_id: `KIOSK-${Date.now()}`.slice(0, 17).padEnd(17, "0"),
      batch_id: input.batch_id,
      adjustment_reason: input.reason,
      adjustment_detail: input.detail ?? "Recorded via kiosk",
      quantity_delta: -input.weight_grams,
      adjustment_date: now,
    });
    await supabase.from("grow_batches").update({
      current_quantity: next, current_weight_grams: next,
    }).eq("id", input.batch_id);
  }, [orgId]);
}
