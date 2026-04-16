-- Products page alignment: adds pricing, tax, compliance-flag, packaging, and
-- labeling columns to grow_products plus a description + audit fields to
-- grow_product_lines. Enforces the full CCRS inventory_type CHECK so the
-- Product form can't drift out of spec.

BEGIN;

-- ─── grow_products extensions ──────────────────────────────────────────────
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS upc TEXT;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS unit_price NUMERIC;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS unit_of_measure TEXT;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS default_package_size NUMERIC;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS is_taxable BOOLEAN DEFAULT true;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS tax_rate_override NUMERIC;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS is_medical BOOLEAN DEFAULT false;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS is_doh_compliant BOOLEAN DEFAULT false;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS is_trade_sample BOOLEAN DEFAULT false;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS is_employee_sample BOOLEAN DEFAULT false;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS requires_lab_testing BOOLEAN DEFAULT true;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS requires_child_resistant_packaging BOOLEAN DEFAULT true;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS warning_text TEXT;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS weight_display_format TEXT;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS custom_label_notes TEXT;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $mig$ BEGIN
  ALTER TABLE grow_products
    ADD CONSTRAINT grow_products_unit_of_measure_check
    CHECK (unit_of_measure IS NULL OR unit_of_measure = ANY (ARRAY[
      'grams','ounces','pounds','kilograms','units','milliliters','liters','each'
    ]));
EXCEPTION WHEN duplicate_object THEN NULL; END $mig$;

DO $mig$ BEGIN
  ALTER TABLE grow_products
    ADD CONSTRAINT grow_products_weight_display_format_check
    CHECK (weight_display_format IS NULL OR weight_display_format = ANY (ARRAY['grams_only','ounces_only','both']));
EXCEPTION WHEN duplicate_object THEN NULL; END $mig$;

-- Enforce the full CCRS Inventory Type list on ccrs_inventory_type so the
-- product form can't drift out of spec. This is the union of all types
-- across the four categories; cross-category validity is enforced in UI
-- via CCRS_CATEGORY_TYPE_MAP.
DO $mig$ BEGIN
  ALTER TABLE grow_products
    ADD CONSTRAINT grow_products_ccrs_inventory_type_check
    CHECK (ccrs_inventory_type IS NULL OR ccrs_inventory_type = ANY (ARRAY[
      'Seed','Plant','Clone',
      'Wet Flower','Wet Other Material','Flower Unlotted','Flower Lot','Other Material Unlotted','Other Material Lot',
      'Marijuana Mix','Concentrate for Inhalation','Non-Solvent based Concentrate','Hydrocarbon Concentrate','CO2 Concentrate','Ethanol Concentrate','Food Grade Solvent Concentrate','Infused Cooking Medium','CBD','Waste Usable Marijuana',
      'Capsule','Solid Edible','Tincture','Liquid Edible','Transdermal','Topical Ointment','Marijuana Mix Packaged','Marijuana Mix Infused','Suppository','Sample Jar',
      'Waste'
    ]));
EXCEPTION WHEN duplicate_object THEN NULL; END $mig$;

-- Drop the legacy category CHECK — it was limited to a pre-CCRS shortlist
-- ('Flower', 'Concentrate', etc.) and now conflicts with the full CCRS
-- InventoryType list. ccrs_inventory_type_check is now the source of truth.
ALTER TABLE grow_products DROP CONSTRAINT IF EXISTS grow_products_category_check;

-- Backfill sort_order and is_active so existing products sort cleanly
UPDATE grow_products SET sort_order = 0 WHERE sort_order IS NULL;
UPDATE grow_products SET is_active = NOT COALESCE(is_discontinued, false) WHERE is_active IS NULL;

-- ─── grow_product_lines extensions ──────────────────────────────────────────
ALTER TABLE grow_product_lines ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE grow_product_lines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

COMMIT;
