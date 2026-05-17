const express = require('express')
const { query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const { getTenantId } = require('../utils/tenant')

const router = express.Router()

router.use(authenticateToken)

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatPeriod(month, year) {
  return `${year}-${String(month).padStart(2, '0')}`
}

// GET /api/supplier-payments — list all payment records (with filters, 租户隔离)
router.get('/', async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplierId, year, page = 1, pageSize = 20 } = req.query
  const { limit, offset } = { limit: Number(pageSize), offset: (Number(page) - 1) * Number(pageSize) }

  try {
    const conditions = ['spr.tenant_id = $1']
    const params = [tenantId]
    let paramIdx = 2

    if (supplierId) {
      conditions.push(`spr.supplier_id = $${paramIdx++}`)
      params.push(Number(supplierId))
    }
    if (year) {
      conditions.push(`spr.period_year = $${paramIdx++}`)
      params.push(Number(year))
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `SELECT spr.*, suppliers.name AS supplier_name, suppliers.company_name AS supplier_branch
         FROM supplier_payment_records spr
         INNER JOIN suppliers ON suppliers.id = spr.supplier_id AND suppliers.tenant_id = spr.tenant_id
         ${whereClause}
         ORDER BY spr.period_year DESC, spr.period_month DESC, spr.created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...params, limit, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM supplier_payment_records spr
         ${whereClause}`,
        params,
      ),
    ])

    const items = itemsResult.rows.map((row) => ({
      ...row,
      period_label: formatPeriod(row.period_month, row.period_year),
    }))

    return res.json({
      items,
      pagination: buildPagination(totalResult.rows[0].total, Number(page), Number(pageSize)),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch payment records.', error: error.message })
  }
})

// GET /api/supplier-payments/summary — grouped by supplier（租户隔离）
router.get('/summary', async (req, res) => {
  const tenantId = getTenantId(req)
  const { year } = req.query
  const targetYear = Number(year) || new Date().getFullYear()

  try {
    const result = await query(
      `SELECT
         suppliers.id AS supplier_id,
         suppliers.name AS supplier_name,
         suppliers.company_name AS supplier_branch,
         COALESCE(
           (SELECT json_agg(p ORDER BY p.period_month)
            FROM (
              SELECT
                spr.id,
                spr.period_month,
                spr.period_year,
                spr.paid_date,
                spr.amount,
                spr.notes,
                spr.created_at
              FROM supplier_payment_records spr
              WHERE spr.supplier_id = suppliers.id
                AND spr.period_year = $1
                AND spr.tenant_id = suppliers.tenant_id
            ) p
           ),
           '[]'::json
         ) AS payments
       FROM suppliers
       WHERE suppliers.is_active = TRUE
         AND suppliers.tenant_id = $2
       ORDER BY suppliers.name`,
      [targetYear, tenantId],
    )

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: MONTH_NAMES[i + 1],
    }))

    return res.json({ year: targetYear, months, suppliers: result.rows })
  } catch (error) {
    console.error('Payment summary error:', error.message)
    return res.status(500).json({ message: 'Failed to fetch payment summary.', error: error.message })
  }
})

// POST /api/supplier-payments — create a payment record（租户隔离）
router.post('/', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplierId, periodMonth, periodYear, paidDate, amount, notes } = req.body

  if (!supplierId || !periodMonth || !periodYear) {
    return res.status(400).json({ message: 'supplierId, periodMonth and periodYear are required.' })
  }

  try {
    // 校验 supplier 属于当前租户
    const supplierCheck = await query(
      'SELECT id FROM suppliers WHERE id = $1 AND tenant_id = $2',
      [Number(supplierId), tenantId],
    )
    if (!supplierCheck.rows[0]) {
      return res.status(404).json({ message: 'Supplier not found in current company.' })
    }

    const result = await query(
      `INSERT INTO supplier_payment_records (tenant_id, supplier_id, period_month, period_year, paid_date, amount, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id, supplier_id, period_year, period_month)
       DO UPDATE SET paid_date = EXCLUDED.paid_date, amount = EXCLUDED.amount, notes = EXCLUDED.notes, created_by = EXCLUDED.created_by
       RETURNING *`,
      [
        tenantId,
        Number(supplierId),
        Number(periodMonth),
        Number(periodYear),
        paidDate || null,
        amount ? Number(amount) : null,
        notes || null,
        req.user.id,
      ],
    )

    req.auditContext = {
      action: 'SUPPLIER_PAYMENT_CREATE',
      entityType: 'SUPPLIER_PAYMENT',
      entityId: String(result.rows[0].id),
      description: `Recorded payment for supplier #${supplierId} — ${formatPeriod(periodMonth, periodYear)}`,
    }

    return res.status(201).json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create payment record.', error: error.message })
  }
})

// DELETE /api/supplier-payments/:id（租户隔离）
router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const existing = await query(
      'SELECT id FROM supplier_payment_records WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Payment record not found.' })
    }

    await query(
      'DELETE FROM supplier_payment_records WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId],
    )

    req.auditContext = {
      action: 'SUPPLIER_PAYMENT_DELETE',
      entityType: 'SUPPLIER_PAYMENT',
      entityId: String(req.params.id),
      description: `Deleted payment record #${req.params.id}`,
    }

    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete payment record.', error: error.message })
  }
})

module.exports = router
