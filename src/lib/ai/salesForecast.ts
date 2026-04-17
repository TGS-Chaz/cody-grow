/**
 * Sales forecasting — projects per-product demand using order history + trend.
 * Compares to current inventory to flag surplus/deficit.
 */

import { supabase } from "@/lib/supabase";
import { trend } from "./stats";

export interface ProductForecast {
  product_id: string;
  product_name: string;
  projected_demand_grams: number;
  current_inventory_grams: number;
  surplus_or_deficit: number;
  trend: "up" | "down" | "flat";
  coverage_pct: number;
  ordered_30d: number;
  ordered_60d: number;
  ordered_90d: number;
}

export interface SalesForecast {
  forecasts: ProductForecast[];
  total_projected_revenue: number;
  total_coverage_pct: number;
  days_ahead: number;
}

export async function forecastDemand(orgId: string, daysAhead: number = 30): Promise<SalesForecast> {
  const start180 = new Date(Date.now() - 180 * 86400000).toISOString();
  const { data: orders } = await supabase.from("grow_orders")
    .select("id, created_at").eq("org_id", orgId).eq("status", "completed")
    .gte("created_at", start180);
  const orderIds = ((orders ?? []) as any[]).map((o) => o.id);
  const orderDate = new Map<string, string>(((orders ?? []) as any[]).map((o) => [o.id, o.created_at]));
  const { data: items } = orderIds.length > 0
    ? await supabase.from("grow_order_items").select("order_id, product_id, quantity, unit_price").in("order_id", orderIds)
    : { data: [] };

  const now = Date.now();
  const windows = { d30: now - 30 * 86400000, d60: now - 60 * 86400000, d90: now - 90 * 86400000 };
  const byProduct = new Map<string, { d30: number; d60: number; d90: number; d60_prev: number; d90_prev: number }>();

  ((items ?? []) as any[]).forEach((i) => {
    const when = orderDate.get(i.order_id);
    if (!when) return;
    const t = new Date(when).getTime();
    const q = Number(i.quantity ?? 0);
    const stats = byProduct.get(i.product_id) ?? { d30: 0, d60: 0, d90: 0, d60_prev: 0, d90_prev: 0 };
    if (t >= windows.d30) stats.d30 += q;
    if (t >= windows.d60) stats.d60 += q;
    if (t >= windows.d90) stats.d90 += q;
    if (t < windows.d60 && t >= windows.d60 - 30 * 86400000) stats.d60_prev += q;
    if (t < windows.d90 && t >= windows.d90 - 30 * 86400000) stats.d90_prev += q;
    byProduct.set(i.product_id, stats);
  });

  const productIds = Array.from(byProduct.keys());
  const [productsRes, batchesRes] = await Promise.all([
    productIds.length > 0 ? supabase.from("grow_products").select("id, name, unit_price").in("id", productIds) : Promise.resolve({ data: [] }),
    productIds.length > 0 ? supabase.from("grow_batches").select("product_id, current_weight_grams, current_quantity").in("product_id", productIds).eq("is_available", true).gt("current_quantity", 0) : Promise.resolve({ data: [] }),
  ]);
  const productById = new Map<string, any>((productsRes.data ?? []).map((p: any) => [p.id, p]));
  const inventoryByProduct = new Map<string, number>();
  ((batchesRes.data ?? []) as any[]).forEach((b) => {
    inventoryByProduct.set(b.product_id, (inventoryByProduct.get(b.product_id) ?? 0) + Number(b.current_weight_grams ?? b.current_quantity ?? 0));
  });

  const forecasts: ProductForecast[] = [];
  let totalRevenue = 0;
  let weightedCoverageNum = 0;
  let weightedCoverageDen = 0;

  for (const [pid, s] of byProduct.entries()) {
    const product = productById.get(pid);
    if (!product) continue;
    // Monthly rate = most recent month; adjust by trend vs prior months
    const monthlyValues = [s.d30, s.d60 - s.d30, s.d90 - s.d60].filter((v) => v >= 0).reverse();
    const t = trend(monthlyValues);
    const baseRate = s.d30; // grams per 30 days
    const adjusted = baseRate * (1 + t.slope);
    const projected = adjusted * (daysAhead / 30);
    const inventory = inventoryByProduct.get(pid) ?? 0;
    const coverage = projected > 0 ? Math.min(1, inventory / projected) : 1;
    const unitPrice = Number(product.unit_price ?? 0);
    totalRevenue += projected * unitPrice;
    weightedCoverageNum += coverage * projected;
    weightedCoverageDen += projected;

    forecasts.push({
      product_id: pid,
      product_name: product.name,
      projected_demand_grams: Math.round(projected),
      current_inventory_grams: Math.round(inventory),
      surplus_or_deficit: Math.round(inventory - projected),
      trend: t.direction,
      coverage_pct: Math.round(coverage * 100),
      ordered_30d: Math.round(s.d30),
      ordered_60d: Math.round(s.d60),
      ordered_90d: Math.round(s.d90),
    });
  }

  forecasts.sort((a, b) => b.projected_demand_grams - a.projected_demand_grams);

  return {
    forecasts,
    total_projected_revenue: Math.round(totalRevenue * 100) / 100,
    total_coverage_pct: weightedCoverageDen > 0 ? Math.round((weightedCoverageNum / weightedCoverageDen) * 100) : 100,
    days_ahead: daysAhead,
  };
}
