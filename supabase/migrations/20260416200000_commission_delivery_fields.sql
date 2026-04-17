-- Commission tracking fields on org settings
ALTER TABLE grow_org_settings
  ADD COLUMN IF NOT EXISTS commission_rate DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage'
    CHECK (commission_type IN ('percentage', 'fixed_per_order'));

-- Delivery preferences on accounts
ALTER TABLE grow_accounts
  ADD COLUMN IF NOT EXISTS preferred_delivery_days TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_delivery_window TEXT;

COMMENT ON COLUMN grow_accounts.preferred_delivery_days IS
  'Day-of-week preferences (lowercase: monday, tuesday, ...). Used to warn on mismatched manifest scheduling.';
COMMENT ON COLUMN grow_accounts.preferred_delivery_window IS
  'Free-text time window, e.g. "9am-2pm". Displayed on manifest creation.';
