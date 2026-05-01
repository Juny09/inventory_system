-- Brand-Supplier 关联脚本
-- 将所有品牌关联到 iklim 供应商

-- 注意：需要替换 $TENANT_ID 和 $IKLIM_SUPPLIER_ID 为实际值

-- 首先确保 iklim 供应商存在（如果不存在则创建）
-- INSERT INTO suppliers (tenant_id, name, company_name, is_active) 
-- VALUES ($TENANT_ID, 'iklim', 'iklim', TRUE);

-- 然后创建品牌与 iklim 的关联
-- supplier_brands 表结构: supplier_id, brand_id, tenant_id

-- Pump（水泵）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) VALUES
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Pedrollo' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Pumpman' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Stream' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Unoflow' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Opalflo' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Kawamoto' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Meudy' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Showfou' AND tenant_id = $TENANT_ID), $TENANT_ID);

-- Cleaning Equipment（清洁设备）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) VALUES
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Benma' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Kranzle' AND tenant_id = $TENANT_ID), $TENANT_ID);

-- Pipe Threading Machine（套丝机）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) VALUES
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Kama' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Qing Yang' AND tenant_id = $TENANT_ID), $TENANT_ID);

-- Power Tools（电动工具）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) VALUES
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'ZhongYue' AND tenant_id = $TENANT_ID), $TENANT_ID);

-- Generator / Engine（发电机 / 引擎）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) VALUES
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Benma' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'ZongShen' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Kama' AND tenant_id = $TENANT_ID), $TENANT_ID);

-- Food Machine（食品设备）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) VALUES
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Golden Bull' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Golden Tortoise' AND tenant_id = $TENANT_ID), $TENANT_ID);

-- Machinery（机械设备）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) VALUES
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Greenco' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Mixtec' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'SiFang' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'WestLing' AND tenant_id = $TENANT_ID), $TENANT_ID),
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Wufu' AND tenant_id = $TENANT_ID), $TENANT_ID);

-- Varem（压力罐）品牌关联
INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id) VALUES
($IKLIM_SUPPLIER_ID, (SELECT id FROM brands WHERE name = 'Varem' AND tenant_id = $TENANT_ID), $TENANT_ID);

-- 提示：执行前请将 $TENANT_ID 和 $IKLIM_SUPPLIER_ID 替换为实际值
-- 例如：$TENANT_ID = 1, $IKLIM_SUPPLIER_ID = 42