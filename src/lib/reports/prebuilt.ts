/**
 * Prebuilt report definitions — the 15 system reports that ship with Cody Grow.
 *
 * Each report is a template: display metadata + query_config + chart_config.
 * If the org's `grow_saved_reports` table doesn't already have these (seeded
 * by migration), the hooks fall back to these in-memory definitions so users
 * still see the report library on every fresh install.
 */

import type { ReportQueryConfig } from "./runReport";

export type ReportCategory = "cultivation" | "inventory" | "sales" | "labor" | "financial" | "compliance" | "environmental";

export interface ChartConfig {
  type: "bar" | "line" | "pie" | "area";
  x_field: string;
  y_field: string;
  group_by?: string;
}

export interface PrebuiltReport {
  key: string;
  name: string;
  description: string;
  category: ReportCategory;
  icon: string;
  query_config: ReportQueryConfig;
  columns_config: Array<{ field: string; label: string; format?: "number" | "currency" | "date" | "percent" | "weight" }>;
  chart_config?: ChartConfig;
  filters_config?: Array<{ field: string; label: string; type: "date_range" | "select" | "text"; source?: string }>;
}

export const PREBUILT_REPORTS: PrebuiltReport[] = [
  // ─── Cultivation (4) ──────────────────────────────────────────────────────
  {
    key: "active_plants_by_strain",
    name: "Current Active Plants by Strain",
    description: "Live count of plants per strain + growth stage.",
    category: "cultivation",
    icon: "Leaf",
    query_config: {
      data_source: "grow_plants",
      columns: ["id", "strain_id", "phase", "ccrs_plant_state"],
      filters: [{ field: "phase", op: "not", value: null }],
      group_by: "strain_id",
      aggregates: [{ field: "id", kind: "count", alias: "total" }],
    },
    columns_config: [
      { field: "strain_name", label: "Strain" },
      { field: "total", label: "Total", format: "number" },
    ],
    chart_config: { type: "bar", x_field: "strain_name", y_field: "total" },
  },
  {
    key: "yield_per_strain",
    name: "Yield per Strain (90 days)",
    description: "Average yield g/sqft per strain for the last 90 days.",
    category: "cultivation",
    icon: "Scissors",
    query_config: {
      data_source: "grow_harvests",
      date_field: "harvest_started_at",
      filters: [{ field: "status", op: "eq", value: "completed" }],
      group_by: "strain_id",
      aggregates: [
        { field: "dry_weight_grams", kind: "sum", alias: "total_dry_g" },
        { field: "dry_weight_grams", kind: "avg", alias: "avg_dry_g" },
      ],
    },
    columns_config: [
      { field: "strain_name", label: "Strain" },
      { field: "total_dry_g", label: "Total Dry", format: "weight" },
      { field: "avg_dry_g", label: "Avg/Harvest", format: "weight" },
    ],
    chart_config: { type: "bar", x_field: "strain_name", y_field: "avg_dry_g" },
    filters_config: [{ field: "date_range", label: "Date range", type: "date_range" }],
  },
  {
    key: "grams_per_sqft_by_area",
    name: "Grams per Square Foot by Area",
    description: "Area efficiency — total yield divided by canopy sqft.",
    category: "cultivation",
    icon: "MapPin",
    query_config: {
      data_source: "grow_harvests",
      filters: [{ field: "status", op: "eq", value: "completed" }],
      group_by: "area_id",
      aggregates: [{ field: "dry_weight_grams", kind: "sum", alias: "total_dry_g" }],
    },
    columns_config: [
      { field: "area_name", label: "Area" },
      { field: "total_dry_g", label: "Total Yield", format: "weight" },
      { field: "canopy_sqft", label: "Canopy (sqft)", format: "number" },
      { field: "g_per_sqft", label: "g/sqft", format: "number" },
    ],
    chart_config: { type: "bar", x_field: "area_name", y_field: "g_per_sqft" },
  },
  {
    key: "upcoming_harvests",
    name: "Upcoming Harvests (30 days)",
    description: "Cycles with expected harvest date in the next 30 days.",
    category: "cultivation",
    icon: "CalendarDays",
    query_config: {
      data_source: "grow_cycles",
      columns: ["id", "name", "strain_id", "area_id", "expected_harvest_date", "plant_count", "phase"],
      filters: [{ field: "phase", op: "in", value: ["flowering", "ready_for_harvest"] }],
      order_by: [{ field: "expected_harvest_date", ascending: true }],
    },
    columns_config: [
      { field: "name", label: "Cycle" },
      { field: "strain_name", label: "Strain" },
      { field: "area_name", label: "Area" },
      { field: "expected_harvest_date", label: "Expected", format: "date" },
      { field: "plant_count", label: "Plants", format: "number" },
    ],
  },

  // ─── Inventory (2) ────────────────────────────────────────────────────────
  {
    key: "inventory_aging",
    name: "Inventory Aging Report",
    description: "Batches by age in inventory, with aging bands.",
    category: "inventory",
    icon: "Package",
    query_config: {
      data_source: "grow_batches",
      columns: ["id", "barcode", "product_id", "current_quantity", "current_weight_grams", "created_at"],
      filters: [{ field: "current_quantity", op: "gt", value: 0 }],
      order_by: [{ field: "created_at", ascending: true }],
    },
    columns_config: [
      { field: "barcode", label: "Barcode" },
      { field: "product_name", label: "Product" },
      { field: "current_quantity", label: "Qty", format: "weight" },
      { field: "age_days", label: "Age (days)", format: "number" },
      { field: "aging_band", label: "Band" },
    ],
  },
  {
    key: "waste_log_by_type",
    name: "Waste Log by Type",
    description: "Pie chart of destructions by CCRS reason.",
    category: "inventory",
    icon: "Trash2",
    query_config: {
      data_source: "grow_disposals",
      date_field: "destroyed_at",
      group_by: "ccrs_destruction_reason",
      aggregates: [{ field: "pre_disposal_weight_grams", kind: "sum", alias: "total_weight_g" }],
    },
    columns_config: [
      { field: "ccrs_destruction_reason", label: "Reason" },
      { field: "count", label: "Events", format: "number" },
      { field: "total_weight_g", label: "Weight", format: "weight" },
    ],
    chart_config: { type: "pie", x_field: "ccrs_destruction_reason", y_field: "total_weight_g" },
    filters_config: [{ field: "date_range", label: "Date range", type: "date_range" }],
  },

  {
    key: "procurement_by_farm",
    name: "Procurement by Farm",
    description: "Batches grouped by supplier farm — total weight and count.",
    category: "inventory",
    icon: "Building2",
    query_config: {
      data_source: "grow_batches",
      group_by: "procurement_farm",
      filters: [{ field: "procurement_farm", op: "neq", value: null }],
      aggregates: [
        { field: "initial_weight_grams", kind: "sum", alias: "total_weight_g" },
        { field: "unit_cost", kind: "sum", alias: "total_cost" },
      ],
    },
    columns_config: [
      { field: "procurement_farm", label: "Farm" },
      { field: "procurement_license", label: "License" },
      { field: "count", label: "Batches", format: "number" },
      { field: "total_weight_g", label: "Total weight", format: "weight" },
      { field: "total_cost", label: "Total cost", format: "currency" },
    ],
    chart_config: { type: "bar", x_field: "procurement_farm", y_field: "total_weight_g" },
  },

  // ─── Sales (2) ────────────────────────────────────────────────────────────
  {
    key: "top_customers",
    name: "Top 10 Customers by Revenue",
    description: "Biggest wholesale accounts by revenue.",
    category: "sales",
    icon: "Building2",
    query_config: {
      data_source: "grow_orders",
      date_field: "created_at",
      filters: [{ field: "status", op: "eq", value: "completed" }],
      group_by: "account_id",
      aggregates: [
        { field: "total", kind: "sum", alias: "revenue" },
        { field: "id", kind: "count", alias: "order_count" },
        { field: "total", kind: "avg", alias: "avg_order" },
      ],
    },
    columns_config: [
      { field: "account_name", label: "Account" },
      { field: "order_count", label: "Orders", format: "number" },
      { field: "revenue", label: "Revenue", format: "currency" },
      { field: "avg_order", label: "Avg Order", format: "currency" },
    ],
    chart_config: { type: "bar", x_field: "account_name", y_field: "revenue" },
    filters_config: [{ field: "date_range", label: "Date range", type: "date_range" }],
  },
  {
    key: "sales_by_category",
    name: "Sales by Product Category",
    description: "Revenue by CCRS inventory category over time.",
    category: "sales",
    icon: "ShoppingCart",
    query_config: {
      data_source: "grow_orders",
      date_field: "created_at",
      filters: [{ field: "status", op: "eq", value: "completed" }],
    },
    columns_config: [
      { field: "date", label: "Date", format: "date" },
      { field: "category", label: "Category" },
      { field: "revenue", label: "Revenue", format: "currency" },
    ],
    chart_config: { type: "bar", x_field: "category", y_field: "revenue" },
    filters_config: [{ field: "date_range", label: "Date range", type: "date_range" }],
  },

  // ─── Labor (3) ────────────────────────────────────────────────────────────
  {
    key: "tasks_overdue",
    name: "Tasks Overdue",
    description: "Every task past due that isn't completed.",
    category: "labor",
    icon: "ClipboardList",
    query_config: {
      data_source: "grow_tasks",
      columns: ["id", "title", "assigned_to_user_id", "scheduled_end", "priority", "task_type", "status"],
      filters: [
        { field: "scheduled_end", op: "lt", value: new Date().toISOString() },
        { field: "status", op: "not", value: "completed" },
      ],
      order_by: [{ field: "scheduled_end", ascending: true }],
    },
    columns_config: [
      { field: "title", label: "Task" },
      { field: "assignee_name", label: "Assigned To" },
      { field: "scheduled_end", label: "Due", format: "date" },
      { field: "days_overdue", label: "Days Overdue", format: "number" },
      { field: "priority", label: "Priority" },
    ],
  },
  {
    key: "employee_performance",
    name: "Employee Performance (tasks)",
    description: "Tasks completed per employee this period.",
    category: "labor",
    icon: "Users",
    query_config: {
      data_source: "grow_tasks",
      date_field: "completed_at",
      filters: [{ field: "status", op: "eq", value: "completed" }],
      group_by: "assigned_to_user_id",
      aggregates: [
        { field: "id", kind: "count", alias: "completed_count" },
        { field: "actual_duration_minutes", kind: "avg", alias: "avg_duration_min" },
      ],
    },
    columns_config: [
      { field: "employee_name", label: "Employee" },
      { field: "completed_count", label: "Completed", format: "number" },
      { field: "avg_duration_min", label: "Avg Duration (min)", format: "number" },
    ],
    chart_config: { type: "bar", x_field: "employee_name", y_field: "completed_count" },
    filters_config: [{ field: "date_range", label: "Date range", type: "date_range" }],
  },
  {
    key: "labor_cost_per_batch",
    name: "Labor Cost per Batch",
    description: "Hours + cost per batch, cost-per-gram efficiency.",
    category: "labor",
    icon: "DollarSign",
    query_config: {
      data_source: "grow_batches",
      columns: ["id", "barcode", "product_id", "initial_weight_grams"],
      order_by: [{ field: "created_at", ascending: false }],
    },
    columns_config: [
      { field: "barcode", label: "Batch" },
      { field: "product_name", label: "Product" },
      { field: "hours_logged", label: "Hours", format: "number" },
      { field: "labor_cost", label: "Labor Cost", format: "currency" },
      { field: "initial_weight_grams", label: "Weight", format: "weight" },
      { field: "cost_per_gram", label: "Cost/g", format: "currency" },
    ],
  },

  {
    key: "sales_commissions",
    name: "Sales Rep Commissions",
    description: "Per-rep revenue and commission earned for completed orders.",
    category: "labor",
    icon: "DollarSign",
    query_config: {
      data_source: "grow_orders",
      date_field: "completed_at",
      filters: [{ field: "status", op: "eq", value: "completed" }],
      group_by: "created_by",
      aggregates: [
        { field: "total", kind: "sum", alias: "revenue" },
        { field: "id", kind: "count", alias: "order_count" },
      ],
    },
    columns_config: [
      { field: "rep_name", label: "Sales Rep" },
      { field: "order_count", label: "Orders", format: "number" },
      { field: "revenue", label: "Revenue", format: "currency" },
      { field: "commission_amount", label: "Commission", format: "currency" },
    ],
    chart_config: { type: "bar", x_field: "rep_name", y_field: "commission_amount" },
    filters_config: [{ field: "date_range", label: "Date range", type: "date_range" }],
  },

  // ─── Financial (1) ────────────────────────────────────────────────────────
  {
    key: "ar_aging",
    name: "AR Aging Report",
    description: "Outstanding invoices by days-outstanding bands.",
    category: "financial",
    icon: "DollarSign",
    query_config: {
      data_source: "grow_invoices",
      columns: ["id", "invoice_number", "account_id", "total", "balance", "due_date", "invoice_date", "status"],
      filters: [{ field: "balance", op: "gt", value: 0 }],
      order_by: [{ field: "due_date", ascending: true }],
    },
    columns_config: [
      { field: "account_name", label: "Account" },
      { field: "invoice_number", label: "Invoice #" },
      { field: "total", label: "Total", format: "currency" },
      { field: "balance", label: "Balance", format: "currency" },
      { field: "days_outstanding", label: "Days Out", format: "number" },
      { field: "aging_band", label: "Band" },
    ],
  },

  // ─── Compliance (1) ───────────────────────────────────────────────────────
  {
    key: "ccrs_compliance_status",
    name: "CCRS Compliance Status",
    description: "Per-category upload + pending record count.",
    category: "compliance",
    icon: "ShieldCheck",
    query_config: {
      data_source: "grow_ccrs_submission_files",
      order_by: [{ field: "uploaded_at", ascending: false }],
    },
    columns_config: [
      { field: "file_category", label: "Category" },
      { field: "last_uploaded_at", label: "Last Uploaded", format: "date" },
      { field: "pending_records", label: "Pending", format: "number" },
      { field: "last_status", label: "Status" },
    ],
  },

  // ─── Environmental (1) ────────────────────────────────────────────────────
  {
    key: "environmental_anomalies",
    name: "Environmental Anomalies (7 days)",
    description: "Recent alerts across all areas.",
    category: "environmental",
    icon: "Thermometer",
    query_config: {
      data_source: "grow_environmental_alerts",
      date_field: "created_at",
      order_by: [{ field: "created_at", ascending: false }],
    },
    columns_config: [
      { field: "area_name", label: "Area" },
      { field: "alert_type", label: "Type" },
      { field: "severity", label: "Severity" },
      { field: "duration_hours", label: "Duration (hrs)", format: "number" },
      { field: "resolved_at", label: "Resolved", format: "date" },
    ],
    filters_config: [{ field: "date_range", label: "Date range", type: "date_range" }],
  },
];

export function getReportByKey(key: string): PrebuiltReport | undefined {
  return PREBUILT_REPORTS.find((r) => r.key === key);
}

export const REPORT_CATEGORIES: Array<{ key: ReportCategory; label: string }> = [
  { key: "cultivation", label: "Cultivation" },
  { key: "inventory", label: "Inventory" },
  { key: "sales", label: "Sales" },
  { key: "labor", label: "Labor" },
  { key: "financial", label: "Financial" },
  { key: "compliance", label: "Compliance" },
  { key: "environmental", label: "Environmental" },
];

export const CATEGORY_COLORS: Record<ReportCategory, { bg: string; text: string }> = {
  cultivation: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  inventory: { bg: "bg-teal-500/10", text: "text-teal-500" },
  sales: { bg: "bg-blue-500/10", text: "text-blue-500" },
  labor: { bg: "bg-amber-500/10", text: "text-amber-500" },
  financial: { bg: "bg-purple-500/10", text: "text-purple-500" },
  compliance: { bg: "bg-red-500/10", text: "text-red-500" },
  environmental: { bg: "bg-cyan-500/10", text: "text-cyan-500" },
};
