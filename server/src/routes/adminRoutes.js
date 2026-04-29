const express = require('express')
const { query } = require('../config/db')
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth')

const router = express.Router()

// 所有 /admin/* 路由都需要 Super Admin 权限
router.use(authenticateToken, requireSuperAdmin)

// GET /admin/tenants - 列出所有租户（排除 SYSTEM 租户自身）
// 支持 ?status=PENDING 过滤
router.get('/tenants', async (req, res) => {
  const { status } = req.query
  const params = []
  let where = "WHERE t.code <> 'SYSTEM'"

  if (status) {
    params.push(String(status).toUpperCase())
    where += ` AND t.status = $${params.length}`
  }

  try {
    const result = await query(
      `
        SELECT
          t.id, t.code, t.name, t.status, t.plan, t.max_users,
          t.contact_email, t.contact_phone,
          t.created_at, t.approved_at, t.rejected_at, t.rejected_reason,
          approver.full_name AS approved_by_name,
          rejector.full_name AS rejected_by_name,
          (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS user_count,
          (SELECT full_name FROM users u WHERE u.tenant_id = t.id AND u.role = 'ADMIN' ORDER BY u.id LIMIT 1) AS admin_name,
          (SELECT email FROM users u WHERE u.tenant_id = t.id AND u.role = 'ADMIN' ORDER BY u.id LIMIT 1) AS admin_email
        FROM tenants t
        LEFT JOIN users approver ON approver.id = t.approved_by
        LEFT JOIN users rejector ON rejector.id = t.rejected_by
        ${where}
        ORDER BY
          CASE t.status WHEN 'PENDING' THEN 0 WHEN 'ACTIVE' THEN 1 ELSE 2 END,
          t.created_at DESC
      `,
      params,
    )
    return res.json({ tenants: result.rows })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list tenants.', error: error.message })
  }
})

// GET /admin/tenants/:id - 查看单个租户详情
router.get('/tenants/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ message: 'Invalid tenant id.' })

  try {
    const result = await query(
      `
        SELECT t.*,
               approver.full_name AS approved_by_name,
               rejector.full_name AS rejected_by_name
        FROM tenants t
        LEFT JOIN users approver ON approver.id = t.approved_by
        LEFT JOIN users rejector ON rejector.id = t.rejected_by
        WHERE t.id = $1 AND t.code <> 'SYSTEM'
      `,
      [id],
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Tenant not found.' })

    const users = await query(
      `SELECT id, full_name, email, role, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY id`,
      [id],
    )
    return res.json({ tenant: result.rows[0], users: users.rows })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load tenant.', error: error.message })
  }
})

// POST /admin/tenants/:id/approve - 批准租户
router.post('/tenants/:id/approve', async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ message: 'Invalid tenant id.' })

  try {
    const result = await query(
      `
        UPDATE tenants
        SET status = 'ACTIVE',
            approved_at = CURRENT_TIMESTAMP,
            approved_by = $2,
            rejected_at = NULL,
            rejected_by = NULL,
            rejected_reason = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND code <> 'SYSTEM' AND status IN ('PENDING', 'REJECTED', 'SUSPENDED')
        RETURNING id, code, name, status
      `,
      [id, req.user.id],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Tenant not found or not in an approvable state.' })
    }
    return res.json({ tenant: result.rows[0], message: 'Tenant approved.' })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to approve tenant.', error: error.message })
  }
})

// POST /admin/tenants/:id/reject - 拒绝租户
router.post('/tenants/:id/reject', async (req, res) => {
  const id = Number(req.params.id)
  const { reason } = req.body
  if (!id) return res.status(400).json({ message: 'Invalid tenant id.' })

  try {
    const result = await query(
      `
        UPDATE tenants
        SET status = 'REJECTED',
            rejected_at = CURRENT_TIMESTAMP,
            rejected_by = $2,
            rejected_reason = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND code <> 'SYSTEM' AND status <> 'DELETED'
        RETURNING id, code, name, status
      `,
      [id, req.user.id, reason || null],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Tenant not found.' })
    }
    return res.json({ tenant: result.rows[0], message: 'Tenant rejected.' })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reject tenant.', error: error.message })
  }
})

// POST /admin/tenants/:id/suspend - 暂停已激活的租户
router.post('/tenants/:id/suspend', async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ message: 'Invalid tenant id.' })

  try {
    const result = await query(
      `
        UPDATE tenants
        SET status = 'SUSPENDED', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND code <> 'SYSTEM' AND status = 'ACTIVE'
        RETURNING id, code, name, status
      `,
      [id],
    )
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Tenant not found or not active.' })
    }
    return res.json({ tenant: result.rows[0], message: 'Tenant suspended.' })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to suspend tenant.', error: error.message })
  }
})

// GET /admin/stats - 平台统计概览
router.get('/stats', async (req, res) => {
  try {
    const result = await query(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'PENDING' AND code <> 'SYSTEM') AS pending_count,
          COUNT(*) FILTER (WHERE status = 'ACTIVE' AND code <> 'SYSTEM') AS active_count,
          COUNT(*) FILTER (WHERE status = 'REJECTED' AND code <> 'SYSTEM') AS rejected_count,
          COUNT(*) FILTER (WHERE status = 'SUSPENDED' AND code <> 'SYSTEM') AS suspended_count,
          COUNT(*) FILTER (WHERE code <> 'SYSTEM') AS total_tenants
        FROM tenants
      `,
    )
    const userCount = await query(
      `SELECT COUNT(*) AS total FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE t.code <> 'SYSTEM'`,
    )
    return res.json({ ...result.rows[0], total_users: userCount.rows[0].total })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load stats.', error: error.message })
  }
})

module.exports = router
