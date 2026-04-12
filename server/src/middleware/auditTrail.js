const { pool } = require('../config/db')
const { writeAuditLog } = require('../utils/auditLog')

function sanitizeBody(body = {}) {
  const nextBody = { ...body }

  if ('password' in nextBody) {
    nextBody.password = '[REDACTED]'
  }

  return nextBody
}

function inferAuditContext(req, res) {
  if (req.auditContext) {
    return req.auditContext
  }

  const path = req.originalUrl.split('?')[0]

  if (req.method === 'POST' && path === '/api/auth/login' && res.statusCode < 400) {
    return {
      action: 'LOGIN',
      entityType: 'AUTH',
      entityId: req.auditUser?.id || null,
      description: 'User logged in',
    }
  }

  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || res.statusCode >= 400) {
    return null
  }

  const normalizedPath = path.replace(/^\/api\//, '')
  const [entityType = 'system', maybeId, maybeAction] = normalizedPath.split('/')
  const entityId = req.params?.id || maybeId || null
  const actionSuffix = maybeAction && !entityId ? maybeAction : maybeAction || req.method

  return {
    action: `${entityType.toUpperCase()}_${String(actionSuffix).toUpperCase()}`,
    entityType: entityType.toUpperCase(),
    entityId,
    description: `${req.method} ${path}`,
  }
}

function auditTrail(req, res, next) {
  res.on('finish', async () => {
    const context = inferAuditContext(req, res)

    if (!context) {
      return
    }

    const actor = req.auditUser || req.user || null

    try {
      await writeAuditLog(pool, {
        userId: actor?.id || null,
        userEmail: actor?.email || null,
        userRole: actor?.role || null,
        action: context.action,
        entityType: context.entityType,
        entityId: context.entityId,
        method: req.method,
        path: req.originalUrl,
        description: context.description,
        metadata: {
          body: sanitizeBody(req.body),
          statusCode: res.statusCode,
        },
      })
    } catch (error) {
      console.error('Failed to write audit log:', error.message)
    }
  })

  next()
}

module.exports = {
  auditTrail,
}
