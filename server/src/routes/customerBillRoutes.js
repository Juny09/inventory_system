const express = require('express')
const { pool, query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const { createUploader, buildAttachmentPath, removeFileQuiet } = require('./_supplierDocAttachment')

const router = express.Router()
const SUB_DIR = 'customer-bills'
const upload = createUploader({ subDir: SUB_DIR })

router.use(authenticateToken)

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

function normalizeStatus(value) {
  const upper = String(value || '').toUpperCase()
  const allowed = new Set(['PENDING', 'PAID', 'OVERDUE'])
  return allowed.has(upper) ? upper : null
}

function computeAmount(quantity, unitPrice, amount) {
  const q = Number(quantity)
  const p = Number(unitPrice)
  const a = amount === undefined || amount === null ? Number.NaN : Number(amount)
  if (Number.isFinite(a) && a >= 0) return Number(a.toFixed(2))
  if (!Number.isFinite(q) || q < 0) return 0
  if (!Number.isFinite(p) || p < 0) return 0
  return Number((q * p).toFixed(2))
}

router.get('/', async (req, res) => {
  const tenantId = req.tenantId
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const customerId = parseIntOrNull(req.query.customerId)
  const year = parseIntOrNull(req.query.year)
  const month = parseIntOrNull(req.query.month)
  const status = String(req.query.status || 'all').toLowerCase()

  try {
    const filters = ['b.tenant_id = $1']
    const params = [tenantId]
    let idx = 2

    if (customerId) {
      filters.push(`b.customer_id = $${idx++}`)
      params.push(customerId)
    }
    if (year) {
      filters.push(`b.period_year = $${idx++}`)
      params.push(year)
    }
    if (month) {
      filters.push(`b.period_month = $${idx++}`)
      params.push(month)
    }
    if (status !== 'all') {
      const normalized = normalizeStatus(status)
      if (!normalized) return res.status(400).json({ message: 'Invalid status.' })
      filters.push(`b.status = $${idx++}`)
      params.push(normalized)
    }

    const whereClause = filters.join(' AND ')

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            b.id,
            b.customer_id,
            COALESCE(c.company_name, c.name) AS customer_name,
            b.period_year,
            b.period_month,
            CASE
              WHEN b.status = 'PENDING' AND b.due_date IS NOT NULL AND b.due_date < CURRENT_DATE THEN 'OVERDUE'
              ELSE b.status
            END AS status,
            b.due_date,
            b.currency,
            b.total_amount,
            b.notes,
            b.created_at,
            b.updated_at
          FROM customer_bills b
          INNER JOIN customers c ON c.id = b.customer_id AND c.tenant_id = b.tenant_id
          WHERE ${whereClause}
          ORDER BY b.period_year DESC, b.period_month DESC, customer_name ASC, b.id DESC
          LIMIT $${idx} OFFSET $${idx + 1}
        `,
        [...params, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM customer_bills b
          WHERE ${whereClause}
        `,
        params,
      ),
    ])

    return res.json({
      items: itemsResult.rows.map((row) => ({
        id: row.id,
        customerId: row.customer_id,
        customerName: row.customer_name,
        periodYear: row.period_year,
        periodMonth: row.period_month,
        status: row.status,
        dueDate: row.due_date,
        currency: row.currency,
        totalAmount: Number(row.total_amount || 0),
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch customer bills.', error: error.message })
  }
})

router.post('/', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = req.tenantId
  const userId = req.user?.id || null

  try {
    const customerId = Number(req.body.customerId)
    const periodYear = Number(req.body.periodYear)
    const periodMonth = Number(req.body.periodMonth)
    validatePeriod({ periodYear, periodMonth })

    if (!Number.isInteger(customerId)) {
      return res.status(400).json({ message: 'Invalid customerId.' })
    }

    const status = normalizeStatus(req.body.status) || 'PENDING'
    const dueDate = req.body.dueDate ? String(req.body.dueDate) : null
    const currency = String(req.body.currency || 'MYR').toUpperCase().slice(0, 10)
    const notes = req.body.notes ? String(req.body.notes) : null

    const items = Array.isArray(req.body.items) ? req.body.items : []
    if (!items.length) {
      return res.status(400).json({ message: 'Items are required.' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const customer = await client.query(`SELECT id FROM customers WHERE tenant_id = $1 AND id = $2`, [
        tenantId,
        customerId,
      ])
      if (!customer.rows.length) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Customer not found.' })
      }

      const bill = await client.query(
        `
          INSERT INTO customer_bills (
            tenant_id,
            customer_id,
            period_year,
            period_month,
            status,
            due_date,
            currency,
            notes,
            created_by,
            updated_by
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
          RETURNING id
        `,
        [tenantId, customerId, periodYear, periodMonth, status, dueDate, currency, notes, userId],
      )

      const billId = bill.rows[0].id
      let totalAmount = 0

      for (let i = 0; i < items.length; i += 1) {
        const row = items[i] || {}
        const description = String(row.description || '').trim()
        if (!description) {
          const error = new Error('Each item requires description.')
          error.statusCode = 400
          throw error
        }

        const quantity = Number(row.quantity ?? 1)
        const unitPrice = Number(row.unitPrice ?? 0)
        const amount = computeAmount(quantity, unitPrice, row.amount)
        totalAmount += amount

        await client.query(
          `
            INSERT INTO customer_bill_items (
              bill_id,
              description,
              quantity,
              unit_price,
              amount,
              sort_order
            )
            VALUES ($1,$2,$3,$4,$5,$6)
          `,
          [billId, description, quantity, unitPrice, amount, i],
        )
      }

      await client.query(`UPDATE customer_bills SET total_amount = $3, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND id = $2`, [
        tenantId,
        billId,
        Number(totalAmount.toFixed(2)),
      ])

      await client.query('COMMIT')

      const created = await query(
        `
          SELECT
            b.*,
            COALESCE(c.company_name, c.name) AS customer_name
          FROM customer_bills b
          INNER JOIN customers c ON c.id = b.customer_id AND c.tenant_id = b.tenant_id
          WHERE b.tenant_id = $1 AND b.id = $2
        `,
        [tenantId, billId],
      )
      const itemRows = await query(
        `
          SELECT id, description, quantity, unit_price, amount, sort_order
          FROM customer_bill_items
          WHERE bill_id = $1
          ORDER BY sort_order ASC, id ASC
        `,
        [billId],
      )

      return res.status(201).json({
        bill: {
          id: created.rows[0].id,
          customerId: created.rows[0].customer_id,
          customerName: created.rows[0].customer_name,
          periodYear: created.rows[0].period_year,
          periodMonth: created.rows[0].period_month,
          status: created.rows[0].status,
          dueDate: created.rows[0].due_date,
          currency: created.rows[0].currency,
          totalAmount: Number(created.rows[0].total_amount || 0),
          notes: created.rows[0].notes,
          createdAt: created.rows[0].created_at,
          updatedAt: created.rows[0].updated_at,
          items: itemRows.rows.map((r) => ({
            id: r.id,
            description: r.description,
            quantity: Number(r.quantity || 0),
            unitPrice: Number(r.unit_price || 0),
            amount: Number(r.amount || 0),
            sortOrder: r.sort_order,
          })),
          attachments: [],
        },
      })
    } catch (error) {
      await client.query('ROLLBACK')
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Bill already exists for this customer and month.' })
      }
      const statusCode = error.statusCode || 500
      return res.status(statusCode).json({ message: 'Failed to create bill.', error: error.message })
    } finally {
      client.release()
    }
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({ message: 'Failed to create bill.', error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  const tenantId = req.tenantId
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid id.' })

  try {
    const bill = await query(
      `
        SELECT
          b.*,
          COALESCE(c.company_name, c.name) AS customer_name
        FROM customer_bills b
        INNER JOIN customers c ON c.id = b.customer_id AND c.tenant_id = b.tenant_id
        WHERE b.tenant_id = $1 AND b.id = $2
      `,
      [tenantId, id],
    )
    if (!bill.rows.length) return res.status(404).json({ message: 'Bill not found.' })

    const [items, attachments] = await Promise.all([
      query(
        `
          SELECT id, description, quantity, unit_price, amount, sort_order
          FROM customer_bill_items
          WHERE bill_id = $1
          ORDER BY sort_order ASC, id ASC
        `,
        [id],
      ),
      query(
        `
          SELECT id, original_name, storage_path, mime_type, file_size, created_at
          FROM customer_bill_attachments
          WHERE bill_id = $1
          ORDER BY created_at DESC, id DESC
        `,
        [id],
      ),
    ])

    const row = bill.rows[0]
    return res.json({
      bill: {
        id: row.id,
        customerId: row.customer_id,
        customerName: row.customer_name,
        periodYear: row.period_year,
        periodMonth: row.period_month,
        status: row.status,
        dueDate: row.due_date,
        currency: row.currency,
        totalAmount: Number(row.total_amount || 0),
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        items: items.rows.map((r) => ({
          id: r.id,
          description: r.description,
          quantity: Number(r.quantity || 0),
          unitPrice: Number(r.unit_price || 0),
          amount: Number(r.amount || 0),
          sortOrder: r.sort_order,
        })),
        attachments: attachments.rows.map((a) => ({
          id: a.id,
          originalName: a.original_name,
          mimeType: a.mime_type,
          fileSize: a.file_size,
          createdAt: a.created_at,
          url: `/uploads/${SUB_DIR}/${a.storage_path}`,
        })),
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch bill.', error: error.message })
  }
})

router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = req.tenantId
  const userId = req.user?.id || null
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid id.' })

  try {
    const items = Array.isArray(req.body.items) ? req.body.items : []
    if (!items.length) {
      return res.status(400).json({ message: 'Items are required.' })
    }

    const status = normalizeStatus(req.body.status) || 'PENDING'
    const dueDate = req.body.dueDate ? String(req.body.dueDate) : null
    const currency = String(req.body.currency || 'MYR').toUpperCase().slice(0, 10)
    const notes = req.body.notes ? String(req.body.notes) : null

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const existing = await client.query(`SELECT id FROM customer_bills WHERE tenant_id = $1 AND id = $2`, [tenantId, id])
      if (!existing.rows.length) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Bill not found.' })
      }

      await client.query(
        `
          UPDATE customer_bills
          SET
            status = $3,
            due_date = $4,
            currency = $5,
            notes = $6,
            updated_by = $7,
            updated_at = CURRENT_TIMESTAMP
          WHERE tenant_id = $1 AND id = $2
        `,
        [tenantId, id, status, dueDate, currency, notes, userId],
      )

      await client.query(`DELETE FROM customer_bill_items WHERE bill_id = $1`, [id])

      let totalAmount = 0
      for (let i = 0; i < items.length; i += 1) {
        const row = items[i] || {}
        const description = String(row.description || '').trim()
        if (!description) {
          const error = new Error('Each item requires description.')
          error.statusCode = 400
          throw error
        }

        const quantity = Number(row.quantity ?? 1)
        const unitPrice = Number(row.unitPrice ?? 0)
        const amount = computeAmount(quantity, unitPrice, row.amount)
        totalAmount += amount

        await client.query(
          `
            INSERT INTO customer_bill_items (bill_id, description, quantity, unit_price, amount, sort_order)
            VALUES ($1,$2,$3,$4,$5,$6)
          `,
          [id, description, quantity, unitPrice, amount, i],
        )
      }

      await client.query(
        `UPDATE customer_bills SET total_amount = $3, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id, Number(totalAmount.toFixed(2))],
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      const statusCode = error.statusCode || 500
      return res.status(statusCode).json({ message: 'Failed to update bill.', error: error.message })
    } finally {
      client.release()
    }

    const detail = await query(
      `
        SELECT
          b.*,
          COALESCE(c.company_name, c.name) AS customer_name
        FROM customer_bills b
        INNER JOIN customers c ON c.id = b.customer_id AND c.tenant_id = b.tenant_id
        WHERE b.tenant_id = $1 AND b.id = $2
      `,
      [tenantId, id],
    )
    const itemRows = await query(
      `SELECT id, description, quantity, unit_price, amount, sort_order FROM customer_bill_items WHERE bill_id = $1 ORDER BY sort_order ASC, id ASC`,
      [id],
    )
    const row = detail.rows[0]
    return res.json({
      bill: {
        id: row.id,
        customerId: row.customer_id,
        customerName: row.customer_name,
        periodYear: row.period_year,
        periodMonth: row.period_month,
        status: row.status,
        dueDate: row.due_date,
        currency: row.currency,
        totalAmount: Number(row.total_amount || 0),
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        items: itemRows.rows.map((r) => ({
          id: r.id,
          description: r.description,
          quantity: Number(r.quantity || 0),
          unitPrice: Number(r.unit_price || 0),
          amount: Number(r.amount || 0),
          sortOrder: r.sort_order,
        })),
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update bill.', error: error.message })
  }
})

router.patch('/:id/status', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = req.tenantId
  const userId = req.user?.id || null
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid id.' })

  const status = normalizeStatus(req.body.status)
  if (!status) return res.status(400).json({ message: 'Invalid status.' })

  try {
    const updated = await query(
      `
        UPDATE customer_bills
        SET status = $3, updated_by = $4, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1 AND id = $2
        RETURNING id, status
      `,
      [tenantId, id, status, userId],
    )
    if (!updated.rows.length) return res.status(404).json({ message: 'Bill not found.' })
    return res.json({ id: updated.rows[0].id, status: updated.rows[0].status })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update status.', error: error.message })
  }
})

router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = req.tenantId
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid id.' })

  try {
    const deleted = await query(`DELETE FROM customer_bills WHERE tenant_id = $1 AND id = $2 RETURNING id`, [tenantId, id])
    if (!deleted.rows.length) return res.status(404).json({ message: 'Bill not found.' })
    return res.json({ success: true })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete bill.', error: error.message })
  }
})

router.post('/:id/attachments', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), upload.single('file'), async (req, res) => {
  const tenantId = req.tenantId
  const billId = Number(req.params.id)
  if (!Number.isInteger(billId)) return res.status(400).json({ message: 'Invalid id.' })

  const file = req.file
  if (!file) return res.status(400).json({ message: 'No file uploaded.' })

  try {
    const exists = await query(`SELECT id FROM customer_bills WHERE tenant_id = $1 AND id = $2`, [tenantId, billId])
    if (!exists.rows.length) {
      removeFileQuiet(file.path)
      return res.status(404).json({ message: 'Bill not found.' })
    }

    const uploaded = await query(
      `
        INSERT INTO customer_bill_attachments (
          bill_id,
          original_name,
          storage_path,
          mime_type,
          file_size,
          uploaded_by
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id, original_name, storage_path, mime_type, file_size, created_at
      `,
      [billId, file.originalname, file.filename, file.mimetype, file.size, req.user?.id || null],
    )

    const row = uploaded.rows[0]
    return res.status(201).json({
      attachment: {
        id: row.id,
        originalName: row.original_name,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        createdAt: row.created_at,
        url: `/uploads/${SUB_DIR}/${row.storage_path}`,
      },
    })
  } catch (error) {
    removeFileQuiet(file.path)
    return res.status(500).json({ message: 'Failed to upload attachment.', error: error.message })
  }
})

router.delete(
  '/:id/attachments/:attachmentId',
  authorizeRoles('ADMIN', 'MANAGER', 'STAFF'),
  async (req, res) => {
    const tenantId = req.tenantId
    const billId = Number(req.params.id)
    const attachmentId = Number(req.params.attachmentId)
    if (!Number.isInteger(billId) || !Number.isInteger(attachmentId)) return res.status(400).json({ message: 'Invalid id.' })

    try {
      const bill = await query(`SELECT id FROM customer_bills WHERE tenant_id = $1 AND id = $2`, [tenantId, billId])
      if (!bill.rows.length) return res.status(404).json({ message: 'Bill not found.' })

      const removed = await query(
        `
          DELETE FROM customer_bill_attachments
          WHERE bill_id = $1 AND id = $2
          RETURNING storage_path
        `,
        [billId, attachmentId],
      )
      if (!removed.rows.length) return res.status(404).json({ message: 'Attachment not found.' })

      const fullPath = buildAttachmentPath(SUB_DIR, removed.rows[0].storage_path)
      removeFileQuiet(fullPath)

      return res.json({ success: true })
    } catch (error) {
      return res.status(500).json({ message: 'Failed to delete attachment.', error: error.message })
    }
  },
)

module.exports = router

