-- ========================================
-- Migration 004: Supplier Documents
-- 采购单(PO) / 供应商发票(Invoice) / 退货·索赔·维修(Returns)
-- 特点：
--   - 三类单据均按 tenant 隔离
--   - PO 不含价格字段（amount / discount / unit_price）
--   - Invoice 必须关联 PO（po_id NOT NULL, ON DELETE RESTRICT）
--   - Returns 完全独立，不关联 PO/Invoice
--   - 附件本地文件存储（storage_path 记录相对文件名）
-- ========================================

-- ============== Purchase Orders ==============
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  po_no VARCHAR(80) NOT NULL,
  po_date DATE NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, po_no)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  item_code VARCHAR(120),
  description TEXT,
  serial_no VARCHAR(200),
  quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchase_order_attachments (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============== Supplier Invoices ==============
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  invoice_no VARCHAR(80) NOT NULL,
  invoice_date DATE NOT NULL,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS supplier_invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  item_code VARCHAR(120),
  description TEXT,
  serial_no VARCHAR(200),
  quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS supplier_invoice_attachments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============== Supplier Returns / Claim / Repair ==============
CREATE TABLE IF NOT EXISTS supplier_returns (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  doc_type VARCHAR(20) NOT NULL CHECK (doc_type IN ('RETURN', 'CLAIM', 'REPAIR')),
  document_no VARCHAR(80) NOT NULL,
  document_date DATE NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, document_no)
);

CREATE TABLE IF NOT EXISTS supplier_return_items (
  id SERIAL PRIMARY KEY,
  return_id INTEGER NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  item_code VARCHAR(120),
  description TEXT,
  serial_no VARCHAR(200),
  quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS supplier_return_attachments (
  id SERIAL PRIMARY KEY,
  return_id INTEGER NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============== Indexes ==============
CREATE INDEX IF NOT EXISTS idx_po_tenant_supplier ON purchase_orders(tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_tenant_date ON purchase_orders(tenant_id, po_date DESC);
CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_attachments_po_id ON purchase_order_attachments(po_id);

CREATE INDEX IF NOT EXISTS idx_inv_tenant_supplier ON supplier_invoices(tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_inv_tenant_date ON supplier_invoices(tenant_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_inv_po_id ON supplier_invoices(po_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_invoice_id ON supplier_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_inv_attachments_invoice_id ON supplier_invoice_attachments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_ret_tenant_supplier ON supplier_returns(tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_ret_tenant_date ON supplier_returns(tenant_id, document_date DESC);
CREATE INDEX IF NOT EXISTS idx_ret_doc_type ON supplier_returns(tenant_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_ret_items_return_id ON supplier_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_ret_attachments_return_id ON supplier_return_attachments(return_id);
