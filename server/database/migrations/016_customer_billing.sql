-- ================================================================
-- Migration 016: Monthly Customer Billing (AR)
-- ================================================================
-- 目标：
--   - customers 主数据
--   - customer_bills 按自然月出账（含状态）
--   - customer_bill_items 明细行自动汇总 total_amount
--   - customer_attachments / customer_bill_attachments 支持附件上传
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  company_name VARCHAR(180),
  contact_name VARCHAR(120),
  phone VARCHAR(60),
  email VARCHAR(160),
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_name
  ON customers(tenant_id, name);

CREATE TABLE IF NOT EXISTS customer_bills (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  period_year INTEGER NOT NULL CHECK (period_year >= 2000),
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','OVERDUE')),
  due_date DATE,
  currency VARCHAR(10) NOT NULL DEFAULT 'MYR',
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, customer_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_customer_bills_period
  ON customer_bills(tenant_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_customer_bills_customer
  ON customer_bills(tenant_id, customer_id, period_year, period_month);

CREATE TABLE IF NOT EXISTS customer_bill_items (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL REFERENCES customer_bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12, 3) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_customer_bill_items_bill_id
  ON customer_bill_items(bill_id);

CREATE TABLE IF NOT EXISTS customer_bill_attachments (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL REFERENCES customer_bills(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_bill_attachments_bill_id
  ON customer_bill_attachments(bill_id);

CREATE TABLE IF NOT EXISTS customer_attachments (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_attachments_customer_id
  ON customer_attachments(tenant_id, customer_id);

COMMIT;

