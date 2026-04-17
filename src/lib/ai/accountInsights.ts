/**
 * Per-account AI intelligence — reorder prediction, preferences, churn risk,
 * upsell opportunities based on what similar accounts buy.
 */

import { supabase } from "@/lib/supabase";
import { mean, stdDev } from "./stats";

export interface AccountInsights {
  reorder_prediction: { days_until_likely_order: number | null; confidence: "low" | "medium" | "high"; last_order_at: string | null };
  preferences: { top_products: Array<{ name: string; count: number; total_grams: number }>; preferred_strains: Array<{ name: string; count: number }>; category_split: Record<string, number> };
  risk: "healthy" | "declining" | "at_risk";
  risk_reason: string;
  upsell_opportunities: Array<{ product_name: string; product_id: string; reason: string }>;
  stats: { total_orders: number; total_revenue: number; avg_order_value: number };
}

export async function generateAccountInsights(accountId: string): Promise<AccountInsights | null> {
  const { data: orders } = await supabase.from("grow_orders")
    .select("id, total, created_at, status").eq("account_id", accountId)
    .not("status", "in", "(cancelled,draft)").order("created_at", { ascending: true });
  const rows = (orders ?? []) as any[];
  if (rows.length === 0) {
    return {
      reorder_prediction: { days_until_likely_order: null, confidence: "low", last_order_at: null },
      preferences: { top_products: [], preferred_strains: [], category_split: {} },
      risk: "healthy", risk_reason: "No orders yet — nothing to analyze.",
      upsell_opportunities: [],
      stats: { total_orders: 0, total_revenue: 0, avg_order_value: 0 },
    };
  }

  const orderIds = rows.map((o) => o.id);
  const { data: items } = orderIds.length > 0
    ? await supabase.from("grow_order_items").select("order_id, product_id, quantity").in("order_id", orderIds)
    : { data: [] };
  const productIds = Array.from(new Set(((items ?? []) as any[]).map((i) => i.product_id).filter(Boolean)));
  const { data: products } = productIds.length > 0
    ? await supabase.from("grow_products").select("id, name, category, strain_id").in("id", productIds)
    : { data: [] };
  const strainIds = Array.from(new Set(((products ?? []) as any[]).map((p) => p.strain_id).filter(Boolean)));
  const { data: strains } = strainIds.length > 0
    ? await supabase.from("grow_strains").select("id, name").in("id", strainIds)
    : { data: [] };
  const productById = new Map<string, any>((products ?? []).map((p: any) => [p.id, p]));
  const strainById = new Map<string, any>((strains ?? []).map((s: any) => [s.id, s]));

  // Reorder cadence
  const orderDates = rows.map((o) => new Date(o.created_at).getTime()).sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < orderDates.length; i++) {
    intervals.push((orderDates[i] - orderDates[i - 1]) / 86400000);
  }
  const avgInterval = intervals.length > 0 ? mean(intervals) : null;
  const cadenceSd = intervals.length > 1 ? stdDev(intervals) : 0;
  const cadenceConfidence: "low" | "medium" | "high" = intervals.length >= 5 && cadenceSd / (avgInterval || 1) < 0.3
    ? "high" : intervals.length >= 3 ? "medium" : "low";
  const lastOrderAt = rows[rows.length - 1].created_at;
  const daysSinceLast = (Date.now() - new Date(lastOrderAt).getTime()) / 86400000;
  const daysUntilNext = avgInterval != null ? Math.max(0, Math.round(avgInterval - daysSinceLast)) : null;

  // Preferences — top products, preferred strains, category split
  const productTotals = new Map<string, { count: number; grams: number }>();
  const strainCounts = new Map<string, number>();
  const categoryCounts: Record<string, number> = {};
  ((items ?? []) as any[]).forEach((i) => {
    const p = productById.get(i.product_id);
    if (!p) return;
    const pt = productTotals.get(i.product_id) ?? { count: 0, grams: 0 };
    pt.count += 1; pt.grams += Number(i.quantity ?? 0);
    productTotals.set(i.product_id, pt);
    if (p.strain_id) strainCounts.set(p.strain_id, (strainCounts.get(p.strain_id) ?? 0) + 1);
    const cat = p.category ?? "Other";
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + Number(i.quantity ?? 0);
  });
  const topProducts = Array.from(productTotals.entries())
    .map(([id, v]) => ({ name: productById.get(id)?.name ?? "—", count: v.count, total_grams: Math.round(v.grams) }))
    .sort((a, b) => b.total_grams - a.total_grams).slice(0, 5);
  const preferredStrains = Array.from(strainCounts.entries())
    .map(([id, count]) => ({ name: strainById.get(id)?.name ?? "—", count }))
    .sort((a, b) => b.count - a.count).slice(0, 3);

  // Risk classification
  let risk: AccountInsights["risk"] = "healthy";
  let riskReason = "Ordering cadence is steady.";
  if (avgInterval != null) {
    if (daysSinceLast > avgInterval * 1.5) { risk = "at_risk"; riskReason = `${Math.floor(daysSinceLast)} days since last order — typical cadence is ~${Math.round(avgInterval)} days.`; }
    else if (daysSinceLast > avgInterval * 1.1) { risk = "declining"; riskReason = `Slight slowdown — normally orders every ~${Math.round(avgInterval)} days.`; }
  } else if (daysSinceLast > 45) {
    risk = "at_risk"; riskReason = `${Math.floor(daysSinceLast)} days since last order.`;
  }

  // Upsell — products this account has NEVER bought but are category-similar to top products
  const purchasedIds = new Set(productTotals.keys());
  const topCategories = new Set(topProducts.map((tp) => productById.get(Array.from(productTotals.entries()).find(([, v]) => v.count === tp.count)?.[0] ?? "")?.category).filter(Boolean));
  const { data: allProducts } = await supabase.from("grow_products").select("id, name, category").eq("is_active", true);
  const upsell = ((allProducts ?? []) as any[])
    .filter((p) => !purchasedIds.has(p.id) && topCategories.has(p.category))
    .slice(0, 3)
    .map((p) => ({ product_id: p.id, product_name: p.name, reason: `Similar category (${p.category}) to their top purchases` }));

  const totalRevenue = rows.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const avgOrderValue = rows.length > 0 ? totalRevenue / rows.length : 0;

  return {
    reorder_prediction: { days_until_likely_order: daysUntilNext, confidence: cadenceConfidence, last_order_at: lastOrderAt },
    preferences: { top_products: topProducts, preferred_strains: preferredStrains, category_split: categoryCounts },
    risk, risk_reason: riskReason,
    upsell_opportunities: upsell,
    stats: { total_orders: rows.length, total_revenue: Math.round(totalRevenue * 100) / 100, avg_order_value: Math.round(avgOrderValue * 100) / 100 },
  };
}
