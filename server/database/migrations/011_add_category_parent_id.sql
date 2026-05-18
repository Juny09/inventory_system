-- ================================================================
-- Migration 011: Category 新增 parent_id 字段支持主/子分类
-- ================================================================
-- 背景：
--   - 需要将 categories 表改为支持 main category 和 sub category 的层级结构。
-- 变更：
--   1) categories 表新增 parent_id INTEGER（nullable，指向父分类）
--   2) 添加外键约束，级联删除
-- ================================================================

BEGIN;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id INTEGER;

ALTER TABLE categories
  ADD CONSTRAINT categories_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE;

COMMIT;
