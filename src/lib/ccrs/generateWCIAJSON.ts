/**
 * WCIA JSON generator for B2B data exchange between licensees.
 *
 * Based on the Cultivera-authored Distributed Data Exchange Specification.
 * Used to share transfer data between producers and retailers so both sides
 * can import matching records into their systems without re-keying.
 */

export interface WCIAManifestInput {
  manifest: {
    externalIdentifier: string;
    manifestType: string;
    departureDateTime: string | null;
    arrivalDateTime: string | null;
    notes?: string | null;
  };
  origin: {
    licenseNumber: string;
    licenseeName: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  destination: {
    licenseNumber: string;
    licenseeName: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  transportation?: {
    type: string | null;
    transporterLicenseNumber?: string | null;
    driverName?: string | null;
    driverLicenseNumber?: string | null;
    vehicleMake?: string | null;
    vehicleModel?: string | null;
    vehicleYear?: string | null;
    vehicleColor?: string | null;
    vehicleVIN?: string | null;
    vehicleLicensePlate?: string | null;
  };
  items: Array<{
    inventoryExternalIdentifier: string | null;
    plantExternalIdentifier?: string | null;
    productName: string | null;
    productCategory?: string | null;
    strainName?: string | null;
    quantity: number;
    unitPrice: number | null;
    servingsPerUnit?: number | null;
    unitWeightGrams?: number | null;
    labtestExternalIdentifier: string | null;
    qaResults?: {
      thcTotalPct?: number | null;
      cbdTotalPct?: number | null;
      totalTerpenesPct?: number | null;
      testDate?: string | null;
      labName?: string | null;
      coaUrls?: string[] | null;
    } | null;
  }>;
}

export interface WCIAOutput {
  version: "1.0";
  specification: "wcia-distributed-data-exchange-v1";
  generated_at: string;
  manifest: {
    external_id: string;
    type: string;
    departure_datetime: string | null;
    arrival_datetime: string | null;
    notes: string | null;
  };
  origin: WCIAManifestInput["origin"];
  destination: WCIAManifestInput["destination"];
  transportation: WCIAManifestInput["transportation"] | null;
  items: Array<{
    external_id: string | null;
    plant_external_id: string | null;
    product_name: string | null;
    product_category: string | null;
    strain_name: string | null;
    quantity: number;
    unit_price: number | null;
    servings_per_unit: number | null;
    unit_weight_grams: number | null;
    labtest_external_id: string | null;
    qa_results: WCIAManifestInput["items"][number]["qaResults"];
  }>;
}

export function generateWCIAJSON(input: WCIAManifestInput): WCIAOutput {
  return {
    version: "1.0",
    specification: "wcia-distributed-data-exchange-v1",
    generated_at: new Date().toISOString(),
    manifest: {
      external_id: input.manifest.externalIdentifier,
      type: input.manifest.manifestType,
      departure_datetime: input.manifest.departureDateTime,
      arrival_datetime: input.manifest.arrivalDateTime,
      notes: input.manifest.notes ?? null,
    },
    origin: input.origin,
    destination: input.destination,
    transportation: input.transportation ?? null,
    items: input.items.map((i) => ({
      external_id: i.inventoryExternalIdentifier,
      plant_external_id: i.plantExternalIdentifier ?? null,
      product_name: i.productName,
      product_category: i.productCategory ?? null,
      strain_name: i.strainName ?? null,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      servings_per_unit: i.servingsPerUnit ?? null,
      unit_weight_grams: i.unitWeightGrams ?? null,
      labtest_external_id: i.labtestExternalIdentifier,
      qa_results: i.qaResults ?? null,
    })),
  };
}

export function parseWCIAJSON(raw: any): WCIAOutput | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.specification && String(raw.specification).startsWith("wcia-distributed-data-exchange")) {
    return raw as WCIAOutput;
  }
  // Tolerate a bare manifest export
  if (raw.manifest && raw.items) {
    return {
      version: "1.0",
      specification: "wcia-distributed-data-exchange-v1",
      generated_at: new Date().toISOString(),
      manifest: raw.manifest,
      origin: raw.origin ?? { licenseNumber: "", licenseeName: null },
      destination: raw.destination ?? { licenseNumber: "", licenseeName: null },
      transportation: raw.transportation ?? null,
      items: raw.items ?? [],
    };
  }
  return null;
}
