-- Migration 005: Supplier Payment Schedules (monthly installment plan with reminders)
-- Tracks how much the tenant owes a supplier per month, with due date & auto-reminder.
-- Does NOT replace supplier_payment_records (which logs actual paid history per month).

BEGIN;

CREATE TABLE IF NOT EXISTS supplier_payment_schedules (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year >= 2000),
  due_date DATE NOT NULL,
  amount_due NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE')),
  remind_days_before INTEGER NOT NULL DEFAULT 3 CHECK (remind_days_before >= 0),
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  overdue_reminded_date DATE,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, supplier_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_sps_tenant_supplier
  ON supplier_payment_schedules(tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_sps_due_date
  ON supplier_payment_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_sps_status
  ON supplier_payment_schedules(status);

COMMIT;
