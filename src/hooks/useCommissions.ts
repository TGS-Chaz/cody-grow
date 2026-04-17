import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface CommissionRow {
  rep_id: string;
  rep_name: string;
  order_count: number;
  total_revenue: number;
  commission_amount: number;
}

export interface CommissionConfig {
  rate: number;
  type: "percentage" | "fixed_per_order";
}

export function useCommissionConfig() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [config, setConfig] = useState<CommissionConfig>({ rate: 0, type: "percentage" });

  useEffect(() => {
    if (!user || !orgId) return;
    (async () => {
      const { data } = await supabase.from("grow_org_settings").select("commission_rate, commission_type").eq("org_id", orgId).maybeSingle();
      setConfig({
        rate: Number((data as any)?.commission_rate ?? 0),
        type: ((data as any)?.commission_type as any) ?? "percentage",
      });
    })();
  }, [user?.id, orgId]);

  return config;
}

export function useCommissionReport(dateFrom?: string, dateTo?: string) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const config = useCommissionConfig();
  const [data, setData] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase.from("grow_orders").select("id, total, created_by, assigned_rep_id:created_by").eq("org_id", orgId).eq("status", "completed");
      if (dateFrom) q = q.gte("completed_at", dateFrom);
      if (dateTo) q = q.lte("completed_at", dateTo);
      const { data: orders } = await q;

      // Group by the order's creator (rep attribution). Fall back to account.assigned_rep_id when available.
      const accountIds: string[] = Array.from(new Set(((orders ?? []) as any[]).map((o) => o.account_id).filter(Boolean)));
      const { data: accounts } = accountIds.length > 0
        ? await supabase.from("grow_accounts").select("id, assigned_rep_id").in("id", accountIds)
        : { data: [] };
      const repByAccount = new Map<string, string | null>(((accounts ?? []) as any[]).map((a) => [a.id, a.assigned_rep_id]));

      const byRep = new Map<string, { count: number; revenue: number }>();
      for (const o of (orders ?? []) as any[]) {
        const repId = repByAccount.get(o.account_id) ?? o.created_by ?? "unassigned";
        const entry = byRep.get(repId) ?? { count: 0, revenue: 0 };
        entry.count += 1;
        entry.revenue += Number(o.total ?? 0);
        byRep.set(repId, entry);
      }

      // Resolve rep names
      const repIds = Array.from(byRep.keys()).filter((id) => id !== "unassigned");
      const { data: reps } = repIds.length > 0
        ? await supabase.from("organization_members").select("id, full_name, email").in("id", repIds)
        : { data: [] };
      const repById = new Map<string, any>(((reps ?? []) as any[]).map((r) => [r.id, r]));

      const rows: CommissionRow[] = Array.from(byRep.entries()).map(([id, v]) => {
        const rep = repById.get(id);
        const commission = config.type === "percentage"
          ? v.revenue * (config.rate / 100)
          : v.count * config.rate;
        return {
          rep_id: id,
          rep_name: rep ? (rep.full_name ?? rep.email ?? "—") : (id === "unassigned" ? "Unassigned" : "—"),
          order_count: v.count,
          total_revenue: Math.round(v.revenue * 100) / 100,
          commission_amount: Math.round(commission * 100) / 100,
        };
      }).sort((a, b) => b.total_revenue - a.total_revenue);

      if (cancelled) return;
      setData(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, dateFrom, dateTo, config.rate, config.type]);

  return { data, loading, config };
}

export function useUpdateCommissionConfig() {
  const { orgId } = useOrg();
  return useCallback(async (input: CommissionConfig) => {
    if (!orgId) throw new Error("No active org");
    const { data: existing } = await supabase.from("grow_org_settings").select("id").eq("org_id", orgId).maybeSingle();
    if (existing) {
      await supabase.from("grow_org_settings").update({
        commission_rate: input.rate, commission_type: input.type,
      }).eq("id", (existing as any).id);
    } else {
      await supabase.from("grow_org_settings").insert({
        org_id: orgId, commission_rate: input.rate, commission_type: input.type,
      });
    }
  }, [orgId]);
}
