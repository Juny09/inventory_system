-- 库存系统主结构
-- 多租户：先创建 tenants（公司/租户）
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED')),
  plan VARCHAR(40) NOT NULL DEFAULT 'FREE',
  max_users INTEGER NOT NULL DEFAULT 5,
  contact_email VARCHAR(160),
  contact_phone VARCHAR(60),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_code ON tenants(code);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 默认租户：旧数据统一归到 DEFAULT（tenant_id=1）
INSERT INTO tenants (id, code, name, status, plan, max_users, contact_email)
VALUES (1, 'DEFAULT', 'Default Company', 'ACTIVE', 'ENTERPRISE', 999, 'admin@inventory.local')
ON CONFLICT (id) DO NOTHING;

SELECT setval('tenants_id_seq', GREATEST((SELECT MAX(id) FROM tenants), 1));

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
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(30) NOT NULL UNIQUE,
  address TEXT,
  manager_name VARCHAR(120),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE IF EXISTS warehouses ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

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
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE products
SET product_code = CONCAT('PRD-', LPAD(id::text, 5, '0'))
WHERE product_code IS NULL;
UPDATE products
SET suggested_price = selling_price
WHERE suggested_price IS NULL OR suggested_price = 0;

-- 产品变体（Variants）：用于尺码/颜色等，不再用“一个尺码=一个产品”
CREATE TABLE IF NOT EXISTS product_variants (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_label VARCHAR(120) NOT NULL DEFAULT 'DEFAULT',
  sku VARCHAR(80) NOT NULL,
  barcode VARCHAR(80),
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  reorder_level INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, sku),
  UNIQUE (tenant_id, product_id, variant_label)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_tenant_id ON product_variants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_tenant_barcode ON product_variants(tenant_id, barcode) WHERE barcode IS NOT NULL;

-- 为历史 products 创建默认变体（DEFAULT），让旧功能可继续工作
INSERT INTO product_variants (tenant_id, product_id, variant_label, sku, barcode, attributes, reorder_level, is_active)
SELECT
  products.tenant_id,
  products.id,
  'DEFAULT',
  products.sku,
  products.barcode,
  '{}'::jsonb,
  products.reorder_level,
  products.is_active
FROM products
WHERE NOT EXISTS (
  SELECT 1
  FROM product_variants
  WHERE product_variants.tenant_id = products.tenant_id
    AND product_variants.product_id = products.id
    AND product_variants.variant_label = 'DEFAULT'
);

CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_data TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE IF EXISTS product_images ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS product_bundle_items (
  id SERIAL PRIMARY KEY,
  combo_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  item_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  item_quantity NUMERIC(12, 3) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (combo_product_id, item_product_id)
);
ALTER TABLE IF EXISTS product_bundle_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

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
ALTER TABLE IF EXISTS product_pricing_rules ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

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
ALTER TABLE IF EXISTS stock_levels ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS stock_levels ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE;

UPDATE stock_levels
SET tenant_id = 1
WHERE tenant_id IS NULL;

UPDATE stock_levels sl
SET variant_id = pv.id
FROM product_variants pv
WHERE sl.variant_id IS NULL
  AND pv.tenant_id = sl.tenant_id
  AND pv.product_id = sl.product_id
  AND pv.variant_label = 'DEFAULT';

ALTER TABLE stock_levels DROP CONSTRAINT IF EXISTS stock_levels_product_id_warehouse_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_levels_tenant_variant_warehouse ON stock_levels(tenant_id, variant_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_variant_id ON stock_levels(variant_id);

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
ALTER TABLE IF EXISTS marketplace_sync_logs ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

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
ALTER TABLE IF EXISTS marketplace_inventory_snapshots ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

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
ALTER TABLE IF EXISTS marketplace_connections ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS marketplace_oauth_states (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(30) NOT NULL,
  state_token VARCHAR(120) NOT NULL UNIQUE,
  redirect_uri TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE IF EXISTS marketplace_oauth_states ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

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
ALTER TABLE IF EXISTS marketplace_error_logs ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

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
ALTER TABLE IF EXISTS marketplace_orders ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

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
ALTER TABLE IF EXISTS marketplace_order_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

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

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS branch VARCHAR(120);

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS business_hours VARCHAR(200);

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS parent_company VARCHAR(180);

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS map_link TEXT;

CREATE TABLE IF NOT EXISTS supplier_payment_records (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year INTEGER NOT NULL CHECK (period_year >= 2000),
  paid_date DATE,
  amount NUMERIC(12, 2),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (supplier_id, period_month, period_year)
);

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

-- 变体维度：为历史流水回填默认变体
ALTER TABLE IF EXISTS stock_movements ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE;
UPDATE stock_movements SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE stock_movements sm
SET variant_id = pv.id
FROM product_variants pv
WHERE sm.variant_id IS NULL
  AND pv.tenant_id = sm.tenant_id
  AND pv.product_id = sm.product_id
  AND pv.variant_label = 'DEFAULT';
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant_id ON stock_movements(variant_id);

-- 盘点明细：改为变体维度
ALTER TABLE IF EXISTS stock_count_items ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE;
UPDATE stock_count_items SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE stock_count_items sci
SET variant_id = pv.id
FROM product_variants pv
WHERE sci.variant_id IS NULL
  AND pv.tenant_id = sci.tenant_id
  AND pv.product_id = sci.product_id
  AND pv.variant_label = 'DEFAULT';
ALTER TABLE stock_count_items DROP CONSTRAINT IF EXISTS stock_count_items_stock_count_id_product_id_warehouse_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_count_items_tenant_variant_warehouse ON stock_count_items(tenant_id, stock_count_id, variant_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_variant_id ON stock_count_items(variant_id);

-- 低库存告警：改为变体维度
ALTER TABLE IF EXISTS low_stock_alert_states ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE;
UPDATE low_stock_alert_states SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE low_stock_alert_states ls
SET variant_id = pv.id
FROM product_variants pv
WHERE ls.variant_id IS NULL
  AND pv.tenant_id = ls.tenant_id
  AND pv.product_id = ls.product_id
  AND pv.variant_label = 'DEFAULT';
ALTER TABLE low_stock_alert_states DROP CONSTRAINT IF EXISTS low_stock_alert_states_product_id_warehouse_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_low_stock_alert_states_tenant_variant_warehouse ON low_stock_alert_states(tenant_id, variant_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_low_stock_alert_states_variant_id ON low_stock_alert_states(variant_id);

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

-- 多租户：为业务表补齐 tenant_id（若已存在则跳过）
ALTER TABLE IF EXISTS suppliers ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS stock_movements ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS stock_counts ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS stock_count_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS product_suppliers ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS product_cost_price_histories ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS supplier_payment_records ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS low_stock_alert_states ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS system_notifications ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS system_settings ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS bank_statements ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS marketplace_connections ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS marketplace_sync_logs ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS marketplace_inventory_snapshots ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS marketplace_oauth_states ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS marketplace_error_logs ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS marketplace_orders ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS marketplace_order_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS shipping_shipments ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

-- 多租户唯一约束：从全局唯一 → 租户内唯一
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_tenant_name ON categories(tenant_id, name);

ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_tenant_code ON warehouses(tenant_id, code);

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_product_code_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;
DROP INDEX IF EXISTS idx_products_product_code_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_sku ON products(tenant_id, sku);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_product_code ON products(tenant_id, product_code) WHERE product_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_barcode ON products(tenant_id, barcode) WHERE barcode IS NOT NULL;

ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_setting_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_settings_tenant_key ON system_settings(tenant_id, setting_key);

ALTER TABLE marketplace_connections DROP CONSTRAINT IF EXISTS marketplace_connections_channel_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_connections_tenant_channel ON marketplace_connections(tenant_id, channel);

ALTER TABLE marketplace_orders DROP CONSTRAINT IF EXISTS marketplace_orders_channel_external_order_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_orders_tenant_channel_order ON marketplace_orders(tenant_id, channel, external_order_id);

ALTER TABLE supplier_payment_records DROP CONSTRAINT IF EXISTS supplier_payment_records_supplier_id_period_month_period_year_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_payment_records_tenant_period ON supplier_payment_records(tenant_id, supplier_id, period_year, period_month);

ALTER TABLE bank_statements DROP CONSTRAINT IF EXISTS bank_statements_uploaded_by_statement_month_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_statements_tenant_user_month ON bank_statements(tenant_id, uploaded_by, statement_month);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
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
CREATE INDEX IF NOT EXISTS idx_supplier_payment_records_supplier_id ON supplier_payment_records(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payment_records_period ON supplier_payment_records(period_year DESC, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_bank_statements_uploaded_by ON bank_statements(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_bank_statements_statement_month ON bank_statements(statement_month DESC);

-- 多租户查询常用索引
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant_id ON warehouses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_tenant_id ON stock_levels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_id ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);

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
CREATE INDEX IF NOT EXISTS idx_sps_tenant_supplier ON supplier_payment_schedules(tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_sps_due_date ON supplier_payment_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_sps_status ON supplier_payment_schedules(status);
