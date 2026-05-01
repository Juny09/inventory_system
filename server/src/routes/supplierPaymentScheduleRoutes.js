const express = require('express')
const { query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const { getTenantId } = require('../utils/tenant')
const { materializeReminders } = require('../utils/paymentScheduleReminder')

const router = express.Router()

router.use(authenticateToken)

// ---- helpers ----------------------------------------------------------------

function computeStatus(amountDue, amountPaid, dueDate) {
  const due = Number(amountDue) || 0
  const paid = Number(amountPaid) || 0
  if (due > 0 && paid >= due) return 'PAID'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dueDate)
  d.setHours(0, 0, 0, 0)
  if (paid > 0) {
    return d < today ? 'OVERDUE' : 'PARTIAL'
  }
  return d < today ? 'OVERDUE' : 'PENDING'
}

async function assertSupplierInTenant(supplierId, tenantId) {
  const result = await query(
    'SELECT id FROM suppliers WHERE id = $1 AND tenant_id = $2',
    [Number(supplierId), tenantId],
  )
  return !!result.rows[0]
}

function enrich(row) {
  return {
    ...row,
    period_label: `${row.period_year}-${String(row.period_month).padStart(2, '0')}`,
    remaining: Number(row.amount_due) - Number(row.amount_paid),
  }
}

// ---- routes -----------------------------------------------------------------

// GET /api/supplier-payment-schedules
router.get('/', async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplierId, year, status } = req.query
  const { page, pageSize, offset } = getPaginationParams(req.query)

  try {
    const conditions = ['sps.tenant_id = $1']
    const params = [tenantId]
    let idx = 2

    if (supplierId) {
      conditions.push(`sps.supplier_id = $${idx++}`)
      params.push(Number(supplierId))
    }
    if (year) {
      conditions.push(`sps.period_year = $${idx++}`)
      params.push(Number(year))
    }
    if (status) {
      conditions.push(`sps.status = $${idx++}`)
      params.push(String(status).toUpperCase())
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `SELECT sps.*, s.name AS supplier_name, s.company_name AS supplier_branch
         FROM supplier_payment_schedules sps
         INNER JOIN suppliers s ON s.id = sps.supplier_id AND s.tenant_id = sps.tenant_id
         ${whereClause}
         ORDER BY sps.due_date ASC, sps.id ASC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, pageSize, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM supplier_payment_schedules sps
         ${whereClause}`,
        params,
      ),
    ])

    return res.json({
      items: itemsResult.rows.map(enrich),
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch payment schedules.', error: error.message })
  }
})

// GET /api/supplier-payment-schedules/upcoming?days=7
router.get('/upcoming', async (req, res) => {
  const tenantId = getTenantId(req)
  const days = Math.max(0, Math.min(Number(req.query.days) || 7, 90))

  try {
    await materializeReminders(tenantId)
    const result = await query(
      `SELECT sps.*, s.name AS supplier_name, s.company_name AS supplier_branch
       FROM supplier_payment_schedules sps
       INNER JOIN suppliers s ON s.id = sps.supplier_id AND s.tenant_id = sps.tenant_id
       WHERE sps.tenant_id = $1
         AND sps.status IN ('PENDING', 'PARTIAL')
         AND sps.due_date >= CURRENT_DATE
         AND sps.due_date <= CURRENT_DATE + ($2 || ' days')::INTERVAL
       ORDER BY sps.due_date ASC`,
      [tenantId, String(days)],
    )
    return res.json({ days, items: result.rows.map(enrich) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch upcoming schedules.', error: error.message })
  }
})

// GET /api/supplier-payment-schedules/overdue
router.get('/overdue', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    await materializeReminders(tenantId)
    const result = await query(
      `SELECT sps.*, s.name AS supplier_name, s.company_name AS supplier_branch
       FROM supplier_payment_schedules sps
       INNER JOIN suppliers s ON s.id = sps.supplier_id AND s.tenant_id = sps.tenant_id
       WHERE sps.tenant_id = $1
         AND sps.status = 'OVERDUE'
       ORDER BY sps.due_date ASC`,
      [tenantId],
    )
    return res.json({ items: result.rows.map(enrich) })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch overdue schedules.', error: error.message })
  }
})

// POST /api/supplier-payment-schedules
router.post('/', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplierId, periodMonth, periodYear, dueDate, amountDue, remindDaysBefore, notes } = req.body

  if (!supplierId || !periodMonth || !periodYear || !dueDate) {
    return res.status(400).json({ message: 'supplierId, periodMonth, periodYear and dueDate are required.' })
  }

  if (!(await assertSupplierInTenant(supplierId, tenantId))) {
    return res.status(404).json({ message: 'Supplier not found in current company.' })
  }

  try {
    const status = computeStatus(amountDue, 0, dueDate)
    const result = await query(
      `INSERT INTO supplier_payment_schedules
         (tenant_id, supplier_id, period_month, period_year, due_date, amount_due, remind_days_before, notes, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        tenantId,
        Number(supplierId),
        Number(periodMonth),
        Number(periodYear),
        dueDate,
        Number(amountDue) || 0,
        remindDaysBefore !== undefined ? Number(remindDaysBefore) : 3,
        notes || null,
        status,
        req.user.id,
      ],
    )

    req.auditContext = {
      action: 'PAYMENT_SCHEDULE_CREATE',
      entityType: 'PAYMENT_SCHEDULE',
      entityId: String(result.rows[0].id),
      description: `Created payment schedule for supplier #${supplierId} — ${periodYear}-${String(periodMonth).padStart(2, '0')}`,
    }

    return res.status(201).json(enrich(result.rows[0]))
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A schedule for this supplier + month + year already exists.' })
    }
    return res.status(500).json({ message: 'Failed to create payment schedule.', error: error.message })
  }
})

// POST /api/supplier-payment-schedules/batch
router.post('/batch', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = getTenantId(req)
  const {
    supplierId,
    year,
    startMonth = 1,
    endMonth = 12,
    amountPerMonth,
    dueDay = 15,
    remindDaysBefore = 3,
    notes,
  } = req.body

  if (!supplierId || !year || amountPerMonth === undefined) {
    return res.status(400).json({ message: 'supplierId, year and amountPerMonth are required.' })
  }
  const sm = Number(startMonth), em = Number(endMonth)
  if (sm < 1 || em > 12 || sm > em) {
    return res.status(400).json({ message: 'Invalid startMonth / endMonth range.' })
  }
  if (!(await assertSupplierInTenant(supplierId, tenantId))) {
    return res.status(404).json({ message: 'Supplier not found in current company.' })
  }

  try {
    const created = []
    const skipped = []
    for (let m = sm; m <= em; m++) {
      // Clamp due day so Feb 30 becomes Feb 28/29
      const lastDay = new Date(Number(year), m, 0).getDate()
      const day = Math.min(Number(dueDay) || 15, lastDay)
      const dueDate = `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const status = computeStatus(amountPerMonth, 0, dueDate)
      try {
        const result = await query(
          `INSERT INTO supplier_payment_schedules
             (tenant_id, supplier_id, period_month, period_year, due_date, amount_due, remind_days_before, notes, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            tenantId,
            Number(supplierId),
            m,
            Number(year),
            dueDate,
            Number(amountPerMonth) || 0,
            Number(remindDaysBefore),
            notes || null,
            status,
            req.user.id,
          ],
        )
        created.push(enrich(result.rows[0]))
      } catch (err) {
        if (err.code === '23505') {
          skipped.push({ month: m, reason: 'already exists' })
        } else {
          throw err
        }
      }
    }

    req.auditContext = {
      action: 'PAYMENT_SCHEDULE_BATCH_CREATE',
      entityType: 'PAYMENT_SCHEDULE',
      entityId: String(supplierId),
      description: `Batch created ${created.length} schedule(s) for supplier #${supplierId} (${year} ${sm}-${em})`,
    }

    return res.status(201).json({ created, skipped })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to batch create schedules.', error: error.message })
  }
})

// PUT /api/supplier-payment-schedules/:id
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = getTenantId(req)
  const { dueDate, amountDue, remindDaysBefore, notes } = req.body

  try {
    const existing = await query(
      'SELECT * FROM supplier_payment_schedules WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Schedule not found.' })
    }
    const row = existing.rows[0]
    const newDueDate = dueDate || row.due_date
    const newAmountDue = amountDue !== undefined ? Number(amountDue) : Number(row.amount_due)
    const newStatus = computeStatus(newAmountDue, Number(row.amount_paid), newDueDate)

    const result = await query(
      `UPDATE supplier_payment_schedules
       SET due_date = $1,
           amount_due = $2,
           remind_days_before = $3,
           notes = $4,
           status = $5,
           reminder_sent = CASE WHEN $1 <> $6 THEN FALSE ELSE reminder_sent END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [
        newDueDate,
        newAmountDue,
        remindDaysBefore !== undefined ? Number(remindDaysBefore) : row.remind_days_before,
        notes !== undefined ? (notes || null) : row.notes,
        newStatus,
        row.due_date,
        req.params.id,
        tenantId,
      ],
    )

    req.auditContext = {
      action: 'PAYMENT_SCHEDULE_UPDATE',
      entityType: 'PAYMENT_SCHEDULE',
      entityId: String(req.params.id),
      description: `Updated payment schedule #${req.params.id}`,
    }

    return res.json(enrich(result.rows[0]))
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update schedule.', error: error.message })
  }
})

// POST /api/supplier-payment-schedules/:id/add-payment
router.post('/:id/add-payment', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = getTenantId(req)
  const { amount, paidDate } = req.body
  const amt = Number(amount) || 0
  if (amt <= 0) {
    return res.status(400).json({ message: 'amount must be greater than 0.' })
  }

  try {
    const existing = await query(
      'SELECT * FROM supplier_payment_schedules WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Schedule not found.' })
    }
    const row = existing.rows[0]
    const newPaid = Number(row.amount_paid) + amt
    const newStatus = computeStatus(Number(row.amount_due), newPaid, row.due_date)

    const result = await query(
      `UPDATE supplier_payment_schedules
       SET amount_paid = $1, status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [newPaid, newStatus, req.params.id, tenantId],
    )

    // Also log into supplier_payment_records for the monthly paid grid to pick up
    try {
      await query(
        `INSERT INTO supplier_payment_records
           (tenant_id, supplier_id, period_month, period_year, paid_date, amount, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (supplier_id, period_month, period_year)
         DO UPDATE SET amount = COALESCE(supplier_payment_records.amount, 0) + EXCLUDED.amount,
                       paid_date = EXCLUDED.paid_date`,
        [
          tenantId,
          row.supplier_id,
          row.period_month,
          row.period_year,
          paidDate || new Date().toISOString().slice(0, 10),
          amt,
          `From schedule #${row.id}`,
          req.user.id,
        ],
      )
    } catch (_) {
      // best effort: do not fail the main response
    }

    req.auditContext = {
      action: 'PAYMENT_SCHEDULE_ADD_PAYMENT',
      entityType: 'PAYMENT_SCHEDULE',
      entityId: String(req.params.id),
      description: `Added payment ${amt} to schedule #${req.params.id}`,
    }

    return res.json(enrich(result.rows[0]))
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add payment.', error: error.message })
  }
})

// POST /api/supplier-payment-schedules/:id/mark-paid
router.post('/:id/mark-paid', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const existing = await query(
      'SELECT * FROM supplier_payment_schedules WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Schedule not found.' })
    }
    const row = existing.rows[0]
    const result = await query(
      `UPDATE supplier_payment_schedules
       SET amount_paid = amount_due, status = 'PAID', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [req.params.id, tenantId],
    )

    req.auditContext = {
      action: 'PAYMENT_SCHEDULE_MARK_PAID',
      entityType: 'PAYMENT_SCHEDULE',
      entityId: String(req.params.id),
      description: `Marked schedule #${req.params.id} as PAID`,
    }

    return res.json(enrich(result.rows[0]))
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark as paid.', error: error.message })
  }
})

// DELETE /api/supplier-payment-schedules/:id
router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const existing = await query(
      'SELECT id FROM supplier_payment_schedules WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Schedule not found.' })
    }
    await query(
      'DELETE FROM supplier_payment_schedules WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId],
    )

    req.auditContext = {
      action: 'PAYMENT_SCHEDULE_DELETE',
      entityType: 'PAYMENT_SCHEDULE',
      entityId: String(req.params.id),
      description: `Deleted payment schedule #${req.params.id}`,
    }

    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete schedule.', error: error.message })
  }
})

module.exports = router
