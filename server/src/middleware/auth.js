const jwt = require('jsonwebtoken')
const { query } = require('../config/db')

// 读取并校验 JWT，成功后把当前用户挂到请求对象上
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required.' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const result = await query(
      'SELECT id, full_name, email, role, is_active, preferred_currency FROM users WHERE id = $1',
      [payload.userId],
    )

    if (!result.rows[0] || !result.rows[0].is_active) {
      return res.status(401).json({ message: 'User is not available.' })
    }

    req.user = result.rows[0]
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

module.exports = {
  authenticateToken,
  authorizeRoles,
}
