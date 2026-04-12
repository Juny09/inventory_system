-- 库存系统主结构
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id, warehouse_id)
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

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_code_unique ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_rules_product_id ON product_pricing_rules(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_product_id ON stock_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_warehouse_id ON stock_levels(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_counts_warehouse_id ON stock_counts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_counts_status ON stock_counts(status);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_stock_count_id ON stock_count_items(stock_count_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_low_stock_alert_states_status ON low_stock_alert_states(status);
