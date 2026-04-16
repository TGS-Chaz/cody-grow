/**
 * Schema-enum single source of truth.
 *
 * Every CHECK-constrained text column in the Postgres schema gets its allowed
 * values mirrored here as a `readonly` tuple, along with a derived TS type and
 * a label map for UI display.
 *
 * Rules:
 *  - UI code and DB writes import the tuple values FROM HERE. Never hardcode
 *    the string in a form or hook — if the CHECK constraint changes in a
 *    migration, regenerate these constants and the compiler catches every
 *    callsite that needs updating.
 *  - The `*_LABELS` maps are for display only. Never send a label to the DB.
 *  - Keep alphabetized by table name. Values are listed in the order that
 *    makes the best default for a typical form (not DB order).
 *
 * Regenerated from the output of:
 *   SELECT cl.relname, con.conname, pg_get_constraintdef(con.oid)
 *   FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
 *   WHERE cl.relname LIKE 'grow_%' AND con.contype = 'c';
 */

// ─── grow_accounts.license_type ────────────────────────────────────────────────
export const ACCOUNT_LICENSE_TYPES = [
  "retailer", "producer", "processor", "producer_processor",
  "transporter", "lab", "other",
] as const;
export type AccountLicenseType = typeof ACCOUNT_LICENSE_TYPES[number];
export const ACCOUNT_LICENSE_TYPE_LABELS: Record<AccountLicenseType, string> = {
  retailer: "Retailer",
  producer: "Producer",
  processor: "Processor",
  producer_processor: "Producer / Processor",
  transporter: "Transporter",
  lab: "Lab",
  other: "Other",
};

// ─── grow_areas.type / canopy_type ────────────────────────────────────────────
export const AREA_TYPES = ["grow", "storage", "processing", "quarantine", "drying", "curing"] as const;
export type AreaType = typeof AREA_TYPES[number];
/** Expanded 2026-04-16 to include 'processing' and 'quarantine' so the Areas
 * form can offer a single 8-type selector aligned with room purpose. */
export const AREA_CANOPY_TYPES = [
  "flower", "veg", "mother", "clone", "drying",
  "storage", "processing", "quarantine",
] as const;
export type AreaCanopyType = typeof AREA_CANOPY_TYPES[number];
export const AREA_CANOPY_TYPE_LABELS: Record<AreaCanopyType, string> = {
  flower: "Flower",
  veg: "Veg",
  mother: "Mother",
  clone: "Clone",
  drying: "Drying",
  storage: "Storage",
  processing: "Processing",
  quarantine: "Quarantine",
};
/** Tailwind + hex colors per canopy type — used for left border, badge, and
 * the floor-plan placeholder tiles. */
export const AREA_CANOPY_TYPE_COLORS: Record<AreaCanopyType, { bg: string; text: string; border: string; hex: string }> = {
  flower:     { bg: "bg-purple-500/15",  text: "text-purple-500",  border: "border-l-purple-500",  hex: "#A855F7" },
  veg:        { bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-l-emerald-500", hex: "#10B981" },
  mother:     { bg: "bg-blue-500/15",    text: "text-blue-500",    border: "border-l-blue-500",    hex: "#3B82F6" },
  clone:      { bg: "bg-cyan-500/15",    text: "text-cyan-500",    border: "border-l-cyan-500",    hex: "#06B6D4" },
  drying:     { bg: "bg-orange-500/15",  text: "text-orange-500",  border: "border-l-orange-500",  hex: "#F97316" },
  storage:    { bg: "bg-gray-500/15",    text: "text-gray-500",    border: "border-l-gray-500",    hex: "#6B7280" },
  processing: { bg: "bg-indigo-500/15",  text: "text-indigo-500",  border: "border-l-indigo-500",  hex: "#6366F1" },
  quarantine: { bg: "bg-red-500/15",     text: "text-red-500",     border: "border-l-red-500",     hex: "#EF4444" },
};

// ─── grow_areas.light_type ────────────────────────────────────────────────────
export const AREA_LIGHT_TYPES = ["led", "hps", "cmh", "fluorescent", "natural_greenhouse", "mixed"] as const;
export type AreaLightType = typeof AREA_LIGHT_TYPES[number];
export const AREA_LIGHT_TYPE_LABELS: Record<AreaLightType, string> = {
  led: "LED",
  hps: "HPS",
  cmh: "CMH",
  fluorescent: "Fluorescent",
  natural_greenhouse: "Natural / Greenhouse",
  mixed: "Mixed",
};

// ─── grow_batches.source_type ─────────────────────────────────────────────────
export const BATCH_SOURCE_TYPES = [
  "harvest", "production", "sublot", "inbound_transfer", "manual", "conversion",
] as const;
export type BatchSourceType = typeof BATCH_SOURCE_TYPES[number];

// ─── grow_ccrs_uploads.file_type / status ─────────────────────────────────────
export const CCRS_UPLOAD_FILE_TYPES = [
  "Strain", "Area", "Product", "Plant", "Inventory",
  "InventoryAdjustment", "LabTest", "Sale", "Manifest",
] as const;
export type CcrsUploadFileType = typeof CCRS_UPLOAD_FILE_TYPES[number];
export const CCRS_UPLOAD_STATUSES = ["pending", "generated", "uploaded", "confirmed", "error"] as const;
export type CcrsUploadStatus = typeof CCRS_UPLOAD_STATUSES[number];

// ─── grow_credit_accounts.payment_terms ───────────────────────────────────────
export const PAYMENT_TERMS = ["COD", "prepaid", "net_7", "net_14", "net_30", "net_60", "net_90", "custom"] as const;
export type PaymentTerms = typeof PAYMENT_TERMS[number];
export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  COD: "COD (Cash on Delivery)",
  prepaid: "Prepaid",
  net_7: "Net 7",
  net_14: "Net 14",
  net_30: "Net 30",
  net_60: "Net 60",
  net_90: "Net 90",
  custom: "Custom",
};

// ─── grow_org_settings (CCRS + WCIA + AI + integrations) ────────────────────
export const CCRS_INTEGRATOR_STATUSES = ["not_applied", "pending", "approved", "suspended"] as const;
export type CcrsIntegratorStatus = typeof CCRS_INTEGRATOR_STATUSES[number];
export const CCRS_INTEGRATOR_STATUS_LABELS: Record<CcrsIntegratorStatus, string> = {
  not_applied: "Not Applied",
  pending: "Pending Approval",
  approved: "Approved",
  suspended: "Suspended",
};

export const CCRS_AUTO_UPLOAD_FREQUENCIES = ["manual", "daily", "twice_weekly", "weekly"] as const;
export type CcrsAutoUploadFrequency = typeof CCRS_AUTO_UPLOAD_FREQUENCIES[number];
export const CCRS_AUTO_UPLOAD_FREQUENCY_LABELS: Record<CcrsAutoUploadFrequency, string> = {
  manual: "Manual Only",
  daily: "Daily",
  twice_weekly: "Twice Weekly",
  weekly: "Weekly",
};

export const CCRS_NOTIFICATION_PREFERENCES = ["email", "in_app", "both", "none"] as const;
export type CcrsNotificationPreference = typeof CCRS_NOTIFICATION_PREFERENCES[number];
export const CCRS_NOTIFICATION_PREFERENCE_LABELS: Record<CcrsNotificationPreference, string> = {
  email: "Email",
  in_app: "In-App",
  both: "Email & In-App",
  none: "None",
};

/** Lowercase file-type identifiers for grow_org_settings.ccrs_upload_file_types[].
 * Note: these are kebab/lowercase — the CSV-file "FileType" column uses
 * CcrsUploadFileType (PascalCase) instead. */
export const CCRS_FILE_CATEGORIES = [
  "strain", "area", "product", "plant",
  "plantdestruction", "planttransfer",
  "inventory", "inventoryadjustment", "inventorytransfer",
  "labtest", "sale", "manifest",
] as const;
export type CcrsFileCategory = typeof CCRS_FILE_CATEGORIES[number];
export const CCRS_FILE_CATEGORY_LABELS: Record<CcrsFileCategory, string> = {
  strain: "Strains",
  area: "Areas",
  product: "Products",
  plant: "Plants",
  plantdestruction: "Plant Destructions",
  planttransfer: "Plant Transfers",
  inventory: "Inventory",
  inventoryadjustment: "Inventory Adjustments",
  inventorytransfer: "Inventory Transfers",
  labtest: "Lab Tests",
  sale: "Sales",
  manifest: "Manifests",
};

export const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type DayOfWeekName = typeof DAYS_OF_WEEK[number];
export const DAY_OF_WEEK_LABELS: Record<DayOfWeekName, string> = {
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
};

export const WCIA_HOSTING_TYPES = ["cody_hosted", "self_hosted"] as const;
export type WciaHostingType = typeof WCIA_HOSTING_TYPES[number];
export const WCIA_HOSTING_TYPE_LABELS: Record<WciaHostingType, string> = {
  cody_hosted: "Cody Grow Hosted",
  self_hosted: "Self-Hosted URL",
};

/** Cody personality JSONB shape — stored on grow_org_settings.cody_personality. */
export const CODY_RESPONSE_STYLES = ["concise", "balanced", "detailed"] as const;
export type CodyResponseStyle = typeof CODY_RESPONSE_STYLES[number];
export const CODY_RESPONSE_STYLE_LABELS: Record<CodyResponseStyle, string> = {
  concise: "Concise",
  balanced: "Balanced",
  detailed: "Detailed",
};

export const CODY_TONES = ["professional", "friendly", "technical"] as const;
export type CodyTone = typeof CODY_TONES[number];
export const CODY_TONE_LABELS: Record<CodyTone, string> = {
  professional: "Professional",
  friendly: "Friendly",
  technical: "Technical",
};

// ─── grow_cycles.phase ────────────────────────────────────────────────────────
export const CYCLE_PHASES = [
  "immature", "vegetative", "flowering", "ready_for_harvest", "harvesting", "completed",
] as const;
export type CyclePhase = typeof CYCLE_PHASES[number];

// ─── grow_discounts.discount_type ─────────────────────────────────────────────
export const DISCOUNT_TYPES = ["percentage", "fixed_amount", "unit_price_override"] as const;
export type DiscountType = typeof DISCOUNT_TYPES[number];
export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: "Percentage",
  fixed_amount: "Fixed Amount",
  unit_price_override: "Unit Price Override",
};
/** Short labels for compact UI (buttons, chips). */
export const DISCOUNT_TYPE_SHORT_LABELS: Record<DiscountType, string> = {
  percentage: "Percent (%)",
  fixed_amount: "Fixed ($)",
  unit_price_override: "Override",
};
/** Not stored on grow_discounts — no CHECK constraint exists for applies_to because
 * the schema uses four separate nullable array columns (applies_to_accounts, applies_to_products,
 * applies_to_categories, applies_to_account_groups). This enum is UI-only — it maps the
 * radio-button selection to which array gets populated. Never write this to the DB. */
export const DISCOUNT_APPLIES_TO = [
  "all_products", "specific_products", "specific_categories", "specific_accounts",
] as const;
export type DiscountAppliesTo = typeof DISCOUNT_APPLIES_TO[number];
export const DISCOUNT_APPLIES_TO_LABELS: Record<DiscountAppliesTo, string> = {
  all_products: "All Products",
  specific_products: "Specific Products",
  specific_categories: "Specific Categories",
  specific_accounts: "Specific Accounts",
};

// ─── grow_disposals ───────────────────────────────────────────────────────────
export const DISPOSAL_TYPES = [
  "plant", "inventory", "harvest_waste", "production_waste",
  "expired_product", "failed_qa", "recall", "other",
] as const;
export type DisposalType = typeof DISPOSAL_TYPES[number];
export const DISPOSAL_STATUSES = [
  "in_quarantine", "ready_to_destroy", "destroyed", "ccrs_reported", "voided",
] as const;
export type DisposalStatus = typeof DISPOSAL_STATUSES[number];
export const DISPOSAL_DESTRUCTION_METHODS = [
  "grinding_mixing", "composting", "incineration", "rendering", "burial", "other",
] as const;
export type DisposalDestructionMethod = typeof DISPOSAL_DESTRUCTION_METHODS[number];
/** CCRS-exact casing. Required for CCRS submission file output. */
export const CCRS_DESTRUCTION_METHODS = ["Compost", "Grind", "Other"] as const;
export type CcrsDestructionMethod = typeof CCRS_DESTRUCTION_METHODS[number];
export const CCRS_DESTRUCTION_REASONS = [
  "PlantDied", "Contamination", "TooMuchWater", "TooLittleWater",
  "MalePlant", "Mites", "Other",
] as const;
export type CcrsDestructionReason = typeof CCRS_DESTRUCTION_REASONS[number];

// ─── grow_drivers.driver_type ─────────────────────────────────────────────────
export const DRIVER_TYPES = ["delivery", "pickup"] as const;
export type DriverType = typeof DRIVER_TYPES[number];

// ─── grow_employees ───────────────────────────────────────────────────────────
export const EMPLOYEE_DEPARTMENTS = [
  "cultivation", "processing", "packaging", "quality",
  "sales", "fulfillment", "delivery", "admin", "management", "other",
] as const;
export type EmployeeDepartment = typeof EMPLOYEE_DEPARTMENTS[number];
export const EMPLOYMENT_STATUSES = [
  "active", "on_leave", "terminated", "seasonal", "contractor",
] as const;
export type EmploymentStatus = typeof EMPLOYMENT_STATUSES[number];

// ─── grow_equipment ───────────────────────────────────────────────────────────
export const EQUIPMENT_TYPES = [
  "scale", "thermometer", "hygrometer", "co2_meter", "ph_meter",
  "scanner", "printer",
  "barcode_scanner", "rfid_reader", "label_printer", "environmental_sensor",
  "camera", "tablet_kiosk",
  "hvac", "lighting", "irrigation", "dehumidifier", "tool", "other",
] as const;
export type EquipmentType = typeof EQUIPMENT_TYPES[number];
export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  scale: "Scale",
  thermometer: "Thermometer",
  hygrometer: "Hygrometer",
  co2_meter: "CO₂ Meter",
  ph_meter: "pH Meter",
  scanner: "Scanner",
  printer: "Printer",
  barcode_scanner: "Barcode Scanner",
  rfid_reader: "RFID Reader",
  label_printer: "Label Printer",
  environmental_sensor: "Environmental Sensor",
  camera: "Camera",
  tablet_kiosk: "Tablet / Kiosk",
  hvac: "HVAC",
  lighting: "Lighting",
  irrigation: "Irrigation",
  dehumidifier: "Dehumidifier",
  tool: "Tool",
  other: "Other",
};
/** Equipment types that can be paired with a grow_hardware_devices record (integrated). */
export const EQUIPMENT_INTEGRATABLE_TYPES: readonly EquipmentType[] = [
  "scale", "barcode_scanner", "rfid_reader", "label_printer",
  "environmental_sensor", "camera", "tablet_kiosk", "scanner", "printer",
];

export const EQUIPMENT_STATUSES = ["active", "maintenance", "out_of_service", "decommissioned"] as const;
export type EquipmentStatus = typeof EQUIPMENT_STATUSES[number];
export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  active: "Active",
  maintenance: "Maintenance",
  out_of_service: "Out of Service",
  decommissioned: "Decommissioned",
};

// ─── grow_hardware_devices ────────────────────────────────────────────────────
export const HARDWARE_DEVICE_TYPES = [
  "scale", "barcode_scanner", "rfid_reader", "label_printer",
  "environmental_sensor", "camera", "tablet_kiosk", "other",
] as const;
export type HardwareDeviceType = typeof HARDWARE_DEVICE_TYPES[number];
export const HARDWARE_DEVICE_TYPE_LABELS: Record<HardwareDeviceType, string> = {
  scale: "Scale",
  barcode_scanner: "Barcode Scanner",
  rfid_reader: "RFID Reader",
  label_printer: "Label Printer",
  environmental_sensor: "Environmental Sensor",
  camera: "Camera",
  tablet_kiosk: "Tablet / Kiosk",
  other: "Other",
};
export const HARDWARE_CONNECTION_TYPES = [
  "bluetooth", "usb", "wifi", "ethernet", "cellular", "rs232",
] as const;
export type HardwareConnectionType = typeof HARDWARE_CONNECTION_TYPES[number];
export const HARDWARE_CONNECTION_TYPE_LABELS: Record<HardwareConnectionType, string> = {
  bluetooth: "Bluetooth", usb: "USB", wifi: "WiFi",
  ethernet: "Ethernet", cellular: "Cellular", rs232: "RS-232",
};
export const HARDWARE_INTEGRATION_TYPES = [
  "aranet", "trolmaster", "argus", "growlink",
  "zebra", "dymo", "bluetooth_generic", "manual", "other",
] as const;
export type HardwareIntegrationType = typeof HARDWARE_INTEGRATION_TYPES[number];
export const HARDWARE_INTEGRATION_TYPE_LABELS: Record<HardwareIntegrationType, string> = {
  aranet: "Aranet",
  trolmaster: "TrolMaster",
  argus: "Argus",
  growlink: "GrowLink",
  zebra: "Zebra",
  dymo: "Dymo",
  bluetooth_generic: "Bluetooth (Generic)",
  manual: "Manual",
  other: "Other",
};

// ─── grow_calibration_log.pass_fail ──────────────────────────────────────────
export const CALIBRATION_RESULTS = ["pass", "fail", "adjusted"] as const;
export type CalibrationResult = typeof CALIBRATION_RESULTS[number];
export const CALIBRATION_RESULT_LABELS: Record<CalibrationResult, string> = {
  pass: "Pass",
  fail: "Fail",
  adjusted: "Adjusted",
};

/** UI-only calibration frequency presets. Maps to grow_equipment.calibration_frequency_days (integer). */
export const CALIBRATION_FREQUENCIES = [
  { id: "weekly",     days: 7,   label: "Weekly" },
  { id: "monthly",    days: 30,  label: "Monthly" },
  { id: "quarterly",  days: 90,  label: "Quarterly" },
  { id: "semi_annual", days: 182, label: "Semi-Annual" },
  { id: "annual",     days: 365, label: "Annual" },
] as const;
export type CalibrationFrequencyPreset = typeof CALIBRATION_FREQUENCIES[number]["id"];

// ─── grow_facilities.license_type ─────────────────────────────────────────────
export const FACILITY_LICENSE_TYPES = [
  "producer_tier_1", "producer_tier_2", "producer_tier_3",
  "processor", "producer_processor", "transporter",
] as const;
export type FacilityLicenseType = typeof FACILITY_LICENSE_TYPES[number];
export const FACILITY_LICENSE_TYPE_LABELS: Record<FacilityLicenseType, string> = {
  producer_tier_1: "Producer Tier 1",
  producer_tier_2: "Producer Tier 2",
  producer_tier_3: "Producer Tier 3",
  processor: "Processor",
  producer_processor: "Producer / Processor",
  transporter: "Transporter",
};

// ─── grow_harvests ────────────────────────────────────────────────────────────
export const HARVEST_TYPES = ["standard", "manicure"] as const;
export type HarvestType = typeof HARVEST_TYPES[number];
export const HARVEST_STATUSES = ["active", "drying", "curing", "cured", "processing", "completed"] as const;
export type HarvestStatus = typeof HARVEST_STATUSES[number];

// ─── grow_inventory_adjustments.adjustment_reason (CCRS-exact) ────────────────
export const CCRS_ADJUSTMENT_REASONS = [
  "Destruction", "Reconciliation", "Lost", "Seizure",
  "Theft", "ReturnedLabSample", "Other",
] as const;
export type CcrsAdjustmentReason = typeof CCRS_ADJUSTMENT_REASONS[number];

// ─── grow_invoices.status ─────────────────────────────────────────────────────
export const INVOICE_STATUSES = [
  "draft", "unpaid", "partial", "paid", "overdue", "voided", "written_off",
] as const;
export type InvoiceStatus = typeof INVOICE_STATUSES[number];

// ─── grow_manifests ───────────────────────────────────────────────────────────
export const MANIFEST_TYPES = ["outbound", "inbound", "return", "qa_sample", "trade_sample"] as const;
export type ManifestType = typeof MANIFEST_TYPES[number];
export const MANIFEST_STATUSES = [
  "draft", "generated", "uploaded_to_ccrs", "ccrs_confirmed",
  "in_transit", "accepted", "rejected", "cancelled",
] as const;
export type ManifestStatus = typeof MANIFEST_STATUSES[number];
export const MANIFEST_TRANSPORTATION_TYPES = [
  "origin_licensee", "destination_licensee", "transporter_licensee",
] as const;
export type ManifestTransportationType = typeof MANIFEST_TRANSPORTATION_TYPES[number];

// ─── grow_orders ──────────────────────────────────────────────────────────────
export const ORDER_SALE_TYPES = ["RecreationalRetail", "RecreationalMedical", "Wholesale"] as const;
export type OrderSaleType = typeof ORDER_SALE_TYPES[number];
export const ORDER_SALE_TYPE_LABELS: Record<OrderSaleType, string> = {
  RecreationalRetail: "Recreational Retail",
  RecreationalMedical: "Recreational Medical",
  Wholesale: "Wholesale",
};
export const ORDER_STATUSES = [
  "draft", "cart", "submitted", "allocated", "packaged",
  "manifested", "invoiced", "released", "completed", "cancelled",
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

// ─── grow_payments.payment_method ─────────────────────────────────────────────
export const PAYMENT_METHODS = [
  "cash", "check", "ach", "wire", "credit_card", "cryptocurrency", "cash_app", "other",
] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

// ─── grow_plants ──────────────────────────────────────────────────────────────
export const PLANT_PHASES = [
  "immature", "vegetative", "flowering", "ready_for_harvest", "harvested", "destroyed",
] as const;
export type PlantPhase = typeof PLANT_PHASES[number];
export const PLANT_SOURCE_TYPES = ["seed", "clone", "tissue_culture"] as const;
export type PlantSourceType = typeof PLANT_SOURCE_TYPES[number];
/** CCRS-exact casing — required for CCRS submission file. */
export const CCRS_PLANT_STATES = [
  "Growing", "Drying", "PartiallyHarvested", "Harvested",
  "Quarantined", "Destroyed", "Inventory", "Sold",
] as const;
export type CcrsPlantState = typeof CCRS_PLANT_STATES[number];
export const CCRS_GROWTH_STAGES = ["Immature", "Vegetative", "Flowering"] as const;
export type CcrsGrowthStage = typeof CCRS_GROWTH_STAGES[number];
export const HARVEST_CYCLE_MONTHS = [3, 6, 9, 12] as const;
export type HarvestCycleMonths = typeof HARVEST_CYCLE_MONTHS[number];

// ─── grow_products ────────────────────────────────────────────────────────────
export const PRODUCT_CATEGORIES = [
  "Flower", "Flower Lot", "Concentrate", "Concentrate For Inhalation",
  "Edible", "Topical", "Pre-Roll", "Infused Pre-Roll", "Capsule",
  "Tincture", "Suppository", "Transdermal Patch", "Clone", "Seed",
  "Plant Tissue", "Propagation Material", "Usable Marijuana",
  "Non-Cannabis", "Packaging", "Sample",
] as const;
export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
export const CCRS_INVENTORY_CATEGORIES = [
  "PropagationMaterial", "HarvestedMaterial", "IntermediateProduct", "EndProduct",
] as const;
export type CcrsInventoryCategory = typeof CCRS_INVENTORY_CATEGORIES[number];
export const CCRS_INVENTORY_CATEGORY_LABELS: Record<CcrsInventoryCategory, string> = {
  PropagationMaterial: "Propagation Material",
  HarvestedMaterial: "Harvested Material",
  IntermediateProduct: "Intermediate Product",
  EndProduct: "End Product",
};
export const CCRS_INVENTORY_CATEGORY_COLORS: Record<CcrsInventoryCategory, { bg: string; text: string; hex: string }> = {
  PropagationMaterial: { bg: "bg-green-500/15",    text: "text-green-500",    hex: "#22C55E" },
  HarvestedMaterial:   { bg: "bg-emerald-500/15",  text: "text-emerald-500",  hex: "#10B981" },
  IntermediateProduct: { bg: "bg-purple-500/15",   text: "text-purple-500",   hex: "#A855F7" },
  EndProduct:          { bg: "bg-teal-500/15",     text: "text-teal-500",     hex: "#14B8A6" },
};

/** CCRS InventoryType master list — the union of every type allowed across
 * the four categories. Cross-category validity is enforced in UI via
 * CCRS_CATEGORY_TYPE_MAP and in DB via grow_products_ccrs_inventory_type_check. */
export const CCRS_INVENTORY_TYPES = [
  "Seed", "Plant", "Clone",
  "Wet Flower", "Wet Other Material", "Flower Unlotted", "Flower Lot", "Other Material Unlotted", "Other Material Lot",
  "Marijuana Mix", "Concentrate for Inhalation", "Non-Solvent based Concentrate", "Hydrocarbon Concentrate", "CO2 Concentrate", "Ethanol Concentrate", "Food Grade Solvent Concentrate", "Infused Cooking Medium", "CBD", "Waste Usable Marijuana",
  "Capsule", "Solid Edible", "Tincture", "Liquid Edible", "Transdermal", "Topical Ointment", "Marijuana Mix Packaged", "Marijuana Mix Infused", "Suppository", "Sample Jar",
  "Waste",
] as const;
export type CcrsInventoryType = typeof CCRS_INVENTORY_TYPES[number];

/** CCRS Category → valid Types mapping. The product form uses this to filter
 * the Type dropdown based on the selected Category. "Waste" is the only type
 * that legitimately belongs to multiple categories (Harvested + Intermediate). */
export const CCRS_CATEGORY_TYPE_MAP: Record<CcrsInventoryCategory, readonly CcrsInventoryType[]> = {
  PropagationMaterial: ["Seed", "Plant", "Clone"],
  HarvestedMaterial: [
    "Wet Flower", "Wet Other Material", "Flower Unlotted", "Flower Lot",
    "Other Material Unlotted", "Other Material Lot", "Waste",
  ],
  IntermediateProduct: [
    "Marijuana Mix", "Concentrate for Inhalation", "Non-Solvent based Concentrate",
    "Hydrocarbon Concentrate", "CO2 Concentrate", "Ethanol Concentrate",
    "Food Grade Solvent Concentrate", "Infused Cooking Medium", "CBD",
    "Waste Usable Marijuana", "Waste",
  ],
  EndProduct: [
    "Capsule", "Solid Edible", "Tincture", "Liquid Edible", "Transdermal",
    "Topical Ointment", "Marijuana Mix Packaged", "Marijuana Mix Infused",
    "Suppository", "Sample Jar",
  ],
};

/** Types that require the "Not For Kids" symbol on labels per WAC 314-55-105. */
export const CCRS_INVENTORY_EDIBLE_TYPES: readonly CcrsInventoryType[] = [
  "Solid Edible", "Liquid Edible", "Capsule", "Tincture", "Marijuana Mix Infused", "Suppository",
];

/** Warning text snippets per CCRS InventoryType per WAC 314-55-105 / DOH rules. */
export const CCRS_INVENTORY_TYPE_WARNING_TEXT: Partial<Record<CcrsInventoryType, string>> = {
  "Flower Lot": "This product has intoxicating effects and may be habit forming. Marijuana can impair concentration, coordination and judgment. Do not operate a vehicle or machinery under the influence of this drug.",
  "Flower Unlotted": "This product has intoxicating effects and may be habit forming.",
  "Concentrate for Inhalation": "This product has high potency. Start low, go slow.",
  "Solid Edible": "Caution: When eaten or swallowed, the intoxicating effects of this drug may be delayed by two or more hours. Keep out of reach of children.",
  "Liquid Edible": "Caution: When consumed, the intoxicating effects of this drug may be delayed by two or more hours. Keep out of reach of children.",
  "Capsule": "Caution: When swallowed, the intoxicating effects may be delayed by two or more hours. Keep out of reach of children.",
  "Tincture": "Caution: Intoxicating effects may be delayed when consumed. Keep out of reach of children.",
  "Topical Ointment": "For external use only. Not for consumption.",
  "Transdermal": "For external use only. Not for consumption.",
  "Suppository": "For rectal/vaginal use only. Keep out of reach of children.",
};

// ─── Units of measure (grow_products.unit_of_measure) ────────────────────────
export const UNITS_OF_MEASURE = ["grams", "ounces", "pounds", "kilograms", "units", "milliliters", "liters", "each"] as const;
export type UnitOfMeasure = typeof UNITS_OF_MEASURE[number];
export const UNIT_OF_MEASURE_LABELS: Record<UnitOfMeasure, string> = {
  grams: "Grams (g)",
  ounces: "Ounces (oz)",
  pounds: "Pounds (lb)",
  kilograms: "Kilograms (kg)",
  units: "Units",
  milliliters: "Milliliters (ml)",
  liters: "Liters (L)",
  each: "Each",
};

// ─── Weight display format (grow_products.weight_display_format) ─────────────
export const WEIGHT_DISPLAY_FORMATS = ["grams_only", "ounces_only", "both"] as const;
export type WeightDisplayFormat = typeof WEIGHT_DISPLAY_FORMATS[number];
export const WEIGHT_DISPLAY_FORMAT_LABELS: Record<WeightDisplayFormat, string> = {
  grams_only: "Grams only",
  ounces_only: "Ounces only",
  both: "Both",
};

/** SKU prefix per category — used by the form to auto-generate SKU values. */
export const CCRS_CATEGORY_SKU_PREFIX: Record<CcrsInventoryCategory, string> = {
  PropagationMaterial: "PRP",
  HarvestedMaterial: "HVS",
  IntermediateProduct: "INT",
  EndProduct: "END",
};

// ─── grow_qa_* ────────────────────────────────────────────────────────────────
export const QA_LOT_STATUSES = ["created", "sampled", "in_testing", "passed", "failed", "voided"] as const;
export type QaLotStatus = typeof QA_LOT_STATUSES[number];
export const QA_RESULT_LAB_TEST_STATUSES = [
  "Required", "NotRequired", "Pass", "Fail",
  "FailExtractableOnly", "FailRetestAllowed", "FailRetestAllowedExtractableOnly",
  "InProcess", "SampleCreated",
] as const;
export type QaResultLabTestStatus = typeof QA_RESULT_LAB_TEST_STATUSES[number];
export const QA_SAMPLE_STATUSES = [
  "created", "shipped", "received_at_lab", "testing", "complete", "voided",
] as const;
export type QaSampleStatus = typeof QA_SAMPLE_STATUSES[number];

// ─── grow_recalls ─────────────────────────────────────────────────────────────
export const RECALL_TYPES = ["voluntary", "mandatory", "precautionary"] as const;
export type RecallType = typeof RECALL_TYPES[number];
export const RECALL_SEVERITIES = ["class_i", "class_ii", "class_iii"] as const;
export type RecallSeverity = typeof RECALL_SEVERITIES[number];
export const RECALL_STATUSES = ["open", "in_progress", "resolved", "cancelled"] as const;
export type RecallStatus = typeof RECALL_STATUSES[number];

// ─── grow_routes ──────────────────────────────────────────────────────────────
export const ROUTE_DAYS_OF_WEEK = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday", "various",
] as const;
export type RouteDayOfWeek = typeof ROUTE_DAYS_OF_WEEK[number];

// ─── grow_sops.category ───────────────────────────────────────────────────────
export const SOP_CATEGORIES = [
  "cultivation", "processing", "packaging", "quality",
  "safety", "compliance", "sanitation", "emergency", "other",
] as const;
export type SopCategory = typeof SOP_CATEGORIES[number];

// ─── grow_strains.type ────────────────────────────────────────────────────────
/** CCRS-exact casing — these are the values allowed by the
 * grow_strains_type_check constraint AND required in the CCRS Strain.csv
 * StrainType column. */
export const STRAIN_TYPES = ["Indica", "Sativa", "Hybrid", "CBD", "High CBD"] as const;
export type StrainType = typeof STRAIN_TYPES[number];
export const STRAIN_TYPE_LABELS: Record<StrainType, string> = {
  Indica: "Indica",
  Sativa: "Sativa",
  Hybrid: "Hybrid",
  CBD: "CBD",
  "High CBD": "High CBD",
};
/** Tailwind color classes keyed by strain type, used in badges, borders, and
 * the default gradient on strain cards without photos. */
export const STRAIN_TYPE_COLORS: Record<StrainType, { bg: string; text: string; ring: string; hex: string; gradient: string }> = {
  Indica:     { bg: "bg-purple-500/15",  text: "text-purple-500",  ring: "ring-purple-500/40",  hex: "#A855F7", gradient: "from-purple-500/30 to-indigo-500/20" },
  Sativa:     { bg: "bg-amber-500/15",   text: "text-amber-500",   ring: "ring-amber-500/40",   hex: "#F59E0B", gradient: "from-amber-500/30 to-orange-500/20" },
  Hybrid:     { bg: "bg-emerald-500/15", text: "text-emerald-500", ring: "ring-emerald-500/40", hex: "#10B981", gradient: "from-emerald-500/30 to-teal-500/20" },
  CBD:        { bg: "bg-blue-500/15",    text: "text-blue-500",    ring: "ring-blue-500/40",    hex: "#3B82F6", gradient: "from-blue-500/30 to-cyan-500/20" },
  "High CBD": { bg: "bg-cyan-500/15",    text: "text-cyan-500",    ring: "ring-cyan-500/40",    hex: "#06B6D4", gradient: "from-cyan-500/30 to-sky-500/20" },
};

// ─── grow_strains.difficulty ─────────────────────────────────────────────────
export const STRAIN_DIFFICULTIES = ["easy", "moderate", "advanced", "expert"] as const;
export type StrainDifficulty = typeof STRAIN_DIFFICULTIES[number];
export const STRAIN_DIFFICULTY_LABELS: Record<StrainDifficulty, string> = {
  easy: "Easy", moderate: "Moderate", advanced: "Advanced", expert: "Expert",
};

// ─── grow_strains.preferred_environment ──────────────────────────────────────
export const STRAIN_ENVIRONMENTS = ["indoor", "outdoor", "greenhouse", "any"] as const;
export type StrainEnvironment = typeof STRAIN_ENVIRONMENTS[number];
export const STRAIN_ENVIRONMENT_LABELS: Record<StrainEnvironment, string> = {
  indoor: "Indoor", outdoor: "Outdoor", greenhouse: "Greenhouse", any: "Any",
};

// ─── grow_strains.growth_pattern ─────────────────────────────────────────────
export const STRAIN_GROWTH_PATTERNS = ["short_bushy", "tall_stretchy", "medium", "columnar"] as const;
export type StrainGrowthPattern = typeof STRAIN_GROWTH_PATTERNS[number];
export const STRAIN_GROWTH_PATTERN_LABELS: Record<StrainGrowthPattern, string> = {
  short_bushy: "Short / Bushy",
  tall_stretchy: "Tall / Stretchy",
  medium: "Medium",
  columnar: "Columnar",
};

// ─── grow_strain_lineage.parent_type ─────────────────────────────────────────
export const LINEAGE_PARENT_TYPES = ["mother", "father", "both", "unknown"] as const;
export type LineageParentType = typeof LINEAGE_PARENT_TYPES[number];

// ─── Cultivation taxonomies ─────────────────────────────────────────────────
// These aren't enforced by CHECK constraints — they're stored as free-form
// TEXT[] arrays. UI offers these as suggestions but allows custom entries.

export const COMMON_TERPENES = [
  "Myrcene", "Limonene", "Caryophyllene", "Linalool", "Pinene",
  "Humulene", "Terpinolene", "Ocimene", "Bisabolol", "Nerolidol",
  "Geraniol", "Camphene",
] as const;

/** Visual color for each terpene, used on chips. Unknown terpenes fall back
 * to the generic muted style. */
export const TERPENE_COLORS: Record<string, string> = {
  Myrcene:       "bg-orange-500/15 text-orange-500",
  Limonene:      "bg-yellow-500/15 text-yellow-500",
  Caryophyllene: "bg-red-500/15 text-red-500",
  Linalool:      "bg-purple-500/15 text-purple-500",
  Pinene:        "bg-emerald-500/15 text-emerald-500",
  Humulene:      "bg-amber-500/15 text-amber-500",
  Terpinolene:   "bg-pink-500/15 text-pink-500",
  Ocimene:       "bg-lime-500/15 text-lime-500",
  Bisabolol:     "bg-rose-500/15 text-rose-500",
  Nerolidol:     "bg-teal-500/15 text-teal-500",
  Geraniol:      "bg-cyan-500/15 text-cyan-500",
  Camphene:      "bg-indigo-500/15 text-indigo-500",
};

export const COMMON_FLAVORS = [
  "Earthy", "Citrus", "Pine", "Berry", "Diesel", "Floral", "Spicy",
  "Sweet", "Skunky", "Woody", "Tropical", "Minty", "Cheese", "Coffee",
  "Grape", "Lavender",
] as const;

export const COMMON_EFFECTS = [
  "Relaxed", "Euphoric", "Creative", "Focused", "Energetic", "Sleepy",
  "Hungry", "Happy", "Uplifted", "Tingly", "Giggly", "Talkative",
] as const;

// ─── grow_tasks ───────────────────────────────────────────────────────────────
export const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled", "overdue"] as const;
export type TaskStatus = typeof TASK_STATUSES[number];
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];

// ─── grow_task_templates ──────────────────────────────────────────────────────
export const TASK_TEMPLATE_TYPES = [
  "cultivation", "harvest", "processing", "packaging", "cleaning",
  "maintenance", "compliance", "administrative", "other",
] as const;
export type TaskTemplateType = typeof TASK_TEMPLATE_TYPES[number];
export const TASK_RECURRENCE_TYPES = [
  "once", "daily", "weekly", "biweekly", "monthly", "phase_triggered", "custom_cron",
] as const;
export type TaskRecurrenceType = typeof TASK_RECURRENCE_TYPES[number];

// ─── grow_time_clock_punches ──────────────────────────────────────────────────
export const TIME_PUNCH_TYPES = ["clock_in", "clock_out", "break_start", "break_end"] as const;
export type TimePunchType = typeof TIME_PUNCH_TYPES[number];

// ─── grow_vehicles.vehicle_type ───────────────────────────────────────────────
export const VEHICLE_TYPES = ["delivery", "pickup"] as const;
export type VehicleType = typeof VEHICLE_TYPES[number];

// ─── grow_waste_log.waste_type ────────────────────────────────────────────────
export const WASTE_TYPES = [
  "defoliation", "trim", "male_plant", "pest_damage", "disease",
  "hermaphrodite", "failed_clone", "other",
] as const;
export type WasteType = typeof WASTE_TYPES[number];
