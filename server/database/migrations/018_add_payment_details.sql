-- Migration 018: Add cheque_number and payment_slip_number to supplier_payment_records
BEGIN;

ALTER TABLE IF EXISTS supplier_payment_records
  ADD COLUMN IF NOT EXISTS cheque_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_slip_number VARCHAR(100);

COMMIT;
