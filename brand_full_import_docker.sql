-- ================================================================
-- 品牌导入脚本 (适配 Docker 数据库)
-- 背景：为 Iklim Hardware & Machinery 供应商导入品牌数据
-- ================================================================

-- Iklim 供应商 ID = 50 (根据当前数据库)
\set iklim_id 50
\set tenant_id 1

-- Pump（水泵）
INSERT INTO brands (tenant_id, name, description, country, made_in, is_active, created_at, updated_at) VALUES
(:tenant_id, 'Pedrollo', '意大利知名水泵品牌', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'Pumpman', '专业水泵制造商', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'Stream', '流体控制解决方案品牌', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'Unoflow', '高效水泵技术品牌', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'Opalflo', '工业水泵品牌', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'Kawamoto', '日本水泵制造商', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'Meudy', '专业水泵品牌', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'Showfou', '水泵设备品牌', NULL, NULL, TRUE, now(), now())
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Cleaning Equipment（清洁设备）
INSERT INTO brands (tenant_id, name, description, country, made_in, is_active, created_at, updated_at) VALUES
(:tenant_id, 'Benma', '清洁设备/发电机制造商', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'Kranzle', '德国高压清洗机品牌', NULL, NULL, TRUE, now(), now())
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Pipe Threading Machine（套丝机）
INSERT INTO brands (tenant_id, name, description, country, made_in, is_active, created_at, updated_at) VALUES
(:tenant_id, 'Kama', '套丝机/发电机专业制造商', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'Qing Yang', '中国套丝机品牌', NULL, NULL, TRUE, now(), now())
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Power Tools（电动工具）
INSERT INTO brands (tenant_id, name, description, country, made_in, is_active, created_at, updated_at) VALUES
(:tenant_id, 'ZhongYue', '电动工具品牌', NULL, NULL, TRUE, now(), now())
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Food Machine（食品设备）
INSERT INTO brands (tenant_id, name, description, country, made_in, is_active, created_at, updated_at) VALUES
(:tenant_id, 'Golden Bull', '食品加工设备品牌', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'Golden Tortoise', '食品机械品牌', NULL, NULL, TRUE, now(), now())
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Machinery（机械设备）
INSERT INTO brands (tenant_id, name, description, country, made_in, is_active, created_at, updated_at) VALUES
(:tenant_id, 'Greenco', '绿色机械设备品牌', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'Mixtec', '混合机械设备品牌', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'SiFang', '四方机械设备品牌', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'WestLing', '西方机械设备品牌', NULL, NULL, TRUE, now(), now()),
(:tenant_id, 'Wufu', '五福机械设备品牌', NULL, NULL, TRUE, now(), now())
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Varem（压力罐）
INSERT INTO brands (tenant_id, name, description, country, made_in, is_active, created_at, updated_at) VALUES
(:tenant_id, 'Varem', '意大利压力罐品牌', NULL, NULL, TRUE, now(), now())
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Generator（新增发电机品牌）
INSERT INTO brands (tenant_id, name, description, country, made_in, is_active, created_at, updated_at) VALUES
(:tenant_id, 'ZongShen', '宗申发动机品牌', NULL, NULL, TRUE, now(), now())
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ================================================================
-- 品牌与 Iklim (ID=:iklim_id) 供应商关联
-- ================================================================

-- Pump 品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id, created_at)
SELECT :iklim_id, b.id, :tenant_id, now()
FROM brands b
WHERE b.name IN ('Pedrollo','Pumpman','Stream','Unoflow','Opalflo','Kawamoto','Meudy','Showfou')
  AND b.tenant_id = :tenant_id
ON CONFLICT (supplier_id, brand_id) DO NOTHING;

-- Cleaning Equipment 品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id, created_at)
SELECT :iklim_id, b.id, :tenant_id, now()
FROM brands b
WHERE b.name IN ('Benma','Kranzle')
  AND b.tenant_id = :tenant_id
ON CONFLICT (supplier_id, brand_id) DO NOTHING;

-- Pipe Threading Machine 品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id, created_at)
SELECT :iklim_id, b.id, :tenant_id, now()
FROM brands b
WHERE b.name IN ('Kama','Qing Yang')
  AND b.tenant_id = :tenant_id
ON CONFLICT (supplier_id, brand_id) DO NOTHING;

-- Power Tools 品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id, created_at)
SELECT :iklim_id, b.id, :tenant_id, now()
FROM brands b
WHERE b.name = 'ZhongYue'
  AND b.tenant_id = :tenant_id
ON CONFLICT (supplier_id, brand_id) DO NOTHING;

-- Generator 品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id, created_at)
SELECT :iklim_id, b.id, :tenant_id, now()
FROM brands b
WHERE b.name IN ('Benma','ZongShen','Kama')
  AND b.tenant_id = :tenant_id
ON CONFLICT (supplier_id, brand_id) DO NOTHING;

-- Food Machine 品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id, created_at)
SELECT :iklim_id, b.id, :tenant_id, now()
FROM brands b
WHERE b.name IN ('Golden Bull','Golden Tortoise')
  AND b.tenant_id = :tenant_id
ON CONFLICT (supplier_id, brand_id) DO NOTHING;

-- Machinery 品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id, created_at)
SELECT :iklim_id, b.id, :tenant_id, now()
FROM brands b
WHERE b.name IN ('Greenco','Mixtec','SiFang','WestLing','Wufu')
  AND b.tenant_id = :tenant_id
ON CONFLICT (supplier_id, brand_id) DO NOTHING;

-- Varem 品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id, created_at)
SELECT :iklim_id, b.id, :tenant_id, now()
FROM brands b
WHERE b.name = 'Varem'
  AND b.tenant_id = :tenant_id
ON CONFLICT (supplier_id, brand_id) DO NOTHING;
