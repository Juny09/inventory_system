const express = require('express')
const { query } = require('../config/db')
const { authenticateToken } = require('../middleware/auth')
const { getTenantId } = require('../utils/tenant')

const router = express.Router()

router.use(authenticateToken)

function normalizeCategoryKey(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  return raw
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 80)
}

function parseIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n)) return null
  return n
}

function validatePeriod({ periodYear, periodMonth }) {
  if (!Number.isInteger(periodYear) || periodYear < 2000) {
    const error = new Error('Invalid periodYear.')
    error.statusCode = 400
    throw error
  }
  if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
    const error = new Error('Invalid periodMonth.')
    error.statusCode = 400
    throw error
  }
}

function validateDateYmd(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const error = new Error(`Invalid ${fieldName}. Use YYYY-MM-DD.`)
    error.statusCode = 400
    throw error
  }
}

async function assertNoDuplicate({ tenantId, periodYear, periodMonth, categoryKey, excludeId }) {
  const params = [tenantId, periodYear, periodMonth, categoryKey]
  let sql = `
    SELECT id
    FROM company_monthly_costs
    WHERE tenant_id = $1
      AND period_year = $2
      AND period_month = $3
      AND category_key = $4
  `
  if (excludeId) {
    sql += ` AND id <> $5`
    params.push(excludeId)
  }

  const existing = await query(sql, params)
  if (existing.rows.length) {
    const error = new Error('Duplicate cost category for the same month.')
    error.statusCode = 409
    throw error
  }
}

router.get('/', async (req, res) => {
  const tenantId = getTenantId(req)
  const year = parseIntOrNull(req.query.year)
  const month = parseIntOrNull(req.query.month)

  try {
    const filters = ['tenant_id = $1']
    const params = [tenantId]
    let idx = 2

    if (year) {
      filters.push(`period_year = $${idx++}`)
      params.push(year)
    }
    if (month) {
      filters.push(`period_month = $${idx++}`)
      params.push(month)
    }

    const list = await query(
      `
        SELECT
          id,
          period_year,
          period_month,
          category_key,
          category_label,
          amount,
          occurred_date,
          notes,
          created_at,
          updated_at
        FROM company_monthly_costs
        WHERE ${filters.join(' AND ')}
        ORDER BY period_year DESC, period_month DESC, category_label ASC, id ASC
      `,
      params,
    )

    return res.json({ items: list.rows })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load company costs.', error: error.message })
  }
})

router.post('/', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const periodYear = Number(req.body.periodYear)
    const periodMonth = Number(req.body.periodMonth)
    validatePeriod({ periodYear, periodMonth })

    const categoryLabel = String(req.body.categoryLabel || req.body.category || '').trim()
    const categoryKey = normalizeCategoryKey(req.body.categoryKey || categoryLabel)
    if (!categoryLabel || !categoryKey) {
      return res.status(400).json({ message: 'Category is required.' })
    }

    const amount = Number(req.body.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ message: 'Invalid amount.' })
    }

    const occurredDate = String(req.body.occurredDate || '').trim()
    validateDateYmd(occurredDate, 'occurredDate')

    await assertNoDuplicate({ tenantId, periodYear, periodMonth, categoryKey })

    const createdBy = req.user?.id || null
    const notes = req.body.notes ? String(req.body.notes) : null

    const created = await query(
      `
        INSERT INTO company_monthly_costs (
          tenant_id,
          period_year,
          period_month,
          category_key,
          category_label,
          amount,
          occurred_date,
          notes,
          created_by,
          updated_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
        RETURNING
          id,
          period_year,
          period_month,
          category_key,
          category_label,
          amount,
          occurred_date,
          notes,
          created_at,
          updated_at
      `,
      [tenantId, periodYear, periodMonth, categoryKey, categoryLabel, amount, occurredDate, notes, createdBy],
    )

    return res.status(201).json({ item: created.rows[0] })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({ message: 'Failed to create company cost.', error: error.message })
  }
})

router.put('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'Invalid id.' })
  }

  try {
    const existing = await query(
      `SELECT id FROM company_monthly_costs WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    )
    if (!existing.rows.length) {
      return res.status(404).json({ message: 'Cost not found.' })
    }

    const periodYear = Number(req.body.periodYear)
    const periodMonth = Number(req.body.periodMonth)
    validatePeriod({ periodYear, periodMonth })

    const categoryLabel = String(req.body.categoryLabel || req.body.category || '').trim()
    const categoryKey = normalizeCategoryKey(req.body.categoryKey || categoryLabel)
    if (!categoryLabel || !categoryKey) {
      return res.status(400).json({ message: 'Category is required.' })
    }

    const amount = Number(req.body.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ message: 'Invalid amount.' })
    }

    const occurredDate = String(req.body.occurredDate || '').trim()
    validateDateYmd(occurredDate, 'occurredDate')

    await assertNoDuplicate({ tenantId, periodYear, periodMonth, categoryKey, excludeId: id })

    const updatedBy = req.user?.id || null
    const notes = req.body.notes ? String(req.body.notes) : null

    const updated = await query(
      `
        UPDATE company_monthly_costs
        SET
          period_year = $3,
          period_month = $4,
          category_key = $5,
          category_label = $6,
          amount = $7,
          occurred_date = $8,
          notes = $9,
          updated_by = $10,
          updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1 AND id = $2
        RETURNING
          id,
          period_year,
          period_month,
          category_key,
          category_label,
          amount,
          occurred_date,
          notes,
          created_at,
          updated_at
      `,
      [tenantId, id, periodYear, periodMonth, categoryKey, categoryLabel, amount, occurredDate, notes, updatedBy],
    )

    return res.json({ item: updated.rows[0] })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({ message: 'Failed to update company cost.', error: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'Invalid id.' })
  }

  try {
    const deleted = await query(
      `DELETE FROM company_monthly_costs WHERE tenant_id = $1 AND id = $2 RETURNING id`,
      [tenantId, id],
    )
    if (!deleted.rows.length) {
      return res.status(404).json({ message: 'Cost not found.' })
    }
    return res.json({ success: true })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete company cost.', error: error.message })
  }
})

router.get('/summary', async (req, res) => {
  const tenantId = getTenantId(req)
  const startYear = parseIntOrNull(req.query.startYear)
  const startMonth = parseIntOrNull(req.query.startMonth)
  const endYear = parseIntOrNull(req.query.endYear)
  const endMonth = parseIntOrNull(req.query.endMonth)

  try {
    if (!startYear || !startMonth || !endYear || !endMonth) {
      return res.status(400).json({ message: 'startYear/startMonth/endYear/endMonth are required.' })
    }
    validatePeriod({ periodYear: startYear, periodMonth: startMonth })
    validatePeriod({ periodYear: endYear, periodMonth: endMonth })

    const startKey = startYear * 100 + startMonth
    const endKey = endYear * 100 + endMonth
    if (startKey > endKey) {
      return res.status(400).json({ message: 'Invalid range. start must be <= end.' })
    }

    const rows = await query(
      `
        SELECT
          period_year,
          period_month,
          category_key,
          category_label,
          COALESCE(SUM(amount), 0)::numeric(14,2) AS total_amount
        FROM company_monthly_costs
        WHERE tenant_id = $1
          AND (period_year * 100 + period_month) BETWEEN $2 AND $3
        GROUP BY period_year, period_month, category_key, category_label
        ORDER BY period_year ASC, period_month ASC, category_label ASC
      `,
      [tenantId, startKey, endKey],
    )

    const monthTotals = await query(
      `
        SELECT
          period_year,
          period_month,
          COALESCE(SUM(amount), 0)::numeric(14,2) AS total_amount
        FROM company_monthly_costs
        WHERE tenant_id = $1
          AND (period_year * 100 + period_month) BETWEEN $2 AND $3
        GROUP BY period_year, period_month
        ORDER BY period_year ASC, period_month ASC
      `,
      [tenantId, startKey, endKey],
    )

    return res.json({
      range: { startYear, startMonth, endYear, endMonth },
      monthTotals: monthTotals.rows.map((r) => ({
        periodYear: r.period_year,
        periodMonth: r.period_month,
        totalAmount: Number(r.total_amount || 0),
      })),
      breakdown: rows.rows.map((r) => ({
        periodYear: r.period_year,
        periodMonth: r.period_month,
        categoryKey: r.category_key,
        categoryLabel: r.category_label,
        totalAmount: Number(r.total_amount || 0),
      })),
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({ message: 'Failed to load cost summary.', error: error.message })
  }
})

module.exports = router

