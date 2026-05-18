-- ================================================================
-- Migration 010: Brand 新增 country 和 made_in 字段
-- ================================================================
-- 背景：
--   - 品牌需要记录所属国家和产品制造产地。
-- 变更：
--   1) brands 表新增 country VARCHAR(100)（nullable，品牌所属国家/地区）
--   2) brands 表新增 made_in VARCHAR(100)（nullable，产品制造产地）
-- ================================================================

BEGIN;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS country VARCHAR(100);

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS made_in VARCHAR(100);

COMMIT;
