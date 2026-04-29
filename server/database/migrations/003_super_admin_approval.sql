-- ========================================
-- Migration 003：Super Admin 审核机制
-- 新增：
--   - tenants.status 支持 PENDING / REJECTED
--   - tenants 新增 approved_at / approved_by / rejected_reason 字段
--   - users.role 支持 SUPER_ADMIN
--   - SYSTEM 系统租户（platform 管理）
--   - 默认 super admin 账号：superadmin@inventory.local / SuperAdmin@2024
-- ========================================

-- 1. 扩展 tenants.status 枚举：加入 PENDING / REJECTED
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'DELETED'));

-- 2. 扩展 users.role 枚举：加入 SUPER_ADMIN
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF', 'SUPER_ADMIN'));

-- 3. 审核元数据字段
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 4. 创建系统租户（platform 层，容纳 Super Admin）
INSERT INTO tenants (code, name, status, plan, max_users, contact_email)
VALUES ('SYSTEM', 'Platform Administration', 'ACTIVE', 'ENTERPRISE', 10, 'superadmin@inventory.local')
ON CONFLICT (code) DO NOTHING;

-- 5. 创建默认 Super Admin 账号
--    email: superadmin@inventory.local
--    password: SuperAdmin@2024
INSERT INTO users (full_name, email, password_hash, role, tenant_id, is_active, preferred_currency)
SELECT 'Platform Super Admin',
       'superadmin@inventory.local',
       '$2b$10$c3OyYsBL9mwgdobhf/ZlJe42TGVXCsdpshIVZIoduCJl.1esGpTVW',
       'SUPER_ADMIN',
       t.id,
       TRUE,
       'MYR'
FROM tenants t
WHERE t.code = 'SYSTEM'
ON CONFLICT DO NOTHING;

-- 6. 现有租户（DEFAULT / ACME 等）保持 ACTIVE，仅对未来注册生效
-- 不做任何数据修改

-- 7. 索引：审核状态高频查询
CREATE INDEX IF NOT EXISTS idx_tenants_status_pending ON tenants(status) WHERE status = 'PENDING';
