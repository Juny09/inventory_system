-- 库存系统主结构
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  preferred_currency VARCHAR(10) NOT NULL DEFAULT 'MYR',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) NOT NULL DEFAULT 'MYR';

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  address TEXT,
  manager_name VARCHAR(120),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  sku VARCHAR(60) NOT NULL UNIQUE,
  sku_type VARCHAR(20) NOT NULL DEFAULT 'SINGLE',
  product_code VARCHAR(80) UNIQUE,
  barcode VARCHAR(80) UNIQUE,
  image_data TEXT,
  description TEXT,
  usage_guide TEXT,
  pros TEXT,
  cons TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  markup_percentage NUMERIC(8, 2) NOT NULL DEFAULT 0,
  suggested_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code VARCHAR(80);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku_type VARCHAR(20) NOT NULL DEFAULT 'SINGLE';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_data TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage_guide TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pros TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cons TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS markup_percentage NUMERIC(8, 2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS suggested_price NUMERIC(12, 2) NOT NULL DEFAULT 0;
UPDATE products
SET product_code = CONCAT('PRD-', LPAD(id::text, 5, '0'))
WHERE product_code IS NULL;
UPDATE products
SET suggested_price = selling_price
WHERE suggested_price IS NULL OR suggested_price = 0;

CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_data TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_bundle_items (
  id SERIAL PRIMARY KEY,
  combo_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  item_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  item_quantity NUMERIC(12, 3) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (combo_product_id, item_product_id)
);

INSERT INTO product_images (product_id, image_data, sort_order, is_primary)
SELECT products.id, products.image_data, 0, TRUE
FROM products
WHERE products.image_data IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM product_images
    WHERE product_images.product_id = products.id
  );

CREATE TABLE IF NOT EXISTS product_pricing_rules (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rule_name VARCHAR(120) NOT NULL,
  channel_key VARCHAR(80),
  markup_percentage NUMERIC(8, 2) NOT NULL DEFAULT 0,
  suggested_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE product_pricing_rules ADD COLUMN IF NOT EXISTS channel_key VARCHAR(80);
UPDATE product_pricing_rules
SET channel_key = LOWER(rule_name)
WHERE channel_key IS NULL;

INSERT INTO product_pricing_rules (product_id, rule_name, markup_percentage, suggested_price, is_default, sort_order)
SELECT products.id, 'Retail', products.markup_percentage, products.suggested_price, TRUE, 0
FROM products
WHERE NOT EXISTS (
  SELECT 1
  FROM product_pricing_rules
  WHERE product_pricing_rules.product_id = products.id
);

CREATE TABLE IF NOT EXISTS stock_levels (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  allocated_quantity INTEGER NOT NULL DEFAULT 0 CHECK (allocated_quantity >= 0),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id, warehouse_id)
);

ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS allocated_quantity INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS marketplace_sync_logs (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(30) NOT NULL,
  sync_type VARCHAR(30) NOT NULL DEFAULT 'inventory',
  status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
  records_count INTEGER NOT NULL DEFAULT 0,
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_inventory_snapshots (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(30) NOT NULL,
  external_sku VARCHAR(120) NOT NULL,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
  on_hand INTEGER NOT NULL DEFAULT 0,
  allocated_quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_connections (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(30) NOT NULL UNIQUE,
  shop_name VARCHAR(120),
  api_base_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_oauth_states (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(30) NOT NULL,
  state_token VARCHAR(120) NOT NULL UNIQUE,
  redirect_uri TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_error_logs (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(30) NOT NULL,
  operation VARCHAR(60) NOT NULL,
  error_code VARCHAR(60) NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id VARCHAR(60),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(30) NOT NULL,
  external_order_id VARCHAR(120) NOT NULL,
  order_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  buyer_name VARCHAR(120),
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  order_created_at TIMESTAMP,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel, external_order_id)
);

CREATE TABLE IF NOT EXISTS marketplace_order_items (
  id SERIAL PRIMARY KEY,
  marketplace_order_id INTEGER NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  external_item_id VARCHAR(120),
  external_sku VARCHAR(120),
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS shipping_shipments (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(30),
  marketplace_order_id INTEGER REFERENCES marketplace_orders(id) ON DELETE SET NULL,
  shipment_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  carrier VARCHAR(80),
  service_level VARCHAR(80),
  tracking_no VARCHAR(120),
  label_url TEXT,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'TRANSFER')),
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
  destination_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reference_no VARCHAR(80),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_counts (
  id SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'COMPLETED', 'APPLIED')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  applied_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  applied_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_count_items (
  id SERIAL PRIMARY KEY,
  stock_count_id INTEGER NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  expected_quantity INTEGER NOT NULL DEFAULT 0 CHECK (expected_quantity >= 0),
  counted_quantity INTEGER CHECK (counted_quantity >= 0),
  difference_quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  UNIQUE (stock_count_id, product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(150),
  user_role VARCHAR(20),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120),
  method VARCHAR(10) NOT NULL,
  path TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS low_stock_alert_states (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'READ', 'IGNORED')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  company_name VARCHAR(180),
  contact_name VARCHAR(120),
  phone VARCHAR(60),
  email VARCHAR(160),
  address TEXT,
  payment_terms TEXT,
  lead_time_days INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(180);

CREATE TABLE IF NOT EXISTS product_suppliers (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id, supplier_id)
);

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2);

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS purchase_reason TEXT;

CREATE TABLE IF NOT EXISTS product_cost_price_histories (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_cost_price NUMERIC(12,2) NOT NULL,
  new_cost_price NUMERIC(12,2) NOT NULL,
  percent_change NUMERIC(10,4) NOT NULL,
  reason TEXT,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_notifications (
  id SERIAL PRIMARY KEY,
  notification_type VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_role VARCHAR(20),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(120) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_statements (
  id SERIAL PRIMARY KEY,
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  statement_month DATE NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (uploaded_by, statement_month)
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_code_unique ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_bundle_items_combo_id ON product_bundle_items(combo_product_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_rules_product_id ON product_pricing_rules(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_product_id ON stock_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_warehouse_id ON stock_levels(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_snapshots_channel ON marketplace_inventory_snapshots(channel);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_channel ON marketplace_orders(channel);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON marketplace_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_marketplace_oauth_states_channel ON marketplace_oauth_states(channel);
CREATE INDEX IF NOT EXISTS idx_marketplace_oauth_states_expires_at ON marketplace_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_marketplace_error_logs_channel ON marketplace_error_logs(channel);
CREATE INDEX IF NOT EXISTS idx_marketplace_error_logs_created_at ON marketplace_error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_order_items_order_id ON marketplace_order_items(marketplace_order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_shipments_status ON shipping_shipments(shipment_status);
CREATE INDEX IF NOT EXISTS idx_stock_counts_warehouse_id ON stock_counts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_counts_status ON stock_counts(status);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_stock_count_id ON stock_count_items(stock_count_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_low_stock_alert_states_status ON low_stock_alert_states(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier_id ON product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_is_primary ON product_suppliers(is_primary);
CREATE INDEX IF NOT EXISTS idx_product_cost_price_histories_product_id ON product_cost_price_histories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_cost_price_histories_changed_at ON product_cost_price_histories(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_notifications_created_at ON system_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_notifications_type ON system_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_bank_statements_uploaded_by ON bank_statements(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_bank_statements_statement_month ON bank_statements(statement_month DESC);
