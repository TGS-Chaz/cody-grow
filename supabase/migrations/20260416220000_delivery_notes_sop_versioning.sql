-- Prompt 3 schema bundle: delivery notes, SOP versioning, CCRS submission errors
-- Edge Function secrets remain unchanged.

-- ─── Delivery notes ─────────────────────────────────────────────────────────
ALTER TABLE grow_orders   ADD COLUMN IF NOT EXISTS delivery_notes         TEXT;
ALTER TABLE grow_accounts ADD COLUMN IF NOT EXISTS default_delivery_notes TEXT;

-- ─── SOP versioning ─────────────────────────────────────────────────────────
-- grow_sops already has: title, content, version, is_current, etc.
-- Add explicit version linkage + publish flag.
ALTER TABLE grow_sops ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES grow_sops(id) ON DELETE SET NULL;
ALTER TABLE grow_sops ADD COLUMN IF NOT EXISTS is_published        BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_grow_sops_previous_version ON grow_sops(previous_version_id);

-- ─── CCRS submission error details (for Diff Viewer) ────────────────────────
-- grow_ccrs_submission_files already has status + errors_count; add structured
-- error payload and the submitted record so the diff UI can render old vs. new.
ALTER TABLE grow_ccrs_submission_files ADD COLUMN IF NOT EXISTS ccrs_error_details JSONB;
ALTER TABLE grow_ccrs_submission_files ADD COLUMN IF NOT EXISTS submitted_record   JSONB;

-- ─── Reorder alerts ─────────────────────────────────────────────────────────
-- A batch-level reorder threshold. Dashboard + Batches scan for low-stock
-- batches (current_quantity > 0 AND <= reorder_point) and auto-create
-- in-app notifications.
ALTER TABLE grow_batches ADD COLUMN IF NOT EXISTS reorder_point NUMERIC;
