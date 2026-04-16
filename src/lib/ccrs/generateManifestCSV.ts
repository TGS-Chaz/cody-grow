/**
 * CCRS Manifest.CSV generator.
 *
 * The Washington State CCRS manifest submission format has three parts:
 * - Header row: SubmittedBy, SubmittedDate, NumberRecords
 * - Subheader row: manifest-level details (origin, destination, transportation,
 *   driver, vehicle, times)
 * - Item rows: one per inventory item being transported
 *
 * Dates: MM/DD/YYYY. Datetimes: MM/DD/YYYY hh:mm AM/PM.
 *
 * The generated string must be uploaded as `manifest_{licenseNumber}_{YYYYMMDDHHMMSS}.csv`.
 * As of Feb 2026 CCRS-generated PDFs are the ONLY accepted transportation doc —
 * contingency manifests are banned. Our CSV triggers CCRS to issue that PDF.
 */

export interface ManifestCSVInput {
  submittedBy: string;
  submittedDate?: Date;
  manifest: {
    externalIdentifier: string;
    originLicenseNumber: string;
    originLicenseeName: string | null;
    originAddress: string | null;
    originPhone: string | null;
    originEmail: string | null;
    destinationLicenseNumber: string;
    destinationLicenseeName: string | null;
    destinationAddress: string | null;
    destinationPhone: string | null;
    destinationEmail: string | null;
    transportationType: string | null;
    transporterLicenseNumber: string | null;
    driverName: string | null;
    driverLicenseNumber: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehicleYear: string | null;
    vehicleColor: string | null;
    vehicleVIN: string | null;
    vehicleLicensePlate: string | null;
    departureDateTime: string | null; // ISO input, converted to MM/DD/YYYY hh:mm AM/PM
    arrivalDateTime: string | null;
  };
  items: Array<{
    inventoryExternalIdentifier: string | null;
    plantExternalIdentifier: string | null;
    quantity: number;
    unitPrice: number | null;
    servingsPerUnit: number | null;
    labtestExternalIdentifier: string | null;
    createdBy: string;
    createdDate: Date;
    updatedBy?: string;
    updatedDate?: Date;
    operation?: "Insert" | "Update" | "Delete";
  }>;
}

const CSV_HEADER_FIELDS = ["SubmittedBy", "SubmittedDate", "NumberRecords"] as const;
const CSV_SUBHEADER_FIELDS = [
  "ManifestExternalIdentifier", "OriginLicenseNumber", "OriginLicenseeName",
  "OriginAddress", "OriginPhone", "OriginEmail",
  "DestinationLicenseNumber", "DestinationLicenseeName", "DestinationAddress",
  "DestinationPhone", "DestinationEmail",
  "TransportationType", "TransporterLicenseNumber",
  "DriverName", "DriverLicenseNumber",
  "VehicleMake", "VehicleModel", "VehicleYear", "VehicleColor", "VehicleVIN", "VehicleLicensePlate",
  "DepartureDateTime", "ArrivalDateTime",
] as const;
const CSV_ITEM_FIELDS = [
  "InventoryExternalIdentifier", "PlantExternalIdentifier",
  "Quantity", "UnitPrice", "ServingsPerUnit", "LabtestExternalIdentifier",
  "CreatedBy", "CreatedDate", "UpdatedBy", "UpdatedDate", "Operation",
] as const;

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatDateTime(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return "";
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(date.getTime())) return "";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12; if (hours === 0) hours = 12;
  return `${mm}/${dd}/${yyyy} ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function generateManifestCSV(input: ManifestCSVInput): string {
  const submittedDate = input.submittedDate ?? new Date();
  const lines: string[] = [];

  // Header row
  lines.push(CSV_HEADER_FIELDS.join(","));
  lines.push([
    csvEscape(input.submittedBy),
    csvEscape(formatDate(submittedDate)),
    csvEscape(input.items.length),
  ].join(","));

  // Subheader row
  lines.push(CSV_SUBHEADER_FIELDS.join(","));
  lines.push([
    csvEscape(input.manifest.externalIdentifier),
    csvEscape(input.manifest.originLicenseNumber),
    csvEscape(input.manifest.originLicenseeName),
    csvEscape(input.manifest.originAddress),
    csvEscape(input.manifest.originPhone),
    csvEscape(input.manifest.originEmail),
    csvEscape(input.manifest.destinationLicenseNumber),
    csvEscape(input.manifest.destinationLicenseeName),
    csvEscape(input.manifest.destinationAddress),
    csvEscape(input.manifest.destinationPhone),
    csvEscape(input.manifest.destinationEmail),
    csvEscape(input.manifest.transportationType),
    csvEscape(input.manifest.transporterLicenseNumber),
    csvEscape(input.manifest.driverName),
    csvEscape(input.manifest.driverLicenseNumber),
    csvEscape(input.manifest.vehicleMake),
    csvEscape(input.manifest.vehicleModel),
    csvEscape(input.manifest.vehicleYear),
    csvEscape(input.manifest.vehicleColor),
    csvEscape(input.manifest.vehicleVIN),
    csvEscape(input.manifest.vehicleLicensePlate),
    csvEscape(formatDateTime(input.manifest.departureDateTime)),
    csvEscape(formatDateTime(input.manifest.arrivalDateTime)),
  ].join(","));

  // Item rows
  lines.push(CSV_ITEM_FIELDS.join(","));
  for (const item of input.items) {
    lines.push([
      csvEscape(item.inventoryExternalIdentifier),
      csvEscape(item.plantExternalIdentifier),
      csvEscape(item.quantity),
      csvEscape(item.unitPrice),
      csvEscape(item.servingsPerUnit),
      csvEscape(item.labtestExternalIdentifier),
      csvEscape(item.createdBy),
      csvEscape(formatDate(item.createdDate)),
      csvEscape(item.updatedBy ?? item.createdBy),
      csvEscape(formatDate(item.updatedDate ?? item.createdDate)),
      csvEscape(item.operation ?? "Insert"),
    ].join(","));
  }

  return lines.join("\n");
}

export function generateManifestCSVFilename(licenseNumber: string, at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `manifest_${licenseNumber}_${ts}.csv`;
}
