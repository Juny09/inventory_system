-- Migration 013: Add monthly reminder tracking for supplier payment schedules
-- Tracks which month a monthly reminder was last sent to avoid duplicates.

BEGIN;

ALTER TABLE supplier_payment_schedules
ADD COLUMN IF NOT EXISTS monthly_reminded_month INTEGER;

-- Index for fast monthly-reminder queries
CREATE INDEX IF NOT EXISTS idx_sps_monthly_reminded
  ON supplier_payment_schedules(tenant_id, monthly_reminded_month, status);

COMMIT;
