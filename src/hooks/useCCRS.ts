import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";
import { useProfile } from "@/lib/profile";
import {
  CCRS_CATEGORIES, CCRSCategory,
  generateStrainCSV, generateAreaCSV, generateProductCSV, generatePlantCSV,
  generatePlantDestructionCSV, generatePlantTransferCSV, generateInventoryCSV,
  generateInventoryAdjustmentCSV, generateInventoryTransferCSV, generateLabTestCSV,
  generateSaleCSV, generateHarvestCSV,
} from "@/lib/ccrs/generators";
import { generateManifestCSV } from "@/lib/ccrs/generateManifestCSV";
import { validateCCRS, ValidationResult, RecordLike } from "@/lib/ccrs/validateCCRS";
import { getGroupForKind, CCRSUploadKind } from "@/lib/ccrs/uploadOrder";
import { filename } from "@/lib/ccrs/csvHelpers";

export interface CCRSCategoryStatus {
  category: CCRSCategory;
  groupOrder: 1 | 2 | 3 | 4;
  lastUploadedAt: string | null;
  lastStatus: string | null;
  pendingRecords: number;
  errorsCount: number | null;
}

const CATEGORY_TO_KIND: Record<CCRSCategory, CCRSUploadKind> = {
  strain: "Strain", area: "Area", product: "Product", plant: "Plant",
  plantdestruction: "PlantDestruction", planttransfer: "PlantTransfer",
  inventory: "Inventory", inventoryadjustment: "InventoryAdjustment",
  inventorytransfer: "InventoryTransfer", labtest: "LabTest",
  sale: "Sale", harvest: "Harvest", manifest: "Manifest",
};

const CATEGORY_TABLE: Record<CCRSCategory, string> = {
  strain: "grow_strains",
  area: "grow_areas",
  product: "grow_products",
  plant: "grow_plants",
  plantdestruction: "grow_disposals",
  planttransfer: "grow_plants",
  inventory: "grow_batches",
  inventoryadjustment: "grow_inventory_adjustments",
  inventorytransfer: "grow_manifests",
  labtest: "grow_qa_results",
  sale: "grow_orders",
  harvest: "grow_harvests",
  manifest: "grow_manifests",
};

/**
 * Column to diff against for "what changed since the last CCRS upload?".
 * Most tables expose updated_at; immutable log tables (disposals, adjustments,
 * qa_results) only have created_at. Falling back to created_at is safe because
 * those rows never get updated after insert.
 */
const CATEGORY_CHANGE_COLUMN: Record<CCRSCategory, string> = {
  strain: "updated_at",
  area: "updated_at",
  product: "updated_at",
  plant: "updated_at",
  plantdestruction: "created_at",
  planttransfer: "updated_at",
  inventory: "updated_at",
  inventoryadjustment: "created_at",
  inventorytransfer: "updated_at",
  labtest: "created_at",
  sale: "updated_at",
  harvest: "updated_at",
  manifest: "updated_at",
};

export function useCCRSStatus() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<CCRSCategoryStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Latest submission per category
      const { data: submissions } = await supabase
        .from("grow_ccrs_submission_files")
        .select("*").eq("org_id", orgId)
        .order("uploaded_at", { ascending: false, nullsFirst: false });
      const latestByCategory = new Map<string, any>();
      (submissions ?? []).forEach((s: any) => {
        if (!latestByCategory.has(s.file_category)) latestByCategory.set(s.file_category, s);
      });

      // Per category, count unreported records
      const statuses: CCRSCategoryStatus[] = [];
      for (const cat of CCRS_CATEGORIES) {
        const latest = latestByCategory.get(cat);
        const table = CATEGORY_TABLE[cat];
        const changeCol = CATEGORY_CHANGE_COLUMN[cat];
        const since = latest?.uploaded_at ?? "1970-01-01";
        const { count } = await supabase.from(table).select("*", { count: "exact", head: true })
          .eq("org_id", orgId).gt(changeCol, since);
        const group = getGroupForKind(CATEGORY_TO_KIND[cat]);
        statuses.push({
          category: cat,
          groupOrder: group.order,
          lastUploadedAt: latest?.uploaded_at ?? null,
          lastStatus: latest?.status ?? null,
          pendingRecords: count ?? 0,
          errorsCount: latest?.errors_count ?? null,
        });
      }
      if (cancelled) return;
      setData(statuses);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export interface GeneratedCSV {
  category: CCRSCategory;
  filename: string;
  content: string;
  recordCount: number;
  recordIds: string[];
  validation: ValidationResult;
}

export function useGenerateCSV() {
  const { orgId } = useOrg();
  const { profile } = useProfile();

  return useCallback(async (category: CCRSCategory, licenseNumber: string): Promise<GeneratedCSV> => {
    if (!orgId) throw new Error("No active org");
    const submittedBy = profile?.full_name ?? "system";
    const header = { submittedBy, submittedDate: new Date(), numberRecords: 0 };

    const { data: latestSubmissions } = await supabase.from("grow_ccrs_submission_files")
      .select("*").eq("org_id", orgId).eq("file_category", category)
      .order("uploaded_at", { ascending: false, nullsFirst: false }).limit(1);
    const since = ((latestSubmissions ?? []) as any[])[0]?.uploaded_at ?? "1970-01-01";

    let content = "";
    let recordIds: string[] = [];
    let validation: ValidationResult = { valid: true, errors: [], warnings: [] };

    switch (category) {
      case "strain": {
        const { data: rows } = await supabase.from("grow_strains").select("*").eq("org_id", orgId).gt("updated_at", since);
        recordIds = ((rows ?? []) as any[]).map((r) => r.id);
        content = generateStrainCSV(header, ((rows ?? []) as any[]).map((r) => ({
          externalIdentifier: r.external_id, licenseNumber,
          name: r.name, strainType: r.type ?? "Hybrid",
          createdBy: r.ccrs_created_by_username ?? submittedBy, createdDate: new Date(r.created_at ?? Date.now()),
        })));
        break;
      }
      case "area": {
        const { data: rows } = await supabase.from("grow_areas").select("*").eq("org_id", orgId).gt("updated_at", since);
        recordIds = ((rows ?? []) as any[]).map((r) => r.id);
        content = generateAreaCSV(header, ((rows ?? []) as any[]).map((r) => ({
          externalIdentifier: r.external_id, licenseNumber,
          name: r.name, isQuarantine: r.is_quarantine ?? false,
          createdBy: r.ccrs_created_by_username ?? submittedBy, createdDate: new Date(r.created_at ?? Date.now()),
        })));
        break;
      }
      case "product": {
        const { data: rows } = await supabase.from("grow_products").select("*").eq("org_id", orgId).gt("updated_at", since);
        recordIds = ((rows ?? []) as any[]).map((r) => r.id);
        content = generateProductCSV(header, ((rows ?? []) as any[]).map((r) => ({
          externalIdentifier: r.external_id, licenseNumber,
          name: r.name, description: r.description,
          inventoryCategory: r.ccrs_inventory_category ?? "EndProduct",
          inventoryType: r.ccrs_inventory_type ?? "Flower Lot",
          unitWeightGrams: r.unit_weight_grams,
          createdBy: r.ccrs_created_by_username ?? submittedBy, createdDate: new Date(r.created_at ?? Date.now()),
        })));
        break;
      }
      case "plant": {
        const { data: rows } = await supabase.from("grow_plants").select("*").eq("org_id", orgId).gt("updated_at", since);
        const strainIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.strain_id).filter(Boolean)));
        const areaIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.area_id).filter(Boolean)));
        const [sRes, aRes] = await Promise.all([
          strainIds.length > 0 ? supabase.from("grow_strains").select("id, external_id").in("id", strainIds) : Promise.resolve({ data: [] }),
          areaIds.length > 0 ? supabase.from("grow_areas").select("id, external_id").in("id", areaIds) : Promise.resolve({ data: [] }),
        ]);
        const sExt = new Map<string, string>((sRes.data ?? []).map((s: any) => [s.id, s.external_id]));
        const aExt = new Map<string, string>((aRes.data ?? []).map((a: any) => [a.id, a.external_id]));
        recordIds = ((rows ?? []) as any[]).map((r) => r.id);
        content = generatePlantCSV(header, ((rows ?? []) as any[]).map((r) => ({
          externalIdentifier: r.external_id, licenseNumber,
          areaExternalIdentifier: r.area_id ? aExt.get(r.area_id) ?? null : null,
          strainExternalIdentifier: r.strain_id ? sExt.get(r.strain_id) ?? null : null,
          plantSource: r.source_type === "seed" ? "Seed" : r.source_type === "clone" ? "Clone" : r.source_type === "tissue_culture" ? "TissueCulture" : null,
          plantState: r.ccrs_plant_state ?? "Growing",
          growthStage: r.phase === "vegetative" ? "Vegetative" : r.phase === "flowering" || r.phase === "ready_for_harvest" ? "Flowering" : r.phase === "immature" ? "Immature" : null,
          harvestCycle: r.harvest_cycle_months ?? null,
          motherPlant: r.mother_plant_id,
          plantIdentifier: r.plant_identifier,
          harvestDate: r.harvest_date,
          isMotherPlant: r.is_mother_plant ?? false,
          createdBy: submittedBy, createdDate: new Date(r.created_at ?? Date.now()),
        })));
        break;
      }
      case "plantdestruction": {
        const { data: rows } = await supabase.from("grow_disposals").select("*").eq("org_id", orgId).eq("disposal_type", "plant").gt("updated_at", since);
        recordIds = ((rows ?? []) as any[]).map((r) => r.id);
        const out: any[] = [];
        for (const r of (rows ?? []) as any[]) {
          for (const pid of (r.plant_ids ?? []) as string[]) {
            const { data: plant } = await supabase.from("grow_plants").select("external_id").eq("id", pid).maybeSingle();
            out.push({
              externalIdentifier: r.external_id, licenseNumber,
              plantExternalIdentifier: plant?.external_id ?? pid,
              destructionReason: r.ccrs_destruction_reason ?? r.reason,
              destructionMethod: r.ccrs_destruction_method ?? r.destruction_method,
              destructionDate: r.destroyed_at ?? r.created_at ?? new Date(),
              createdBy: r.ccrs_created_by_username ?? submittedBy, createdDate: new Date(r.created_at ?? Date.now()),
            });
          }
        }
        content = generatePlantDestructionCSV({ ...header, numberRecords: out.length }, out);
        break;
      }
      case "planttransfer": {
        content = generatePlantTransferCSV({ ...header, numberRecords: 0 }, []);
        break;
      }
      case "inventory": {
        const { data: rows } = await supabase.from("grow_batches").select("*").eq("org_id", orgId).gt("updated_at", since);
        const strainIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.strain_id).filter(Boolean)));
        const areaIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.area_id).filter(Boolean)));
        const productIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.product_id).filter(Boolean)));
        const [sRes, aRes, pRes] = await Promise.all([
          strainIds.length > 0 ? supabase.from("grow_strains").select("id, external_id").in("id", strainIds) : Promise.resolve({ data: [] }),
          areaIds.length > 0 ? supabase.from("grow_areas").select("id, external_id").in("id", areaIds) : Promise.resolve({ data: [] }),
          productIds.length > 0 ? supabase.from("grow_products").select("id, external_id").in("id", productIds) : Promise.resolve({ data: [] }),
        ]);
        const sExt = new Map<string, string>((sRes.data ?? []).map((s: any) => [s.id, s.external_id]));
        const aExt = new Map<string, string>((aRes.data ?? []).map((a: any) => [a.id, a.external_id]));
        const pExt = new Map<string, string>((pRes.data ?? []).map((p: any) => [p.id, p.external_id]));
        recordIds = ((rows ?? []) as any[]).map((r) => r.id);
        const input = ((rows ?? []) as any[]).map((r) => ({
          externalIdentifier: r.external_id, licenseNumber,
          strainExternalIdentifier: r.strain_id ? sExt.get(r.strain_id) ?? null : null,
          areaExternalIdentifier: r.area_id ? aExt.get(r.area_id) ?? null : null,
          productExternalIdentifier: r.product_id ? pExt.get(r.product_id) ?? null : null,
          initialQuantity: Number(r.initial_quantity ?? 0),
          quantityOnHand: Number(r.current_quantity ?? 0),
          totalCost: r.unit_cost != null ? Number(r.unit_cost) * Number(r.initial_quantity ?? 0) : null,
          isMedical: r.is_medical ?? false,
          createdBy: r.ccrs_created_by_username ?? submittedBy, createdDate: new Date(r.created_at ?? Date.now()),
        }));
        content = generateInventoryCSV(header, input);
        validation = validateCCRS("inventory", input.map((r) => ({
          external_id: r.externalIdentifier, license_number: r.licenseNumber,
          initial_quantity: r.initialQuantity, quantity_on_hand: r.quantityOnHand,
          strain_external_identifier: r.strainExternalIdentifier, area_external_identifier: r.areaExternalIdentifier,
          product_external_identifier: r.productExternalIdentifier,
        }) as RecordLike));
        break;
      }
      case "inventoryadjustment": {
        const { data: rows } = await supabase.from("grow_inventory_adjustments").select("*").eq("org_id", orgId).gt("created_at", since);
        const batchIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.batch_id).filter(Boolean)));
        const { data: batches } = batchIds.length > 0
          ? await supabase.from("grow_batches").select("id, external_id").in("id", batchIds)
          : { data: [] };
        const bExt = new Map<string, string>((batches ?? []).map((b: any) => [b.id, b.external_id]));
        recordIds = ((rows ?? []) as any[]).map((r) => r.id);
        content = generateInventoryAdjustmentCSV(header, ((rows ?? []) as any[]).map((r) => ({
          externalIdentifier: r.external_id, licenseNumber,
          inventoryExternalIdentifier: bExt.get(r.batch_id) ?? r.batch_id,
          adjustmentReason: r.adjustment_reason,
          adjustmentDetail: r.adjustment_detail,
          quantity: Number(r.quantity_delta ?? 0),
          adjustmentDate: r.adjustment_date,
          createdBy: r.ccrs_created_by_username ?? submittedBy, createdDate: new Date(r.created_at ?? Date.now()),
        })));
        break;
      }
      case "inventorytransfer": {
        content = generateInventoryTransferCSV({ ...header, numberRecords: 0 }, []);
        break;
      }
      case "labtest": {
        const { data: rows } = await supabase.from("grow_qa_results").select("*").eq("org_id", orgId).gt("updated_at", since);
        const lotIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.qa_lot_id).filter(Boolean)));
        const { data: lots } = lotIds.length > 0
          ? await supabase.from("grow_qa_lots").select("id, parent_batch_id").in("id", lotIds)
          : { data: [] };
        const lotToBatch = new Map<string, string>((lots ?? []).map((l: any) => [l.id, l.parent_batch_id]));
        const batchIds = Array.from(new Set(((lots ?? []) as any[]).map((l) => l.parent_batch_id).filter(Boolean)));
        const { data: batches } = batchIds.length > 0
          ? await supabase.from("grow_batches").select("id, external_id").in("id", batchIds)
          : { data: [] };
        const bExt = new Map<string, string>((batches ?? []).map((b: any) => [b.id, b.external_id]));
        recordIds = ((rows ?? []) as any[]).map((r) => r.id);
        content = generateLabTestCSV(header, ((rows ?? []) as any[]).map((r) => {
          const batchId = lotToBatch.get(r.qa_lot_id);
          return {
            externalIdentifier: r.id, licenseNumber,
            labLicenseNumber: r.lab_license_number,
            labTestStatus: r.lab_test_status ?? "Pass",
            inventoryExternalIdentifier: batchId ? bExt.get(batchId) ?? null : null,
            testName: r.test_name,
            testDate: r.test_date,
            testValue: r.test_value,
            createdBy: r.ccrs_created_by_username ?? submittedBy, createdDate: new Date(r.created_at ?? Date.now()),
          };
        }));
        break;
      }
      case "sale": {
        const { data: orders } = await supabase.from("grow_orders").select("*").eq("org_id", orgId).eq("status", "completed").gt("updated_at", since);
        const orderIds = ((orders ?? []) as any[]).map((o) => o.id);
        const accountIds = Array.from(new Set(((orders ?? []) as any[]).map((o) => o.account_id).filter(Boolean)));
        const [itemsRes, accountsRes] = await Promise.all([
          orderIds.length > 0 ? supabase.from("grow_order_items").select("*").in("order_id", orderIds) : Promise.resolve({ data: [] }),
          accountIds.length > 0 ? supabase.from("grow_accounts").select("id, license_number").in("id", accountIds) : Promise.resolve({ data: [] }),
        ]);
        const itemIds = ((itemsRes.data ?? []) as any[]).map((i) => i.id);
        const { data: allocs } = itemIds.length > 0
          ? await supabase.from("grow_order_allocations").select("*").in("order_item_id", itemIds)
          : { data: [] };
        const batchIds = Array.from(new Set(((allocs ?? []) as any[]).map((a) => a.batch_id).filter(Boolean)));
        const { data: batches } = batchIds.length > 0
          ? await supabase.from("grow_batches").select("id, external_id").in("id", batchIds)
          : { data: [] };
        const accountById = new Map<string, any>((accountsRes.data ?? []).map((a: any) => [a.id, a]));
        const bExt = new Map<string, string>((batches ?? []).map((b: any) => [b.id, b.external_id]));
        const itemById = new Map<string, any>(((itemsRes.data ?? []) as any[]).map((i) => [i.id, i]));
        const ordersById = new Map<string, any>(((orders ?? []) as any[]).map((o) => [o.id, o]));
        recordIds = ((allocs ?? []) as any[]).map((a) => a.id);
        const saleRecords = ((allocs ?? []) as any[]).map((a) => {
          const item = itemById.get(a.order_item_id);
          const order = item ? ordersById.get(item.order_id) : null;
          const account = order ? accountById.get(order.account_id) : null;
          return {
            saleExternalIdentifier: order?.sale_external_identifier ?? order?.id,
            saleDetailExternalIdentifier: item?.sale_detail_external_identifier ?? item?.id,
            licenseNumber, soldToLicenseNumber: account?.license_number ?? "",
            saleType: order?.sale_type ?? "Wholesale",
            saleDate: order?.completed_at ?? order?.created_at ?? new Date(),
            inventoryExternalIdentifier: bExt.get(a.batch_id) ?? null,
            plantExternalIdentifier: null,
            quantity: Number(a.quantity ?? 0),
            unitPrice: Number(item?.unit_price ?? 0),
            discount: item?.discount,
            salesTax: item?.sales_tax,
            otherTax: item?.other_tax,
            createdBy: submittedBy, createdDate: new Date(a.created_at ?? Date.now()),
          };
        });
        content = generateSaleCSV(header, saleRecords);
        break;
      }
      case "harvest": {
        const { data: rows } = await supabase.from("grow_harvests").select("*").eq("org_id", orgId).gt("updated_at", since);
        const strainIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.strain_id).filter(Boolean)));
        const areaIds = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.area_id).filter(Boolean)));
        const [sRes, aRes] = await Promise.all([
          strainIds.length > 0 ? supabase.from("grow_strains").select("id, external_id").in("id", strainIds) : Promise.resolve({ data: [] }),
          areaIds.length > 0 ? supabase.from("grow_areas").select("id, external_id").in("id", areaIds) : Promise.resolve({ data: [] }),
        ]);
        const sExt = new Map<string, string>((sRes.data ?? []).map((s: any) => [s.id, s.external_id]));
        const aExt = new Map<string, string>((aRes.data ?? []).map((a: any) => [a.id, a.external_id]));
        recordIds = ((rows ?? []) as any[]).map((r) => r.id);
        content = generateHarvestCSV(header, ((rows ?? []) as any[]).map((r) => ({
          externalIdentifier: r.ccrs_external_identifier ?? r.id, licenseNumber,
          areaExternalIdentifier: r.area_id ? aExt.get(r.area_id) ?? null : null,
          strainExternalIdentifier: r.strain_id ? sExt.get(r.strain_id) ?? null : null,
          flowerLotExternalIdentifier: r.flower_lot_external_id,
          otherMaterialLotExternalIdentifier: r.other_material_lot_external_id,
          flowerLotWeightGrams: r.flower_lot_weight_grams,
          otherMaterialWeightGrams: r.other_material_weight_grams,
          wasteWeightGrams: r.waste_weight_grams,
          totalPlantsHarvested: r.total_plants_harvested,
          harvestDate: r.harvest_started_at,
          createdBy: submittedBy, createdDate: new Date(r.created_at ?? Date.now()),
        })));
        break;
      }
      case "manifest": {
        const { data: rows } = await supabase.from("grow_manifests").select("*").eq("org_id", orgId).neq("manifest_type", "inbound").gt("updated_at", since);
        recordIds = ((rows ?? []) as any[]).map((r) => r.id);
        // Build one CSV per manifest — concatenate headers aren't valid for CCRS but for preview this is ok;
        // in practice each manifest generates its own file via the ManifestDetailPage.
        if ((rows ?? []).length === 0) {
          content = generateManifestCSV({ submittedBy, manifest: { externalIdentifier: "", originLicenseNumber: licenseNumber, originLicenseeName: null, originAddress: null, originPhone: null, originEmail: null, destinationLicenseNumber: "", destinationLicenseeName: null, destinationAddress: null, destinationPhone: null, destinationEmail: null, transportationType: null, transporterLicenseNumber: null, driverName: null, driverLicenseNumber: null, vehicleMake: null, vehicleModel: null, vehicleYear: null, vehicleColor: null, vehicleVIN: null, vehicleLicensePlate: null, departureDateTime: null, arrivalDateTime: null }, items: [] });
        } else {
          const m = (rows as any[])[0];
          content = generateManifestCSV({
            submittedBy, submittedDate: new Date(),
            manifest: {
              externalIdentifier: m.external_id, originLicenseNumber: m.origin_license_number,
              originLicenseeName: m.origin_license_name, originAddress: m.origin_address,
              originPhone: m.origin_phone, originEmail: m.origin_email,
              destinationLicenseNumber: m.destination_license_number, destinationLicenseeName: m.destination_license_name,
              destinationAddress: m.destination_address, destinationPhone: m.destination_phone, destinationEmail: m.destination_email,
              transportationType: m.transportation_type, transporterLicenseNumber: m.transporter_license_number,
              driverName: m.driver_name, driverLicenseNumber: m.driver_license_number,
              vehicleMake: m.vehicle_make, vehicleModel: m.vehicle_model, vehicleYear: m.vehicle_year,
              vehicleColor: m.vehicle_color, vehicleVIN: m.vehicle_vin, vehicleLicensePlate: m.vehicle_license_plate,
              departureDateTime: m.departure_datetime, arrivalDateTime: m.arrival_datetime,
            },
            items: [],
          });
        }
        break;
      }
    }

    return {
      category,
      filename: filename(category, licenseNumber),
      content,
      recordCount: recordIds.length,
      recordIds,
      validation,
    };
  }, [orgId, profile]);
}

export function useCCRSSubmissions() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user || !orgId) { setData([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("grow_ccrs_submission_files").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
      if (cancelled) return;
      setData(rows ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, orgId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, refresh };
}

export function useRecordSubmission() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const { profile } = useProfile();
  return useCallback(async (csv: GeneratedCSV, licenseNumber: string) => {
    if (!orgId) throw new Error("No active org");
    const { data, error } = await supabase.from("grow_ccrs_submission_files").insert({
      org_id: orgId,
      file_category: csv.category,
      file_name: csv.filename,
      license_number: licenseNumber,
      number_records: csv.recordCount,
      record_ids: csv.recordIds,
      file_size_bytes: new Blob([csv.content]).size,
      status: "uploaded",
      submitted_by_username: profile?.full_name ?? "system",
      submitted_date: new Date().toISOString(),
      uploaded_at: new Date().toISOString(),
      errors_count: csv.validation.errors.length,
      created_by: user?.id ?? null,
    }).select("*").single();
    if (error) throw error;
    return data;
  }, [orgId, user?.id, profile]);
}

export function useCCRSStats(statuses: CCRSCategoryStatus[]) {
  return useMemo(() => ({
    total: statuses.length,
    upToDate: statuses.filter((s) => s.pendingRecords === 0 && s.lastUploadedAt).length,
    pending: statuses.filter((s) => s.pendingRecords > 0).length,
    errors: statuses.filter((s) => (s.errorsCount ?? 0) > 0).length,
    totalPendingRecords: statuses.reduce((sum, s) => sum + s.pendingRecords, 0),
  }), [statuses]);
}
