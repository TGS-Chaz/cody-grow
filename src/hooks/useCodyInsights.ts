import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export interface CodyInsight {
  id: string;
  insight_type: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  content: string;
  severity: "info" | "suggestion" | "warning" | "critical" | null;
  confidence: number | null;
  action_url: string | null;
  dismissed_at: string | null;
  acted_on_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface UseCodyInsightsOptions {
  /** Filter to a specific entity. If omitted, returns all dashboard-level insights. */
  entity_type?: string;
  entity_id?: string;
  /** Limit how many to fetch. */
  limit?: number;
}

export function useCodyInsights({ entity_type, entity_id, limit = 10 }: UseCodyInsightsOptions = {}) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<CodyInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    if (!user) {
      setInsights([]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("cody_insights")
      .select("*")
      .eq("product", "grow")
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (entity_type) query = query.eq("entity_type", entity_type);
    if (entity_id) query = query.eq("entity_id", entity_id);

    const { data, error } = await query;
    if (!error) setInsights((data ?? []) as CodyInsight[]);
    setLoading(false);
  }, [user, entity_type, entity_id, limit]);

  useEffect(() => {
    setLoading(true);
    fetchInsights();
  }, [fetchInsights]);

  const dismiss = useCallback(
    async (id: string) => {
      // Optimistic
      setInsights((prev) => prev.filter((i) => i.id !== id));
      await supabase
        .from("cody_insights")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", id);
    },
    [],
  );

  return { insights, loading, refresh: fetchInsights, dismiss };
}
