-- ================================================================
-- Migration 006: Rename Purchase Order (PO) → Delivery Order (DO)
-- ================================================================
-- 背景：业务改名——将"Purchase Order"重命名为"Delivery Order"。
-- 范围：purchase_orders / purchase_order_items / purchase_order_attachments
--       及 supplier_invoices.po_id 外键字段。
-- 本迁移全部使用 RENAME，不删改数据，零数据丢失。
-- ================================================================

BEGIN;

-- ============== 1. Rename tables ==============
ALTER TABLE purchase_orders            RENAME TO delivery_orders;
ALTER TABLE purchase_order_items       RENAME TO delivery_order_items;
ALTER TABLE purchase_order_attachments RENAME TO delivery_order_attachments;

-- ============== 2. Rename columns ==============
-- delivery_orders: po_no / po_date
ALTER TABLE delivery_orders            RENAME COLUMN po_no   TO do_no;
ALTER TABLE delivery_orders            RENAME COLUMN po_date TO do_date;

-- delivery_order_items: po_id → do_id
ALTER TABLE delivery_order_items       RENAME COLUMN po_id TO do_id;

-- delivery_order_attachments: po_id → do_id
ALTER TABLE delivery_order_attachments RENAME COLUMN po_id TO do_id;

-- supplier_invoices: po_id → do_id（外键引用新表）
ALTER TABLE supplier_invoices          RENAME COLUMN po_id TO do_id;

-- ============== 3. Rename unique constraints ==============
-- UNIQUE (tenant_id, po_no) 由 PostgreSQL 自动生成的约束名通常是
-- purchase_orders_tenant_id_po_no_key，可能因环境而异——若存在则重命名。
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'delivery_orders'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%tenant_id%do_no%';
  IF con_name IS NOT NULL AND con_name <> 'delivery_orders_tenant_id_do_no_key' THEN
    EXECUTE format('ALTER TABLE delivery_orders RENAME CONSTRAINT %I TO delivery_orders_tenant_id_do_no_key', con_name);
  END IF;
END$$;

-- ============== 4. Rename indexes ==============
ALTER INDEX IF EXISTS idx_po_tenant_supplier  RENAME TO idx_do_tenant_supplier;
ALTER INDEX IF EXISTS idx_po_tenant_date      RENAME TO idx_do_tenant_date;
ALTER INDEX IF EXISTS idx_po_items_po_id      RENAME TO idx_do_items_do_id;
ALTER INDEX IF EXISTS idx_po_attachments_po_id RENAME TO idx_do_attachments_do_id;
ALTER INDEX IF EXISTS idx_inv_po_id           RENAME TO idx_inv_do_id;

-- ============== 5. Rename sequences（由 SERIAL 自动创建） ==============
ALTER SEQUENCE IF EXISTS purchase_orders_id_seq            RENAME TO delivery_orders_id_seq;
ALTER SEQUENCE IF EXISTS purchase_order_items_id_seq       RENAME TO delivery_order_items_id_seq;
ALTER SEQUENCE IF EXISTS purchase_order_attachments_id_seq RENAME TO delivery_order_attachments_id_seq;

COMMIT;
