-- Integrations + marketplace + activity view bundle
-- Everything prompt 2/3: QBO ids, menu push, catalog groups, product/batch images, recent activity matview

-- ─── QuickBooks external id columns ─────────────────────────────────────────
ALTER TABLE grow_accounts ADD COLUMN IF NOT EXISTS quickbooks_customer_id TEXT;
ALTER TABLE grow_invoices ADD COLUMN IF NOT EXISTS quickbooks_invoice_id TEXT;
ALTER TABLE grow_payments  ADD COLUMN IF NOT EXISTS quickbooks_payment_id  TEXT;

-- ─── Menu push-through ──────────────────────────────────────────────────────
ALTER TABLE grow_accounts ADD COLUMN IF NOT EXISTS menu_push_enabled BOOLEAN DEFAULT false;
ALTER TABLE grow_accounts ADD COLUMN IF NOT EXISTS menu_push_url TEXT;

-- ─── Marketplace catalog groups ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grow_marketplace_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  menu_id UUID NOT NULL REFERENCES grow_marketplace_menus(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grow_marketplace_groups_menu ON grow_marketplace_groups(menu_id, sort_order);

ALTER TABLE grow_marketplace_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members select groups" ON grow_marketplace_groups;
DROP POLICY IF EXISTS "org members insert groups" ON grow_marketplace_groups;
DROP POLICY IF EXISTS "org members update groups" ON grow_marketplace_groups;
DROP POLICY IF EXISTS "org members delete groups" ON grow_marketplace_groups;

CREATE POLICY "org members select groups" ON grow_marketplace_groups
  FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY "org members insert groups" ON grow_marketplace_groups
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY "org members update groups" ON grow_marketplace_groups
  FOR UPDATE USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY "org members delete groups" ON grow_marketplace_groups
  FOR DELETE USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

ALTER TABLE grow_batches ADD COLUMN IF NOT EXISTS marketplace_group_id UUID REFERENCES grow_marketplace_groups(id) ON DELETE SET NULL;

-- ─── Product + batch image urls ─────────────────────────────────────────────
ALTER TABLE grow_products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE grow_batches  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ─── Recent-activity materialized view ──────────────────────────────────────
-- Refresh periodically (pg_cron every 5 min) or via trigger on audit insert.
-- Keep last 30d, cap at 1000 rows per view scan.
DROP MATERIALIZED VIEW IF EXISTS grow_recent_activity;
CREATE MATERIALIZED VIEW grow_recent_activity AS
SELECT
  al.id,
  al.org_id,
  al.user_id,
  al.user_email,
  al.action,
  al.entity_type,
  al.entity_id,
  al.entity_name,
  al.created_at,
  COALESCE(p.full_name, p.email) AS user_name,
  p.avatar_url                   AS user_avatar
FROM grow_audit_log al
LEFT JOIN organization_members p ON p.id = al.user_id
WHERE al.created_at > NOW() - INTERVAL '30 days'
ORDER BY al.created_at DESC
LIMIT 1000;

CREATE INDEX IF NOT EXISTS idx_grow_recent_activity_org
  ON grow_recent_activity(org_id, created_at DESC);

-- Helper: anyone authenticated can re-run REFRESH through an RPC that's
-- permissions-scoped. Refresh it now so the view is populated on migration.
REFRESH MATERIALIZED VIEW grow_recent_activity;
