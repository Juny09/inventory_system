const express = require('express')
const { query } = require('../config/db')
const { authenticateToken } = require('../middleware/auth')
const { getTenantId } = require('../utils/tenant')

const router = express.Router()

router.use(authenticateToken)

function isValidYmd(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function ymdToUtcDate(ymd) {
  const [y, m, d] = ymd.split('-').map((v) => Number(v))
  return new Date(Date.UTC(y, m - 1, d))
}

function utcDateToYmd(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addUtcDays(date, days) {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function resolveDateRange(queryParams) {
  const startDateRaw = queryParams.startDate
  const endDateRaw = queryParams.endDate

  if (!startDateRaw && !endDateRaw) {
    const now = new Date()
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    return {
      startDate: utcDateToYmd(lastMonthStart),
      endDate: utcDateToYmd(addUtcDays(thisMonthStart, -1)),
      endExclusive: utcDateToYmd(thisMonthStart),
    }
  }

  if (!isValidYmd(startDateRaw) || !isValidYmd(endDateRaw)) {
    const error = new Error('Invalid date range. Use startDate/endDate in YYYY-MM-DD.')
    error.statusCode = 400
    throw error
  }

  const start = ymdToUtcDate(startDateRaw)
  const end = ymdToUtcDate(endDateRaw)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    const error = new Error('Invalid date range. startDate must be <= endDate.')
    error.statusCode = 400
    throw error
  }

  const endExclusive = addUtcDays(end, 1)
  return {
    startDate: startDateRaw,
    endDate: endDateRaw,
    endExclusive: utcDateToYmd(endExclusive),
  }
}

function resolveTopN(raw) {
  if (!raw) return 5
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > 50) {
    const error = new Error('Invalid topN. Use an integer between 1 and 50.')
    error.statusCode = 400
    throw error
  }
  return value
}

router.get('/', async (req, res) => {
  const tenantId = getTenantId(req)

  try {
    const range = resolveDateRange(req.query)
    const topN = resolveTopN(req.query.topN)

    const [globalInvoiceTotal, totalsBySupplier, topSuppliers] = await Promise.all([
      query(
        `
          SELECT COALESCE(SUM(inv.total_amount), 0)::numeric(14,2) AS total
          FROM supplier_invoices inv
          WHERE inv.tenant_id = $1
            AND inv.invoice_date >= $2
            AND inv.invoice_date < $3
        `,
        [tenantId, range.startDate, range.endExclusive],
      ),
      query(
        `
          SELECT
            s.id AS supplier_id,
            COALESCE(s.company_name, s.name) AS supplier_name,
            COUNT(inv.id)::int AS invoice_count,
            COALESCE(SUM(inv.total_amount), 0)::numeric(14,2) AS total_amount
          FROM supplier_invoices inv
          INNER JOIN suppliers s ON s.id = inv.supplier_id AND s.tenant_id = inv.tenant_id
          WHERE inv.tenant_id = $1
            AND inv.invoice_date >= $2
            AND inv.invoice_date < $3
          GROUP BY s.id, COALESCE(s.company_name, s.name)
          ORDER BY total_amount DESC, supplier_name ASC
        `,
        [tenantId, range.startDate, range.endExclusive],
      ),
      query(
        `
          WITH do_counts AS (
            SELECT d.supplier_id, COUNT(*)::int AS order_count
            FROM delivery_orders d
            WHERE d.tenant_id = $1
              AND d.do_date >= $2
              AND d.do_date < $3
            GROUP BY d.supplier_id
          ),
          inv_sums AS (
            SELECT inv.supplier_id, COALESCE(SUM(inv.total_amount), 0)::numeric(14,2) AS total_amount
            FROM supplier_invoices inv
            WHERE inv.tenant_id = $1
              AND inv.invoice_date >= $2
              AND inv.invoice_date < $3
            GROUP BY inv.supplier_id
          )
          SELECT
            s.id AS supplier_id,
            COALESCE(s.company_name, s.name) AS supplier_name,
            dc.order_count,
            COALESCE(isum.total_amount, 0)::numeric(14,2) AS total_amount
          FROM do_counts dc
          INNER JOIN suppliers s ON s.id = dc.supplier_id AND s.tenant_id = $1
          LEFT JOIN inv_sums isum ON isum.supplier_id = dc.supplier_id
          ORDER BY dc.order_count DESC, total_amount DESC, supplier_name ASC
          LIMIT $4
        `,
        [tenantId, range.startDate, range.endExclusive, topN],
      ),
    ])

    return res.json({
      period: {
        startDate: range.startDate,
        endDate: range.endDate,
      },
      globalInvoiceTotal: Number(globalInvoiceTotal.rows[0]?.total || 0),
      totalsBySupplier: totalsBySupplier.rows.map((row) => ({
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        invoiceCount: row.invoice_count,
        totalAmount: Number(row.total_amount || 0),
      })),
      topSuppliersByPurchaseCount: topSuppliers.rows.map((row) => ({
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        orderCount: row.order_count,
        totalAmount: Number(row.total_amount || 0),
      })),
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({ message: 'Failed to load supplier stats.', error: error.message })
  }
})

module.exports = router

