-- ================================================================
-- Migration 009: DO / Invoice 入库支持
-- ================================================================
-- 背景：
--   - Delivery Order 保存时必须自动入库（只要用户选了 warehouse）。
--   - Supplier Invoice 无 DO 时可选择是否入库（cash sale / 直接发票）。
--   - 有 DO 的 Invoice 不再入库（DO 端已处理）。
-- 变更：
--   1) delivery_orders 新增 warehouse_id（nullable, 历史单可为 NULL）
--      及 posted_to_inventory（标记该 DO 是否已将明细写入 stock_levels）。
--   2) supplier_invoices 新增 warehouse_id（nullable）与 posted_to_inventory。
-- ================================================================

BEGIN;

ALTER TABLE delivery_orders
  ADD COLUMN IF NOT EXISTS warehouse_id INTEGER
    REFERENCES warehouses(id) ON DELETE SET NULL;

ALTER TABLE delivery_orders
  ADD COLUMN IF NOT EXISTS posted_to_inventory BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS warehouse_id INTEGER
    REFERENCES warehouses(id) ON DELETE SET NULL;

ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS posted_to_inventory BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
