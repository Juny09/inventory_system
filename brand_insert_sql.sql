-- Brand 数据插入脚本
-- 注意：需要替换 $TENANT_ID 为实际的租户ID

-- Pump（水泵）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
($TENANT_ID, 'Pedrollo', '意大利知名水泵品牌', TRUE),
($TENANT_ID, 'Pumpman', '专业水泵制造商', TRUE),
($TENANT_ID, 'Stream', '流体控制解决方案品牌', TRUE),
($TENANT_ID, 'Unoflow', '高效水泵技术品牌', TRUE),
($TENANT_ID, 'Opalflo', '工业水泵品牌', TRUE),
($TENANT_ID, 'Kawamoto', '日本水泵制造商', TRUE),
($TENANT_ID, 'Meudy', '专业水泵品牌', TRUE),
($TENANT_ID, 'Showfou', '水泵设备品牌', TRUE);

-- Cleaning Equipment（清洁设备）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
($TENANT_ID, 'Benma', '清洁设备制造商', TRUE),
($TENANT_ID, 'Kranzle', '德国高压清洗机品牌', TRUE);

-- Pipe Threading Machine（套丝机）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
($TENANT_ID, 'Kama', '套丝机专业制造商', TRUE),
($TENANT_ID, 'Qing Yang', '中国套丝机品牌', TRUE);

-- Power Tools（电动工具）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
($TENANT_ID, 'ZhongYue', '电动工具品牌', TRUE);

-- Generator / Engine（发电机 / 引擎）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
($TENANT_ID, 'Benma', '发电机制造商', TRUE),
($TENANT_ID, 'ZongShen', '宗申发动机品牌', TRUE),
($TENANT_ID, 'Kama', '发电机设备品牌', TRUE);

-- Food Machine（食品设备）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
($TENANT_ID, 'Golden Bull', '食品加工设备品牌', TRUE),
($TENANT_ID, 'Golden Tortoise', '食品机械品牌', TRUE);

-- Machinery（机械设备）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
($TENANT_ID, 'Greenco', '绿色机械设备品牌', TRUE),
($TENANT_ID, 'Mixtec', '混合机械设备品牌', TRUE),
($TENANT_ID, 'SiFang', '四方机械设备品牌', TRUE),
($TENANT_ID, 'WestLing', '西方机械设备品牌', TRUE),
($TENANT_ID, 'Wufu', '五福机械设备品牌', TRUE);

-- Varem（压力罐）
INSERT INTO brands (tenant_id, name, description, is_active) VALUES
($TENANT_ID, 'Varem', '意大利压力罐品牌', TRUE);

-- 提示：执行前请将 $TENANT_ID 替换为实际的租户ID
-- 例如：INSERT INTO brands (tenant_id, name, description, is_active) VALUES (1, 'Pedrollo', '意大利知名水泵品牌', TRUE);