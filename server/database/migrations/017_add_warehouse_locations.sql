-- ================================================================
-- Migration 017: Warehouse locations (location / shelf / bin)
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS warehouse_locations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  location_code VARCHAR(60) NOT NULL,
  location_name VARCHAR(120),
  zone VARCHAR(80),
  shelf VARCHAR(80),
  bin VARCHAR(80),
  level VARCHAR(80),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, warehouse_id, location_code)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_tenant_warehouse
  ON warehouse_locations(tenant_id, warehouse_id);

ALTER TABLE IF EXISTS stock_levels
  ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES warehouse_locations(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS idx_stock_levels_tenant_variant_warehouse;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_levels_tenant_variant_warehouse_null_location
  ON stock_levels(tenant_id, variant_id, warehouse_id)
  WHERE location_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_levels_tenant_variant_warehouse_location
  ON stock_levels(tenant_id, variant_id, warehouse_id, location_id)
  WHERE location_id IS NOT NULL;

ALTER TABLE IF EXISTS stock_movements
  ADD COLUMN IF NOT EXISTS source_location_id INTEGER REFERENCES warehouse_locations(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS stock_movements
  ADD COLUMN IF NOT EXISTS destination_location_id INTEGER REFERENCES warehouse_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_levels_location_id
  ON stock_levels(location_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_source_location_id
  ON stock_movements(source_location_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_destination_location_id
  ON stock_movements(destination_location_id);

COMMIT;
