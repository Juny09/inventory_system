-- 007_add_brands.sql
-- 新增品牌主数据，Supplier 多对多、Product 单对多
BEGIN;

CREATE TABLE IF NOT EXISTS brands (
  id           SERIAL PRIMARY KEY,
  tenant_id    INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(150) NOT NULL,
  description  TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_brands_tenant ON brands(tenant_id);

-- Supplier <-> Brand 多对多关联
CREATE TABLE IF NOT EXISTS supplier_brands (
  supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  brand_id    INT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  tenant_id   INT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (supplier_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_brands_brand  ON supplier_brands(brand_id);
CREATE INDEX IF NOT EXISTS idx_supplier_brands_tenant ON supplier_brands(tenant_id);

-- Product 单对多 Brand
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand_id INT REFERENCES brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);

COMMIT;
