-- 初始测试账号，方便你直接登录不同角色
INSERT INTO users (full_name, email, password_hash, role)
VALUES
  (
    'System Admin',
    'admin@inventory.local',
    '$2b$10$3kgfDm68MiQoCuoAOgCU5O6.yXQ.B34LYK3ocn3jwGuasF1HTmJAm',
    'ADMIN'
  ),
  (
    'Warehouse Manager',
    'manager@inventory.local',
    '$2b$10$.2ayw6cbRXSRrctAdN.x1utdFbOsbuv3S46I7Uogps9Pl6YtLPevG',
    'MANAGER'
  ),
  (
    'Testing Staff',
    'staff@inventory.local',
    '$2b$10$ObsYMjkQ23/V/Fe52MmMX.99BIkJVzHZRQMJvzfc9kSOpeyxUrEQ6',
    'STAFF'
  ),
  (
    'Testing Account',
    'test@inventory.local',
    '$2b$10$X0qP1vGxzoNPlga2S3SGkOhB802p8ng1xvoLyy7zIe.cy0f7F55Wq',
    'ADMIN'
  )
ON CONFLICT (email) DO NOTHING;

-- 基础分类
INSERT INTO categories (name, description)
VALUES
  ('Electronics', 'Phones, accessories and gadgets'),
  ('Office Supplies', 'Stationery and daily office use')
ON CONFLICT (name) DO NOTHING;

-- 基础仓库
INSERT INTO warehouses (name, code, address, manager_name)
VALUES
  ('Main Warehouse', 'WH-MAIN', 'Shenzhen HQ', 'Alice'),
  ('Outlet Warehouse', 'WH-OUTLET', 'Guangzhou Branch', 'Bob')
ON CONFLICT (code) DO NOTHING;

-- 示例商品
INSERT INTO products (
  name,
  sku,
  barcode,
  description,
  category_id,
  unit,
  cost_price,
  selling_price,
  reorder_level
)
SELECT
  'Wireless Mouse',
  'SKU-MOUSE-001',
  '6901234567890',
  'Ergonomic wireless mouse',
  categories.id,
  'pcs',
  12.50,
  19.90,
  15
FROM categories
WHERE categories.name = 'Electronics'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO products (
  name,
  sku,
  barcode,
  description,
  category_id,
  unit,
  cost_price,
  selling_price,
  reorder_level
)
SELECT
  'USB-C Charging Cable',
  'SKU-CABLE-002',
  '6901234567891',
  'Fast charging cable for mobile devices',
  categories.id,
  'pcs',
  3.20,
  8.90,
  20
FROM categories
WHERE categories.name = 'Electronics'
ON CONFLICT (sku) DO NOTHING;

INSERT INTO stock_levels (product_id, warehouse_id, quantity)
SELECT
  products.id,
  warehouses.id,
  120
FROM products
CROSS JOIN warehouses
WHERE products.sku = 'SKU-MOUSE-001' AND warehouses.code = 'WH-MAIN'
ON CONFLICT (product_id, warehouse_id) DO NOTHING;

INSERT INTO stock_levels (product_id, warehouse_id, quantity)
SELECT
  products.id,
  warehouses.id,
  6
FROM products
CROSS JOIN warehouses
WHERE products.sku = 'SKU-CABLE-002' AND warehouses.code = 'WH-MAIN'
ON CONFLICT (product_id, warehouse_id) DO NOTHING;
