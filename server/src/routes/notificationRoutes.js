const express = require('express')
const { query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')

const router = express.Router()

router.use(authenticateToken)

function normalizeType(type) {
  const value = String(type || '').trim().toUpperCase()
  return value
}

router.get('/', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  const { type = '', unreadOnly = 'false' } = req.query
  const normalizedType = normalizeType(type)
  const onlyUnread = unreadOnly === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)

  try {
    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT *
          FROM system_notifications
          WHERE (target_role IS NULL OR target_role = $1)
            AND ($2 = '' OR notification_type = $2)
            AND ($3 = FALSE OR is_read = FALSE)
          ORDER BY created_at DESC
          LIMIT $4 OFFSET $5
        `,
        [req.user.role, normalizedType, onlyUnread, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM system_notifications
          WHERE (target_role IS NULL OR target_role = $1)
            AND ($2 = '' OR notification_type = $2)
            AND ($3 = FALSE OR is_read = FALSE)
        `,
        [req.user.role, normalizedType, onlyUnread],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch notifications.', error: error.message })
  }
})

router.post('/:id/read', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  try {
    const result = await query(
      `
        UPDATE system_notifications
        SET is_read = TRUE
        WHERE id = $1
        RETURNING *
      `,
      [req.params.id],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Notification not found.' })
    }

    req.auditContext = {
      action: 'NOTIFICATION_READ',
      entityType: 'NOTIFICATION',
      entityId: String(req.params.id),
      description: `Marked notification ${req.params.id} as read`,
    }

    return res.json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark notification as read.', error: error.message })
  }
})

module.exports = router
