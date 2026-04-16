import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface Facility {
  id: string;
  org_id: string;
  name: string;
  license_number: string;
  license_type: string | null;
  ubi_number: string | null;
  dea_registration: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  email: string | null;
  ccrs_location_code: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FacilityInput {
  name: string;
  license_number: string;
  license_type?: string | null;
  ubi_number?: string | null;
  dea_registration?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state?: string;
  zip: string;
  phone?: string | null;
  email?: string | null;
  ccrs_location_code?: string | null;
  is_primary?: boolean;
  is_active?: boolean;
}

export function useFacilities() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) {
      setData([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows, error: err } = await supabase
        .from("grow_facilities")
        .select("*")
        .eq("org_id", orgId)
        .order("is_primary", { ascending: false })
        .order("name");
      if (cancelled) return;
      if (err) setError(err.message);
      else {
        setError(null);
        setData((rows ?? []) as Facility[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const createFacility = useCallback(
    async (input: FacilityInput) => {
      if (!orgId) throw new Error("No active org");
      // Handle is_primary: unset others if this one is primary
      if (input.is_primary) {
        await supabase.from("grow_facilities").update({ is_primary: false }).eq("org_id", orgId);
      }
      const { data: row, error: err } = await supabase
        .from("grow_facilities")
        .insert({ ...input, org_id: orgId, state: input.state ?? "WA" })
        .select()
        .single();
      if (err) throw err;
      refresh();
      return row as Facility;
    },
    [orgId, refresh],
  );

  const updateFacility = useCallback(
    async (id: string, patch: Partial<FacilityInput>) => {
      if (patch.is_primary) {
        await supabase.from("grow_facilities").update({ is_primary: false }).eq("org_id", orgId!).neq("id", id);
      }
      const { data: row, error: err } = await supabase
        .from("grow_facilities")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (err) throw err;
      refresh();
      return row as Facility;
    },
    [orgId, refresh],
  );

  const archiveFacility = useCallback(
    async (id: string) => {
      const { error: err } = await supabase
        .from("grow_facilities")
        .update({ is_active: false })
        .eq("id", id);
      if (err) throw err;
      refresh();
    },
    [refresh],
  );

  return { data, loading, error, refresh, createFacility, updateFacility, archiveFacility };
}

export function useFacility(id: string | undefined) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !orgId || !id) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: row, error: err } = await supabase
        .from("grow_facilities")
        .select("*")
        .eq("id", id)
        .eq("org_id", orgId)
        .maybeSingle();
      if (cancelled) return;
      if (err) setError(err.message);
      else {
        setError(null);
        setData((row ?? null) as Facility | null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, id]);

  return { data, loading, error };
}

/** Aggregate stats for the facilities list header */
export function useFacilitiesStats(facilities: Facility[]) {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return {
    total: facilities.length,
    active: facilities.filter((f) => f.is_active).length,
    // Placeholder: when we add license_expires_date to schema, compute this properly.
    // For now, we'll show 0 — real implementation wires to grow_org_settings or a license_expires column.
    expiringIn30Days: 0,
    // Similarly a placeholder — when canopy_allotments data is wired, compute total
    totalCanopy: 0,
    _now: now,
    _thirtyDays: thirtyDays,
  };
}
