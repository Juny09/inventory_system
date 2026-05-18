ALTER TABLE supplier_invoices
ADD COLUMN IF NOT EXISTS price_includes_discount BOOLEAN DEFAULT FALSE;
