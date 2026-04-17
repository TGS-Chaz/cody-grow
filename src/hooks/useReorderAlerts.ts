import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export interface LowStockBatch {
  id: string;
  barcode: string;
  current_quantity: number;
  reorder_point: number;
  product_name: string | null;
}

/**
 * Scans for batches where `current_quantity > 0 AND <= reorder_point AND reorder_point IS NOT NULL`.
 * Returns the list and, on first load, inserts a one-time `low_stock` notification
 * for each (deduped by entity_id + event_key). Safe to call from multiple pages.
 */
export function useReorderAlerts() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<LowStockBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: batches, error } = await supabase.from("grow_batches")
        .select("id, barcode, current_quantity, reorder_point, product_id")
        .eq("org_id", orgId)
        .gt("current_quantity", 0)
        .not("reorder_point", "is", null);
      if (cancelled) return;
      if (error) { console.warn("[reorder-alerts]", error.message); setLoading(false); return; }
      // reorder_point filter done client-side because Supabase can't compare two columns
      const low = ((batches ?? []) as any[])
        .filter((b) => Number(b.current_quantity) <= Number(b.reorder_point))
        .map((b) => ({ id: b.id, barcode: b.barcode, current_quantity: Number(b.current_quantity), reorder_point: Number(b.reorder_point), product_id: b.product_id }));

      // Enrich with product names (best effort)
      const productIds = Array.from(new Set(low.map((b) => b.product_id).filter(Boolean)));
      let productById = new Map<string, any>();
      if (productIds.length > 0) {
        const { data: products } = await supabase.from("grow_products").select("id, name").in("id", productIds);
        productById = new Map(((products ?? []) as any[]).map((p) => [p.id, p]));
      }
      const enriched: LowStockBatch[] = low.map((b) => ({
        id: b.id, barcode: b.barcode, current_quantity: b.current_quantity, reorder_point: b.reorder_point,
        product_name: b.product_id ? productById.get(b.product_id)?.name ?? null : null,
      }));
      if (cancelled) return;
      setData(enriched);
      setLoading(false);

      // Create notifications (deduped)
      for (const b of enriched) {
        const { data: existing } = await supabase
          .from("grow_in_app_notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("entity_type", "batch")
          .eq("entity_id", b.id)
          .eq("event_key", "low_stock")
          .maybeSingle();
        if (existing) continue;
        await supabase.from("grow_in_app_notifications").insert({
          org_id: orgId,
          user_id: user.id,
          event_key: "low_stock",
          title: `Low stock: ${b.product_name ?? b.barcode}`,
          content: `${b.current_quantity.toFixed(0)} on hand · reorder point ${b.reorder_point}`,
          action_url: `/inventory/batches/${b.id}`,
          entity_type: "batch",
          entity_id: b.id,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}
