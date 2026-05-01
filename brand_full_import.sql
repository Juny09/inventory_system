-- 完整品牌导入脚本
-- 包含品牌插入 + iklim供应商关联

-- 使用租户ID: 1

-- Pump（水泵）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
(1, 'Pedrollo', '意大利知名水泵品牌', TRUE),
(1, 'Pumpman', '专业水泵制造商', TRUE),
(1, 'Stream', '流体控制解决方案品牌', TRUE),
(1, 'Unoflow', '高效水泵技术品牌', TRUE),
(1, 'Opalflo', '工业水泵品牌', TRUE),
(1, 'Kawamoto', '日本水泵制造商', TRUE),
(1, 'Meudy', '专业水泵品牌', TRUE),
(1, 'Showfou', '水泵设备品牌', TRUE);

-- Cleaning Equipment（清洁设备）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
(1, 'Benma', '清洁设备制造商', TRUE),
(1, 'Kranzle', '德国高压清洗机品牌', TRUE);

-- Pipe Threading Machine（套丝机）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
(1, 'Kama', '套丝机专业制造商', TRUE),
(1, 'Qing Yang', '中国套丝机品牌', TRUE);

-- Power Tools（电动工具）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
(1, 'ZhongYue', '电动工具品牌', TRUE);

-- Generator / Engine（发电机 / 引擎）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
(1, 'Benma', '发电机制造商', TRUE),
(1, 'ZongShen', '宗申发动机品牌', TRUE),
(1, 'Kama', '发电机设备品牌', TRUE);

-- Food Machine（食品设备）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
(1, 'Golden Bull', '食品加工设备品牌', TRUE),
(1, 'Golden Tortoise', '食品机械品牌', TRUE);

-- Machinery（机械设备）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
(1, 'Greenco', '绿色机械设备品牌', TRUE),
(1, 'Mixtec', '混合机械设备品牌', TRUE),
(1, 'SiFang', '四方机械设备品牌', TRUE),
(1, 'WestLing', '西方机械设备品牌', TRUE),
(1, 'Wufu', '五福机械设备品牌', TRUE);

-- Varem（压力罐）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
(1, 'Varem', '意大利压力罐品牌', TRUE);

-- 品牌与 iklim 供应商 (ID: 33) 关联
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

-- 提示：此脚本包含品牌插入和关联，可直接执行