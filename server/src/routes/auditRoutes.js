const express = require('express')
const { query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')

const router = express.Router()

router.use(authenticateToken)
router.use(authorizeRoles('ADMIN', 'MANAGER'))

function getSearchPattern(search) {
  return `%${String(search || '').trim()}%`
}

router.get('/', async (req, res) => {
  const { search = '', action = 'all', entityType = 'all', startDate = '', endDate = '', all = 'false' } = req.query
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = getSearchPattern(search)
  const queryParams = [searchPattern, action, entityType, startDate || null, endDate || null]
  const whereClause = `
    WHERE (
      $1 = '%%'
      OR COALESCE(user_email, '') ILIKE $1
      OR action ILIKE $1
      OR entity_type ILIKE $1
      OR path ILIKE $1
      OR COALESCE(description, '') ILIKE $1
    )
      AND ($2 = 'all' OR action = $2)
      AND ($3 = 'all' OR entity_type = $3)
      AND ($4::date IS NULL OR created_at::date >= $4::date)
      AND ($5::date IS NULL OR created_at::date <= $5::date)
  `

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT
            id,
            user_id,
            user_email,
            user_role,
            action,
            entity_type,
            entity_id,
            method,
            path,
            description,
            metadata,
            created_at
          FROM audit_logs
          ${whereClause}
          ORDER BY created_at DESC
        `,
        queryParams,
      )

      return res.json({
        items: result.rows,
        pagination: buildPagination(result.rows.length, 1, result.rows.length || 1),
      })
    }

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            id,
            user_id,
            user_email,
            user_role,
            action,
            entity_type,
            entity_id,
            method,
            path,
            description,
            metadata,
            created_at
          FROM audit_logs
          WHERE (
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT $6 OFFSET $7
        `,
        [...queryParams, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM audit_logs
          ${whereClause}
        `,
        queryParams,
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch audit logs.', error: error.message })
  }
})

module.exports = router
