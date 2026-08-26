const jwt = require('jsonwebtoken')
const { query } = require('../config/db')

// 中文说明：用户/租户“激活状态”的短时缓存（TTL 默认 60 秒）。
// 作用：避免每次请求都查 users+tenants；但仍能保证用户被禁用/租户被挂起时，最多 60 秒内会被踢下线。
// 注意：这是进程内缓存，K8s 多副本下每个实例独立（完全分布式可后续接入 Redis）。
const STATUS_TTL_MS = Number(process.env.AUTH_STATUS_TTL_MS || 60 * 1000)
const userStatusCache = new Map() // key = userId -> { active, tenantId, updatedAtMs }
const tenantStatusCache = new Map() // key = tenantId -> { status, updatedAtMs }

function isExpired(updatedAtMs) {
  return Date.now() - updatedAtMs > STATUS_TTL_MS
}

async function loadUserStatusFromDb(userId) {
  const result = await query(
    `SELECT u.id, u.is_active, u.tenant_id
     FROM users u
     WHERE u.id = $1`,
    [userId]
  )
  const row = result.rows[0]
  if (!row) return null
  const entry = {
    isActive: Boolean(row.is_active),
    tenantId: row.tenant_id,
    updatedAtMs: Date.now(),
  }
  userStatusCache.set(userId, entry)
  return entry
}

async function loadTenantStatusFromDb(tenantId) {
  const result = await query(
    `SELECT id, status
     FROM tenants
     WHERE id = $1`,
    [tenantId]
  )
  const row = result.rows[0]
  if (!row) return null
  const entry = {
    status: row.status,
    updatedAtMs: Date.now(),
  }
  tenantStatusCache.set(tenantId, entry)
  return entry
}

function attachContextFromJwt(req, payload) {
  // 中文说明：这些字段来自 JWT，已由签名保证不会被前端篡改。
  req.user = {
    id: payload.userId,
    full_name: payload.fullName || null,
    fullName: payload.fullName || null,
    email: payload.email || null,
    role: payload.role,
    is_active: true,
    preferred_currency: payload.preferredCurrency || 'MYR',
    preferredCurrency: payload.preferredCurrency || 'MYR',
    tenant_id: payload.tenantId,
  }
  req.tenantId = payload.tenantId
  req.tenant = {
    id: payload.tenantId,
    code: payload.tenantCode || null,
    name: payload.tenantName || null,
    status: payload.tenantStatus || null,
    plan: payload.tenantPlan || null,
  }
}

// 读取并校验 JWT，成功后把当前用户和租户挂到请求对象上
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required.' })
  }

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }

  if (!payload || !payload.userId || !payload.tenantId) {
    return res.status(401).json({ message: 'Invalid token claims.' })
  }

  // 中文说明：先把用户/租户上下文挂好，后续即使在 401 之前的审计中间件也能拿到 id。
  attachContextFromJwt(req, payload)

  try {
    // 中文说明：用户状态缓存（TTL）—— 只校验“是否还能登录”，用户资料更新由 JWT 自带字段保证。
    let userEntry = userStatusCache.get(payload.userId)
    if (!userEntry || isExpired(userEntry.updatedAtMs)) {
      userEntry = await loadUserStatusFromDb(payload.userId)
    }

    if (!userEntry) {
      return res.status(401).json({ message: 'User is not available.' })
    }
    if (!userEntry.isActive) {
      return res.status(401).json({ message: 'User is not available.' })
    }
    // 交叉校验 token 里的 tenantId 和数据库一致，防止手工构造 payload。
    if (Number(userEntry.tenantId) !== Number(payload.tenantId)) {
      return res.status(401).json({ message: 'Token tenant mismatch.' })
    }

    // 中文说明：租户状态缓存（TTL）—— 租户停用/恢复时，最多 60 秒内生效。
    let tenantEntry = tenantStatusCache.get(payload.tenantId)
    if (!tenantEntry || isExpired(tenantEntry.updatedAtMs)) {
      tenantEntry = await loadTenantStatusFromDb(payload.tenantId)
    }

    if (!tenantEntry) {
      return res.status(403).json({ message: 'Company account is unavailable.' })
    }
    if (tenantEntry.status && tenantEntry.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Company account is suspended.' })
    }

    // 中文说明：把缓存里最新的 tenantStatus 覆盖到 req.tenant 上，避免 token 签发后到 TTL 内状态变更不一致。
    req.tenant.status = tenantEntry.status
    next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

// 手动让某个用户的鉴权缓存失效（例如管理员修改了用户状态后调用）
function invalidateUserStatusCache(userId) {
  if (!userId) return
  userStatusCache.delete(Number(userId))
}

function invalidateTenantStatusCache(tenantId) {
  if (!tenantId) return
  tenantStatusCache.delete(Number(tenantId))
}

// 基于角色控制访问范围，适合管理后台不同菜单权限
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do this action.' })
    }

    next()
  }
}

// 确保请求已注入 tenantId（用于业务路由强制隔离）
function requireTenant(req, res, next) {
  if (!req.tenantId) {
    return res.status(401).json({ message: 'Tenant context missing.' })
  }
  next()
}

// 仅允许平台级 Super Admin 访问（跨租户管理）
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Super Admin permission required.' })
  }
  next()
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireTenant,
  requireSuperAdmin,
  invalidateUserStatusCache,
  invalidateTenantStatusCache,
}
