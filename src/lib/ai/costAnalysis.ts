/**
 * Cost analysis — cost-per-gram by strain, trend over time, opportunities.
 * Works with whatever cost data the org has entered (unit_cost on batches,
 * production inputs, etc.); gracefully degrades when data is thin.
 */

import { supabase } from "@/lib/supabase";
import { mean, trend } from "./stats";

export interface CostByStrain {
  strain_id: string;
  strain_name: string;
  cycle_count: number;
  avg_cost_per_gram: number;
  total_weight_g: number;
  total_cost: number;
}

export interface CostAnalysis {
  cost_per_gram_by_strain: CostByStrain[];
  trend_over_quarters: Array<{ quarter: string; avg_cost_per_gram: number }>;
  cost_drivers: string[];
  optimization_opportunities: string[];
  overall_avg_cost_per_gram: number;
}

export async function analyzeCosts(orgId: string, daysBack: number = 365): Promise<CostAnalysis> {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();
  const { data: batches } = await supabase.from("grow_batches")
    .select("id, strain_id, unit_cost, initial_weight_grams, initial_quantity, created_at")
    .eq("org_id", orgId).gte("created_at", since)
    .not("unit_cost", "is", null).gt("initial_quantity", 0);

  const rows = (batches ?? []) as any[];
  if (rows.length === 0) {
    return {
      cost_per_gram_by_strain: [],
      trend_over_quarters: [],
      cost_drivers: [],
      optimization_opportunities: ["No cost data yet — enter unit_cost on batches to see cost intelligence."],
      overall_avg_cost_per_gram: 0,
    };
  }

  const strainIds = Array.from(new Set(rows.map((r) => r.strain_id).filter(Boolean)));
  const { data: strains } = strainIds.length > 0
    ? await supabase.from("grow_strains").select("id, name").in("id", strainIds)
    : { data: [] };
  const strainById = new Map<string, string>(((strains ?? []) as any[]).map((s) => [s.id, s.name]));

  const byStrain = new Map<string, CostByStrain>();
  for (const b of rows) {
    const weight = Number(b.initial_weight_grams ?? b.initial_quantity ?? 0);
    const cost = Number(b.unit_cost ?? 0) * weight;
    if (!b.strain_id || weight <= 0) continue;
    const entry = byStrain.get(b.strain_id) ?? {
      strain_id: b.strain_id, strain_name: strainById.get(b.strain_id) ?? "—",
      cycle_count: 0, avg_cost_per_gram: 0, total_weight_g: 0, total_cost: 0,
    };
    entry.cycle_count += 1;
    entry.total_weight_g += weight;
    entry.total_cost += cost;
    byStrain.set(b.strain_id, entry);
  }

  const costPerStrain = Array.from(byStrain.values()).map((s) => ({
    ...s, avg_cost_per_gram: s.total_weight_g > 0 ? Math.round((s.total_cost / s.total_weight_g) * 100) / 100 : 0,
  })).sort((a, b) => b.avg_cost_per_gram - a.avg_cost_per_gram);

  // Quarterly trend
  const byQuarter = new Map<string, { cost: number; weight: number }>();
  for (const b of rows) {
    const d = new Date(b.created_at);
    const quarter = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    const weight = Number(b.initial_weight_grams ?? b.initial_quantity ?? 0);
    const cost = Number(b.unit_cost ?? 0) * weight;
    const q = byQuarter.get(quarter) ?? { cost: 0, weight: 0 };
    q.cost += cost; q.weight += weight;
    byQuarter.set(quarter, q);
  }
  const trendOverQuarters = Array.from(byQuarter.entries())
    .map(([quarter, v]) => ({ quarter, avg_cost_per_gram: v.weight > 0 ? Math.round((v.cost / v.weight) * 100) / 100 : 0 }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));

  const quarterlyValues = trendOverQuarters.map((q) => q.avg_cost_per_gram);
  const quarterlyTrend = trend(quarterlyValues);
  const allCostPerGram = costPerStrain.map((s) => s.avg_cost_per_gram);
  const overallAvg = mean(allCostPerGram);

  const drivers: string[] = [];
  const opportunities: string[] = [];

  if (quarterlyTrend.direction === "up" && quarterlyValues.length >= 2) {
    const pct = Math.round(quarterlyTrend.slope * 100);
    drivers.push(`Cost per gram has increased ~${pct}% per quarter over the last ${quarterlyValues.length} quarters.`);
  } else if (quarterlyTrend.direction === "down") {
    drivers.push(`Cost per gram has decreased — efficiencies are compounding.`);
  }

  const highOutliers = costPerStrain.filter((s) => s.avg_cost_per_gram > overallAvg * 1.3 && s.cycle_count >= 2);
  for (const h of highOutliers) {
    opportunities.push(`${h.strain_name}: $${h.avg_cost_per_gram.toFixed(2)}/g is ${Math.round(((h.avg_cost_per_gram / overallAvg) - 1) * 100)}% above your average. Review inputs or growing conditions for this strain.`);
  }

  if (opportunities.length === 0 && costPerStrain.length > 0) {
    opportunities.push("Cost per gram is consistent across strains — good baseline.");
  }

  return {
    cost_per_gram_by_strain: costPerStrain,
    trend_over_quarters: trendOverQuarters,
    cost_drivers: drivers,
    optimization_opportunities: opportunities,
    overall_avg_cost_per_gram: Math.round(overallAvg * 100) / 100,
  };
}
