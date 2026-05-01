-- ================================================================
-- Migration 008: supplier_invoices.do_id 改为可空
-- ================================================================
-- 背景：部分供应商未开信用账户（account），只能现金购买（cash sale）
--       或直接以发票（invoice）取货，不存在对应的 Delivery Order。
--       因此 supplier_invoices 必须允许没有关联 DO。
-- 本迁移仅修改列的 NOT NULL 约束，不改动数据。
-- ================================================================

BEGIN;

ALTER TABLE supplier_invoices
  ALTER COLUMN do_id DROP NOT NULL;

COMMIT;
