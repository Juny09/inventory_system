-- ================================================================
-- Migration 015: Company Monthly Costs
-- ================================================================
-- 目标：
--   - 按自然月记录公司运营成本（租金/水电/杂费等）
--   - 同租户同月份同类目不允许重复
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS company_monthly_costs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL CHECK (period_year >= 2000),
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  category_key VARCHAR(80) NOT NULL,
  category_label VARCHAR(120) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  occurred_date DATE NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, period_year, period_month, category_key)
);

CREATE INDEX IF NOT EXISTS idx_company_monthly_costs_period
  ON company_monthly_costs(tenant_id, period_year, period_month);

COMMIT;

