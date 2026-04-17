/**
 * CCRS pre-flight risk assessment — learns from this org's previous rejected
 * submissions to flag records that resemble rejection patterns.
 */

import { supabase } from "@/lib/supabase";

export interface CCRSRiskPrediction {
  record_id: string;
  risk: "low" | "medium" | "high";
  reason: string;
}

export interface CCRSRiskAssessment {
  predictions: CCRSRiskPrediction[];
  patterns_learned: string[];
  rejection_rate: number; // 0-1
}

/**
 * @param category CCRS category (strain/area/product/inventory/etc.)
 * @param records Current records being validated — expected shape: { id, ... common CCRS-like fields ... }
 */
export async function predictRejections(
  orgId: string,
  category: string,
  records: Array<{ id: string; [key: string]: any }>,
): Promise<CCRSRiskAssessment> {
  const { data: submissions } = await supabase.from("grow_ccrs_submission_files")
    .select("status, errors_count, ccrs_error_details, number_records")
    .eq("org_id", orgId).eq("file_category", category);
  const rows = (submissions ?? []) as any[];
  const totalSubmissions = rows.length;
  const rejected = rows.filter((s) => s.status === "rejected" || s.status === "rejected_partial");
  const rejectionRate = totalSubmissions > 0 ? rejected.length / totalSubmissions : 0;

  // Learn patterns from past error details (free-text, so we use keyword heuristics)
  const patterns = new Set<string>();
  const errorKeywords: string[] = [];
  for (const r of rejected) {
    const detail = String(r.ccrs_error_details ?? "").toLowerCase();
    if (!detail) continue;
    // Common CCRS error signals
    if (detail.includes("external identifier") || detail.includes("externalidentifier")) {
      patterns.add("ExternalIdentifier formatting issues");
      errorKeywords.push("external_id");
    }
    if (detail.includes("license")) {
      patterns.add("LicenseNumber issues (missing or wrong format)");
      errorKeywords.push("license_number");
    }
    if (detail.includes("quantity")) {
      patterns.add("Quantity mismatch (e.g., QuantityOnHand > InitialQuantity)");
      errorKeywords.push("quantity");
    }
    if (detail.includes("not found") || detail.includes("reference")) {
      patterns.add("Referenced entity not uploaded (upload group order issue)");
      errorKeywords.push("reference");
    }
    if (detail.includes("invalid") && detail.includes("state")) {
      patterns.add("Invalid PlantState value (not in CCRS enum)");
      errorKeywords.push("plant_state");
    }
  }

  const predictions: CCRSRiskPrediction[] = [];

  for (const rec of records) {
    let risk: "low" | "medium" | "high" = "low";
    const reasons: string[] = [];

    // Check external ID format (17 digits required)
    const extId = rec.external_id ?? rec.ExternalIdentifier;
    if (extId && !/^\d{17}$/.test(String(extId))) {
      if (errorKeywords.includes("external_id")) { risk = "high"; reasons.push("ExternalIdentifier format matches previously rejected pattern"); }
      else { risk = "medium"; reasons.push("ExternalIdentifier isn't 17 digits — CCRS may normalize or reject"); }
    }

    // Check license number
    const license = rec.license_number ?? rec.LicenseNumber;
    if (!license && errorKeywords.includes("license_number")) {
      risk = "high"; reasons.push("Missing LicenseNumber — common rejection pattern for this org");
    }

    // Check quantity ordering
    const initial = Number(rec.initial_quantity ?? rec.InitialQuantity ?? 0);
    const onHand = Number(rec.current_quantity ?? rec.quantity_on_hand ?? rec.QuantityOnHand ?? 0);
    if (onHand > initial && initial > 0) {
      risk = "high"; reasons.push(`QuantityOnHand (${onHand}) exceeds InitialQuantity (${initial}) — CCRS rejects this`);
    }

    predictions.push({
      record_id: rec.id,
      risk,
      reason: reasons.length > 0 ? reasons.join(" · ") : "No known rejection patterns detected",
    });
  }

  return {
    predictions,
    patterns_learned: Array.from(patterns),
    rejection_rate: Math.round(rejectionRate * 100) / 100,
  };
}
