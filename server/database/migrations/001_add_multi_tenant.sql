-- ========================================
-- 多租户改造迁移脚本
-- 里程碑 1：数据库 Schema 改造
-- ========================================

-- 1. 创建 tenants 表（公司/租户表）
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,           -- 公司代码（登录用，如 "DEMO"）
  name VARCHAR(180) NOT NULL,                  -- 公司全称
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED')),
  plan VARCHAR(40) NOT NULL DEFAULT 'FREE',   -- 套餐：FREE / PRO / ENTERPRISE
  max_users INTEGER NOT NULL DEFAULT 5,       -- 最大用户数
  contact_email VARCHAR(160),
  contact_phone VARCHAR(60),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_code ON tenants(code);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 2. 创建默认租户（将所有现有数据分配给它）
INSERT INTO tenants (id, code, name, status, plan, max_users, contact_email)
VALUES (1, 'DEFAULT', 'Default Company', 'ACTIVE', 'ENTERPRISE', 999, 'admin@inventory.local')
ON CONFLICT (id) DO NOTHING;

-- 确保 sequence 不会和默认数据冲突
SELECT setval('tenants_id_seq', GREATEST((SELECT MAX(id) FROM tenants), 1));

-- 3. 为所有业务表添加 tenant_id 字段（默认值 1 - 把旧数据分配给默认租户）
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE stock_count_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE product_bundle_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE product_pricing_rules ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE product_suppliers ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE product_cost_price_histories ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE supplier_payment_records ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE low_stock_alert_states ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE bank_statements ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE marketplace_connections ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE marketplace_sync_logs ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE marketplace_inventory_snapshots ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE marketplace_oauth_states ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE marketplace_error_logs ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE marketplace_order_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE shipping_shipments ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id) ON DELETE CASCADE;

-- 4. 调整唯一约束：从全局唯一 → 租户内唯一
-- users.email: 全局唯一 → (tenant_id, email) 唯一
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

-- categories.name: 全局唯一 → (tenant_id, name) 唯一
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_tenant_name ON categories(tenant_id, name);

-- warehouses.code: 全局唯一 → (tenant_id, code) 唯一
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_tenant_code ON warehouses(tenant_id, code);

-- products.sku/product_code/barcode: 全局唯一 → (tenant_id, xxx) 唯一
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_product_code_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;
DROP INDEX IF EXISTS idx_products_product_code_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_sku ON products(tenant_id, sku);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_product_code ON products(tenant_id, product_code) WHERE product_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_barcode ON products(tenant_id, barcode) WHERE barcode IS NOT NULL;

-- 5. 新增租户维度的索引（提升查询性能）
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant_id ON warehouses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_tenant_id ON stock_levels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_id ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- 6. 迁移完成，移除 tenant_id 的 DEFAULT 值（让后续插入必须显式指定）
-- 注意：此步骤让代码强制传 tenant_id，避免忘记隔离
-- 如果你想保留 DEFAULT（兼容性更好），可以注释掉这一块
-- 暂时保留 DEFAULT，确保现有代码改造期间不会炸，改造完成后再移除

-- 7. 更新 audit_logs 的 tenant_id（已存在记录设置为 1）
UPDATE audit_logs SET tenant_id = 1 WHERE tenant_id IS NULL;
