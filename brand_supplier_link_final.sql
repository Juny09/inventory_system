-- Brand-Supplier 关联脚本
-- 将所有品牌关联到 iklim 供应商 (ID: 33)
-- 使用具体租户ID: 1

-- Pump（水泵）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) 
SELECT 33, b.id, 1 
FROM brands b 
WHERE b.name IN ('Pedrollo', 'Pumpman', 'Stream', 'Unoflow', 'Opalflo', 'Kawamoto', 'Meudy', 'Showfou')
  AND b.tenant_id = 1;

-- Cleaning Equipment（清洁设备）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) 
SELECT 33, b.id, 1 
FROM brands b 
WHERE b.name IN ('Benma', 'Kranzle')
  AND b.tenant_id = 1;

-- Pipe Threading Machine（套丝机）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) 
SELECT 33, b.id, 1 
FROM brands b 
WHERE b.name IN ('Kama', 'Qing Yang')
  AND b.tenant_id = 1;

-- Power Tools（电动工具）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) 
SELECT 33, b.id, 1 
FROM brands b 
WHERE b.name = 'ZhongYue'
  AND b.tenant_id = 1;

-- Generator / Engine（发电机 / 引擎）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) 
SELECT 33, b.id, 1 
FROM brands b 
WHERE b.name IN ('Benma', 'ZongShen', 'Kama')
  AND b.tenant_id = 1;

-- Food Machine（食品设备）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) 
SELECT 33, b.id, 1 
FROM brands b 
WHERE b.name IN ('Golden Bull', 'Golden Tortoise')
  AND b.tenant_id = 1;

-- Machinery（机械设备）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) 
SELECT 33, b.id, 1 
FROM brands b 
WHERE b.name IN ('Greenco', 'Mixtec', 'SiFang', 'WestLing', 'Wufu')
  AND b.tenant_id = 1;

-- Varem（压力罐）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) 
SELECT 33, b.id, 1 
FROM brands b 
WHERE b.name = 'Varem'
  AND b.tenant_id = 1;

-- 提示：此脚本使用具体租户ID 1，可直接执行