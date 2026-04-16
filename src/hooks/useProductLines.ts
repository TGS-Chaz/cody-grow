import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface ProductLine {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  /** Joined: count of products assigned to this line */
  product_count?: number;
}

export interface ProductLineInput {
  name: string;
  description?: string | null;
  parent_id?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
}

export function useProductLines() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<ProductLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [lineRes, prodRes] = await Promise.all([
        supabase
          .from("grow_product_lines")
          .select("*")
          .eq("org_id", orgId)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("name"),
        supabase.from("grow_products").select("product_line_id").eq("org_id", orgId),
      ]);
      if (cancelled) return;
      if (lineRes.error) { setError(lineRes.error.message); setLoading(false); return; }

      const counts = new Map<string, number>();
      (prodRes.data ?? []).forEach((p: any) => {
        if (!p.product_line_id) return;
        counts.set(p.product_line_id, (counts.get(p.product_line_id) ?? 0) + 1);
      });

      setData(((lineRes.data ?? []) as any[]).map((l) => ({
        ...l,
        product_count: counts.get(l.id) ?? 0,
      })) as ProductLine[]);
      setError(null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const createLine = useCallback(async (input: ProductLineInput) => {
    if (!orgId) throw new Error("No active org");
    const payload = { ...input, org_id: orgId, is_active: input.is_active ?? true };
    const { data: row, error: err } = await supabase.from("grow_product_lines").insert(payload).select("*").single();
    if (err) throw err;
    refresh();
    return row as ProductLine;
  }, [orgId, refresh]);

  const updateLine = useCallback(async (id: string, patch: Partial<ProductLineInput>) => {
    const { data: row, error: err } = await supabase.from("grow_product_lines").update(patch).eq("id", id).select("*").single();
    if (err) throw err;
    refresh();
    return row as ProductLine;
  }, [refresh]);

  const archiveLine = useCallback(async (id: string) => {
    const { error: err } = await supabase.from("grow_product_lines").update({ is_active: false }).eq("id", id);
    if (err) throw err;
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh, createLine, updateLine, archiveLine };
}

export function useProductLineStats(lines: ProductLine[]) {
  return useMemo(() => ({
    total: lines.length,
    active: lines.filter((l) => l.is_active).length,
    productsInLines: lines.reduce((sum, l) => sum + (l.product_count ?? 0), 0),
  }), [lines]);
}
