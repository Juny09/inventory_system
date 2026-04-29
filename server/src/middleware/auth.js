const jwt = require('jsonwebtoken')
const { query } = require('../config/db')

// 读取并校验 JWT，成功后把当前用户和租户挂到请求对象上
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required.' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.role, u.is_active, u.preferred_currency, u.tenant_id,
              t.code AS tenant_code, t.name AS tenant_name, t.status AS tenant_status, t.plan AS tenant_plan
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [payload.userId],
    )

    const row = result.rows[0]

    if (!row || !row.is_active) {
      return res.status(401).json({ message: 'User is not available.' })
    }

    // 验证租户状态
    if (row.tenant_status && row.tenant_status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Company account is suspended.' })
    }

    // 验证 token 中的 tenant_id 和数据库中一致（防止 token 被伪造跨租户）
    if (payload.tenantId && payload.tenantId !== row.tenant_id) {
      return res.status(401).json({ message: 'Token tenant mismatch.' })
    }

    req.user = {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      role: row.role,
      is_active: row.is_active,
      preferred_currency: row.preferred_currency,
      tenant_id: row.tenant_id,
    }
    req.tenantId = row.tenant_id
    req.tenant = {
      id: row.tenant_id,
      code: row.tenant_code,
      name: row.tenant_name,
      status: row.tenant_status,
      plan: row.tenant_plan,
    }
    next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
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
}
