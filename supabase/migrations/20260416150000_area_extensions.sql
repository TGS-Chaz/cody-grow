-- Areas page alignment: expands canopy_type to include all physical-room
-- classifications used by the UI and adds dimension, lighting, plant-capacity,
-- sort-order, and environmental-target columns for monitoring.

BEGIN;

-- Broaden canopy_type to cover the eight types the Areas form offers
ALTER TABLE grow_areas DROP CONSTRAINT IF EXISTS grow_areas_canopy_type_check;
ALTER TABLE grow_areas ADD CONSTRAINT grow_areas_canopy_type_check
  CHECK (canopy_type IS NULL OR canopy_type = ANY (ARRAY[
    'flower','veg','mother','clone','drying','storage','processing','quarantine'
  ]));

-- Space / capacity / lighting
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS length_ft NUMERIC;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS width_ft NUMERIC;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS height_ft NUMERIC;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS max_plant_capacity INT;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS light_wattage INT;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS light_type TEXT;

DO $mig$ BEGIN
  ALTER TABLE grow_areas
    ADD CONSTRAINT grow_areas_light_type_check
    CHECK (light_type IS NULL OR light_type = ANY (ARRAY[
      'led','hps','cmh','fluorescent','natural_greenhouse','mixed'
    ]));
EXCEPTION WHEN duplicate_object THEN NULL; END $mig$;

-- Environmental target ranges (nullable — falls back to org_settings defaults in the UI)
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS target_temp_min_f NUMERIC;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS target_temp_max_f NUMERIC;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS target_humidity_min_pct NUMERIC;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS target_humidity_max_pct NUMERIC;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS target_vpd_min NUMERIC;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS target_vpd_max NUMERIC;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS target_co2_min_ppm INT;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS target_co2_max_ppm INT;

-- Ordering + CCRS notes
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE grow_areas ADD COLUMN IF NOT EXISTS ccrs_notes TEXT;

COMMIT;
