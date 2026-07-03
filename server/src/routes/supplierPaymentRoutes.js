const express = require('express')
const multer = require('multer')
const XLSX = require('xlsx')
const { pool, query } = require('../config/db')
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

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = new Set([
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ])
    const ext = String(file.originalname || '').toLowerCase()
    if (allowedMimeTypes.has(file.mimetype) || ext.endsWith('.csv') || ext.endsWith('.xls') || ext.endsWith('.xlsx')) {
      cb(null, true)
      return
    }
    cb(new Error('Unsupported file type. Please upload CSV or Excel.'), false)
  },
})

function normalizeImportHeader(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function normalizeSupplierKey(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function parseImportNumber(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const normalized = raw.replace(/,/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseImportInteger(value) {
  const parsed = parseImportNumber(value)
  if (!Number.isInteger(parsed)) return null
  return parsed
}

function hasImportValue(value) {
  return String(value ?? '').trim() !== ''
}

function isImportRowEmpty(row) {
  return Object.values(row || {}).every((value) => !hasImportValue(value))
}

function buildSupplierLookup(rows) {
  const map = new Map()
  for (const row of rows) {
    const keys = [
      normalizeSupplierKey(row.name),
      normalizeSupplierKey(row.company_name),
      normalizeSupplierKey(row.company_name ? `${row.name} (${row.company_name})` : row.name),
    ].filter(Boolean)

    for (const key of keys) {
      const list = map.get(key) || []
      list.push(row)
      map.set(key, list)
    }
  }
  return map
}

function readImportWorkbook(file) {
  const workbook = XLSX.read(file.buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

function mapImportRow(rawRow) {
  const normalizedEntries = Object.entries(rawRow || {}).map(([key, value]) => [normalizeImportHeader(key), value])
  const normalizedRow = Object.fromEntries(normalizedEntries)

  return {
    chequeNumber: String(normalizedRow.CHEQUENUM || '').trim(),
    supplierName: String(normalizedRow.DESC || '').trim(),
    ref: String(normalizedRow.REF || '').trim(),
    amount: parseImportNumber(normalizedRow.WITHDRAWDR),
    creditAmount: parseImportNumber(normalizedRow.CR),
    cancel: String(normalizedRow.CANCEL || '').trim(),
    month: parseImportInteger(normalizedRow.MONTH),
    year: parseImportInteger(normalizedRow.YEAR),
  }
}

function buildExistingPaymentMap(rows) {
  const map = new Map()
  for (const row of rows) {
    map.set(`${row.supplier_id}-${row.period_year}-${row.period_month}`, row)
  }
  return map
}

async function fetchExistingPayments(tenantId, rows) {
  const supplierIds = [...new Set(rows.map((row) => row.supplierId).filter(Boolean))]
  const years = [...new Set(rows.map((row) => row.year).filter(Boolean))]
  if (!supplierIds.length || !years.length) return new Map()

  const result = await query(
    `SELECT id, supplier_id, period_month, period_year
     FROM supplier_payment_records
     WHERE tenant_id = $1
       AND supplier_id = ANY($2::int[])
       AND period_year = ANY($3::int[])`,
    [tenantId, supplierIds, years],
  )
  return buildExistingPaymentMap(result.rows)
}

async function buildImportPreviewRows(tenantId, rawRows) {
  const suppliersResult = await query(
    `SELECT id, name, company_name
     FROM suppliers
     WHERE tenant_id = $1
       AND is_active = TRUE
     ORDER BY name`,
    [tenantId],
  )
  const supplierLookup = buildSupplierLookup(suppliersResult.rows)
  // 中文说明：这里先把上传文件转成“预览结果”，让前端先确认哪些行会新增、更新、跳过或报错。
  const previewRows = rawRows
    .filter((row) => !isImportRowEmpty(row))
    .map((rawRow, index) => {
      const mapped = mapImportRow(rawRow)
      const messages = []
      let status = 'ready'
      let supplierId = null

      if (hasImportValue(mapped.cancel)) {
        messages.push('CANCEL has value, so this row will be skipped.')
      } else {
        if (!mapped.supplierName) {
          status = 'error'
          messages.push('DESC is required.')
        } else {
          const matches = supplierLookup.get(normalizeSupplierKey(mapped.supplierName)) || []
          if (matches.length === 1) {
            supplierId = Number(matches[0].id)
          } else if (matches.length > 1) {
            status = 'error'
            messages.push('DESC matches multiple suppliers. Please make the supplier name more specific.')
          } else {
            status = 'error'
            messages.push('Supplier not found in current company.')
          }
        }

        if (!Number.isInteger(mapped.month) || mapped.month < 1 || mapped.month > 12) {
          status = 'error'
          messages.push('Month must be an integer between 1 and 12.')
        }

        if (!Number.isInteger(mapped.year) || mapped.year < 2000 || mapped.year > 2100) {
          status = 'error'
          messages.push('Year must be a valid 4-digit year.')
        }

        if (mapped.amount === null || mapped.amount <= 0) {
          status = 'error'
          messages.push('WITHDRAW DR must be a number greater than 0.')
        }

        if (mapped.creditAmount !== null && mapped.creditAmount > 0) {
          messages.push('CR has value. Current import keeps CR as reference only and does not write it into supplier payment amount.')
        }
      }

      return {
        rowNo: index + 2,
        ...mapped,
        supplierId,
        status,
        action: 'pending',
        existingId: null,
        notes: mapped.ref || null,
        paidDate: null,
        messages,
      }
    })

  const duplicateMap = new Map()
  for (const row of previewRows) {
    if (row.status !== 'ready') continue
    const key = `${row.supplierId}-${row.year}-${row.month}`
    const list = duplicateMap.get(key) || []
    list.push(row)
    duplicateMap.set(key, list)
  }

  for (const rows of duplicateMap.values()) {
    if (rows.length < 2) continue
    const rowNos = rows.map((row) => row.rowNo).join(', ')
    for (const row of rows) {
      row.status = 'error'
      row.messages.push(`Duplicate supplier + month + year found in this file (rows: ${rowNos}). Please keep only one row for each period.`)
    }
  }

  const readyRows = previewRows.filter((row) => row.status === 'ready')
  const existingMap = await fetchExistingPayments(tenantId, readyRows)

  for (const row of previewRows) {
    if (row.status !== 'ready') continue
    const existing = existingMap.get(`${row.supplierId}-${row.year}-${row.month}`)
    row.action = existing ? 'update' : 'create'
    row.existingId = existing?.id || null
  }

  return {
    rows: previewRows,
    summary: {
      total: previewRows.length,
      ready: previewRows.filter((row) => row.status === 'ready').length,
      create: previewRows.filter((row) => row.status === 'ready' && row.action === 'create').length,
      update: previewRows.filter((row) => row.status === 'ready' && row.action === 'update').length,
      skip: previewRows.filter((row) => row.status === 'skip').length,
      error: previewRows.filter((row) => row.status === 'error').length,
    },
  }
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
                spr.supplier_id,
                spr.period_month,
                spr.period_year,
                spr.paid_date,
                spr.amount,
                spr.notes,
                spr.cheque_number,
                spr.payment_slip_number,
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

// POST /api/supplier-payments/import/preview — parse import file and show validation result
router.post('/import/preview', authorizeRoles('ADMIN', 'MANAGER'), importUpload.single('file'), async (req, res) => {
  const tenantId = getTenantId(req)
  if (!req.file) {
    return res.status(400).json({ message: 'Import file is required.' })
  }

  try {
    const rawRows = readImportWorkbook(req.file)
    const preview = await buildImportPreviewRows(tenantId, rawRows)

    return res.json({
      fileName: req.file.originalname,
      summary: preview.summary,
      rows: preview.rows,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to preview import file.', error: error.message })
  }
})

// POST /api/supplier-payments/import/commit — import validated rows into supplier payments
router.post('/import/commit', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = getTenantId(req)
  const rawRows = Array.isArray(req.body?.rows) ? req.body.rows : []

  if (!rawRows.length) {
    return res.status(400).json({ message: 'No rows selected for import.' })
  }

  const rows = rawRows
    .filter((row) => row?.status === 'ready')
    .map((row) => ({
      supplierId: Number(row.supplierId),
      month: Number(row.month),
      year: Number(row.year),
      amount: Number(row.amount),
      chequeNumber: row.chequeNumber ? String(row.chequeNumber).trim() : null,
      notes: row.ref ? String(row.ref).trim() : null,
    }))

  if (!rows.length) {
    return res.status(400).json({ message: 'No valid rows are ready to import.' })
  }

  const invalidRows = rows.filter((row) => {
    if (!Number.isInteger(row.supplierId) || row.supplierId <= 0) return true
    if (!Number.isInteger(row.month) || row.month < 1 || row.month > 12) return true
    if (!Number.isInteger(row.year) || row.year < 2000 || row.year > 2100) return true
    if (!Number.isFinite(row.amount) || row.amount <= 0) return true
    return false
  })

  if (invalidRows.length) {
    return res.status(400).json({ message: 'Import rows contain invalid values. Please preview again before importing.' })
  }

  const supplierIds = [...new Set(rows.map((row) => row.supplierId))]
  try {
    const supplierCheck = await query(
      `SELECT id
       FROM suppliers
       WHERE tenant_id = $1
         AND is_active = TRUE
         AND id = ANY($2::int[])`,
      [tenantId, supplierIds],
    )
    if (supplierCheck.rows.length !== supplierIds.length) {
      return res.status(400).json({ message: 'Some suppliers no longer exist or are inactive. Please preview again.' })
    }

    const existingMap = await fetchExistingPayments(tenantId, rows)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const items = []
      let created = 0
      let updated = 0

      for (const row of rows) {
        // 中文说明：导入时仍然再次校验并做 upsert，避免前端预览后数据被篡改。
        const key = `${row.supplierId}-${row.year}-${row.month}`
        const existing = existingMap.get(key)
        const result = await client.query(
          `INSERT INTO supplier_payment_records (
             tenant_id,
             supplier_id,
             period_month,
             period_year,
             paid_date,
             amount,
             notes,
             cheque_number,
             payment_slip_number,
             created_by
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (tenant_id, supplier_id, period_year, period_month)
           DO UPDATE SET
             paid_date = COALESCE(EXCLUDED.paid_date, supplier_payment_records.paid_date),
             amount = EXCLUDED.amount,
             notes = EXCLUDED.notes,
             cheque_number = EXCLUDED.cheque_number,
             payment_slip_number = COALESCE(EXCLUDED.payment_slip_number, supplier_payment_records.payment_slip_number),
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [
            tenantId,
            row.supplierId,
            row.month,
            row.year,
            null,
            row.amount,
            row.notes,
            row.chequeNumber,
            null,
            req.user.id,
          ],
        )

        if (existing) {
          updated += 1
        } else {
          created += 1
        }

        items.push(result.rows[0])
      }

      await client.query('COMMIT')

      req.auditContext = {
        action: 'SUPPLIER_PAYMENT_IMPORT',
        entityType: 'SUPPLIER_PAYMENT_IMPORT',
        entityId: `${tenantId}-${Date.now()}`,
        description: `Imported ${rows.length} supplier payment rows (${created} created, ${updated} updated)`,
      }

      return res.json({
        summary: {
          imported: rows.length,
          created,
          updated,
        },
        items,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      return res.status(500).json({ message: 'Failed to import supplier payments.', error: error.message })
    } finally {
      client.release()
    }
  } catch (error) {
    return res.status(500).json({ message: 'Failed to import supplier payments.', error: error.message })
  }
})

// POST /api/supplier-payments — create a payment record（租户隔离）
router.post('/', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplierId, periodMonth, periodYear, paidDate, amount, notes, chequeNumber, paymentSlipNumber } = req.body

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
      `INSERT INTO supplier_payment_records (tenant_id, supplier_id, period_month, period_year, paid_date, amount, notes, cheque_number, payment_slip_number, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id, supplier_id, period_year, period_month)
       DO UPDATE SET paid_date = EXCLUDED.paid_date, amount = EXCLUDED.amount, notes = EXCLUDED.notes, cheque_number = EXCLUDED.cheque_number, payment_slip_number = EXCLUDED.payment_slip_number, created_by = EXCLUDED.created_by
       RETURNING *`,
      [
        tenantId,
        Number(supplierId),
        Number(periodMonth),
        Number(periodYear),
        paidDate || null,
        amount ? Number(amount) : null,
        notes || null,
        chequeNumber || null,
        paymentSlipNumber || null,
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

// PUT /api/supplier-payments/:id — update a payment record（租户隔离）
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplierId, periodMonth, periodYear, paidDate, amount, notes, chequeNumber, paymentSlipNumber } = req.body

  try {
    // 校验记录存在且属于当前租户
    const existing = await query(
      'SELECT id FROM supplier_payment_records WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Payment record not found.' })
    }

    // 如果修改了 supplier，校验新 supplier 属于当前租户
    if (supplierId) {
      const supplierCheck = await query(
        'SELECT id FROM suppliers WHERE id = $1 AND tenant_id = $2',
        [Number(supplierId), tenantId],
      )
      if (!supplierCheck.rows[0]) {
        return res.status(404).json({ message: 'Supplier not found in current company.' })
      }
    }

    const result = await query(
      `UPDATE supplier_payment_records
       SET supplier_id = COALESCE($1, supplier_id),
           period_month = COALESCE($2, period_month),
           period_year = COALESCE($3, period_year),
           paid_date = $4,
           amount = $5,
           notes = $6,
           cheque_number = $7,
           payment_slip_number = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND tenant_id = $10
       RETURNING *`,
      [
        supplierId ? Number(supplierId) : null,
        periodMonth ? Number(periodMonth) : null,
        periodYear ? Number(periodYear) : null,
        paidDate || null,
        amount ? Number(amount) : null,
        notes || null,
        chequeNumber || null,
        paymentSlipNumber || null,
        req.params.id,
        tenantId,
      ],
    )

    req.auditContext = {
      action: 'SUPPLIER_PAYMENT_UPDATE',
      entityType: 'SUPPLIER_PAYMENT',
      entityId: String(req.params.id),
      description: `Updated payment record #${req.params.id}`,
    }

    return res.json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update payment record.', error: error.message })
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

// GET /api/supplier-payments/:id — get single payment record（租户隔离）
router.get('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const result = await query(
      `SELECT spr.*, suppliers.name AS supplier_name, suppliers.company_name AS supplier_branch
       FROM supplier_payment_records spr
       INNER JOIN suppliers ON suppliers.id = spr.supplier_id AND suppliers.tenant_id = spr.tenant_id
       WHERE spr.id = $1 AND spr.tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Payment record not found.' })
    }
    return res.json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch payment record.', error: error.message })
  }
})

module.exports = router
