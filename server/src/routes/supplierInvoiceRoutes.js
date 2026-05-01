const express = require('express')
const multer = require('multer')
const { pool, query } = require('../config/db')
const { authenticateToken } = require('../middleware/auth')
const { getTenantId } = require('../utils/tenant')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const { postItemsToStock } = require('../utils/inventoryService')
const {
  createUploader,
  buildAttachmentPath,
  removeFileQuiet,
} = require('./_supplierDocAttachment')

const router = express.Router()
const SUB_DIR = 'supplier-invoices'
const upload = createUploader({ subDir: SUB_DIR })

router.use(authenticateToken)

function computeAmount(quantity, unitPrice, discount) {
  const q = Number(quantity) || 0
  const u = Number(unitPrice) || 0
  const d = Number(discount) || 0
  const raw = q * u - d
  return Number.isFinite(raw) ? Math.max(0, raw) : 0
}

function computeTotals(items) {
  let totalQty = 0
  let totalAmount = 0
  const normalized = items.map((it, i) => {
    const quantity = Number(it.quantity) || 0
    const unit_price = Number(it.unit_price) || 0
    const discount = Number(it.discount) || 0
    const amount = computeAmount(quantity, unit_price, discount)
    totalQty += quantity
    totalAmount += amount
    return {
      product_id: it.product_id || null,
      item_code: it.item_code || null,
      description: it.description || null,
      serial_no: it.serial_no || null,
      quantity,
      unit_price,
      discount,
      amount,
      sort_order: i,
    }
  })
  return { items: normalized, totalQty, totalAmount }
}

router.get('/', async (req, res) => {
  const tenantId = getTenantId(req)
  const { page, pageSize, offset } = getPaginationParams(req.query)

  const filters = ['inv.tenant_id = $1']
  const params = [tenantId]
  let idx = 2

  if (req.query.supplierId) {
    filters.push(`inv.supplier_id = $${idx++}`)
    params.push(Number(req.query.supplierId))
  }
  if (req.query.doId) {
    filters.push(`inv.do_id = $${idx++}`)
    params.push(Number(req.query.doId))
  }
  if (req.query.search) {
    filters.push(`(inv.invoice_no ILIKE $${idx} OR s.company_name ILIKE $${idx} OR s.name ILIKE $${idx})`)
    params.push(`%${req.query.search}%`)
    idx++
  }
  if (req.query.year) {
    filters.push(`EXTRACT(YEAR FROM inv.invoice_date) = $${idx++}`)
    params.push(Number(req.query.year))
  }
  if (req.query.month) {
    filters.push(`EXTRACT(MONTH FROM inv.invoice_date) = $${idx++}`)
    params.push(Number(req.query.month))
  }

  const whereClause = filters.join(' AND ')

  try {
    const [list, total] = await Promise.all([
      query(
        `
          SELECT inv.id, inv.invoice_no, inv.invoice_date, inv.notes,
                 inv.total_amount, inv.total_quantity,
                 inv.supplier_id, inv.do_id,
                 d.do_no,
                 COALESCE(s.company_name, s.name) AS supplier_name,
                 inv.created_at, inv.updated_at,
                 (SELECT COUNT(*)::int FROM supplier_invoice_items WHERE invoice_id = inv.id) AS item_count,
                 (SELECT COUNT(*)::int FROM supplier_invoice_attachments WHERE invoice_id = inv.id) AS attachment_count
          FROM supplier_invoices inv
          LEFT JOIN suppliers s ON s.id = inv.supplier_id
          LEFT JOIN delivery_orders d ON d.id = inv.do_id
          WHERE ${whereClause}
          ORDER BY inv.invoice_date DESC, inv.id DESC
          LIMIT $${idx} OFFSET $${idx + 1}
        `,
        [...params, pageSize, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM supplier_invoices inv
         LEFT JOIN suppliers s ON s.id = inv.supplier_id
         WHERE ${whereClause}`,
        params,
      ),
    ])

    return res.json({
      items: list.rows,
      pagination: buildPagination(total.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list invoices.', error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const header = await query(
      `SELECT inv.id, inv.invoice_no, inv.invoice_date, inv.notes,
              inv.total_amount, inv.total_quantity,
              inv.supplier_id, inv.do_id, inv.warehouse_id, inv.posted_to_inventory,
              d.do_no,
              w.name AS warehouse_name,
              COALESCE(s.company_name, s.name) AS supplier_name,
              inv.created_at, inv.updated_at
       FROM supplier_invoices inv
       LEFT JOIN suppliers s ON s.id = inv.supplier_id
       LEFT JOIN delivery_orders d ON d.id = inv.do_id
       LEFT JOIN warehouses w ON w.id = inv.warehouse_id
       WHERE inv.id = $1 AND inv.tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!header.rows[0]) {
      return res.status(404).json({ message: 'Invoice not found.' })
    }

    const [items, attachments] = await Promise.all([
      query(
        `SELECT i.id, i.product_id, i.item_code, i.description, i.serial_no,
                i.quantity, i.unit_price, i.discount, i.amount, i.sort_order,
                p.name AS product_name, p.product_code AS product_product_code
         FROM supplier_invoice_items i
         LEFT JOIN products p ON p.id = i.product_id
         WHERE i.invoice_id = $1
         ORDER BY i.sort_order ASC, i.id ASC`,
        [req.params.id],
      ),
      query(
        `SELECT id, original_name, mime_type, file_size, uploaded_by, created_at
         FROM supplier_invoice_attachments
         WHERE invoice_id = $1
         ORDER BY created_at DESC`,
        [req.params.id],
      ),
    ])

    return res.json({ ...header.rows[0], items: items.rows, attachments: attachments.rows })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load invoice.', error: error.message })
  }
})

router.post('/', async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplier_id, do_id, invoice_no, invoice_date, notes, warehouse_id, post_to_inventory, items = [] } = req.body || {}
  if (!supplier_id || !invoice_no || !invoice_date) {
    return res.status(400).json({ message: 'supplier_id, invoice_no, invoice_date are required.' })
  }

  const normalizedDoId = do_id ? Number(do_id) : null
  const normalizedWarehouseId = warehouse_id ? Number(warehouse_id) : null
  // 规则：有 DO 的 invoice 不入库（已由 DO 处理）；无 DO 且勾选 Post 且选了仓库 才入库
  const willPostStock = !normalizedDoId && Boolean(post_to_inventory) && Boolean(normalizedWarehouseId)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const supplierCheck = await client.query(
      `SELECT id FROM suppliers WHERE id = $1 AND tenant_id = $2`,
      [supplier_id, tenantId],
    )
    if (!supplierCheck.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Invalid supplier.' })
    }

    if (normalizedDoId) {
      const doCheck = await client.query(
        `SELECT id, supplier_id FROM delivery_orders WHERE id = $1 AND tenant_id = $2`,
        [normalizedDoId, tenantId],
      )
      if (!doCheck.rows[0]) {
        await client.query('ROLLBACK')
        return res.status(400).json({ message: 'Invalid delivery order.' })
      }
      if (Number(doCheck.rows[0].supplier_id) !== Number(supplier_id)) {
        await client.query('ROLLBACK')
        return res.status(400).json({ message: 'DO supplier mismatch.' })
      }
    }

    const { items: normItems, totalQty, totalAmount } = computeTotals(items)

    const header = await client.query(
      `INSERT INTO supplier_invoices
         (tenant_id, supplier_id, do_id, invoice_no, invoice_date, total_amount, total_quantity,
          notes, warehouse_id, posted_to_inventory, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [tenantId, supplier_id, normalizedDoId, invoice_no, invoice_date, totalAmount, totalQty,
       notes || null, willPostStock ? normalizedWarehouseId : null, willPostStock, req.user.id],
    )
    const invId = header.rows[0].id

    for (const it of normItems) {
      await client.query(
        `INSERT INTO supplier_invoice_items
           (invoice_id, product_id, item_code, description, serial_no, quantity, unit_price, discount, amount, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [invId, it.product_id, it.item_code, it.description, it.serial_no, it.quantity, it.unit_price, it.discount, it.amount, it.sort_order],
      )
    }

    // 入库
    if (willPostStock) {
      await postItemsToStock(client, {
        tenantId,
        warehouseId: normalizedWarehouseId,
        items: normItems,
        direction: 1,
        referenceNo: `INV-${invoice_no}`,
        notes: `Supplier Invoice ${invoice_no} (no DO)`,
        supplierId: Number(supplier_id),
        userId: req.user.id,
      })
    }

    await client.query('COMMIT')

    req.auditContext = {
      action: 'SUPPLIER_INVOICE_CREATE',
      entityType: 'SUPPLIER_INVOICE',
      entityId: String(invId),
      description: `Created invoice ${invoice_no}${willPostStock ? ' (stock posted)' : ''}`,
    }

    return res.status(201).json({ id: invId })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Invoice number already exists for this tenant.' })
    }
    return res.status(500).json({ message: 'Failed to create invoice.', error: error.message })
  } finally {
    client.release()
  }
})

router.put('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplier_id, do_id, invoice_no, invoice_date, notes, warehouse_id, post_to_inventory, items = [] } = req.body || {}
  if (!supplier_id || !invoice_no || !invoice_date) {
    return res.status(400).json({ message: 'supplier_id, invoice_no, invoice_date are required.' })
  }

  const normalizedDoId = do_id ? Number(do_id) : null
  const normalizedWarehouseId = warehouse_id ? Number(warehouse_id) : null
  const willPostStock = !normalizedDoId && Boolean(post_to_inventory) && Boolean(normalizedWarehouseId)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query(
      `SELECT id, warehouse_id, posted_to_inventory FROM supplier_invoices
       WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Invoice not found.' })
    }
    const wasPosted = Boolean(existing.rows[0].posted_to_inventory)
    const oldWarehouseId = existing.rows[0].warehouse_id ? Number(existing.rows[0].warehouse_id) : null

    if (normalizedDoId) {
      const doCheck = await client.query(
        `SELECT id, supplier_id FROM delivery_orders WHERE id = $1 AND tenant_id = $2`,
        [normalizedDoId, tenantId],
      )
      if (!doCheck.rows[0] || Number(doCheck.rows[0].supplier_id) !== Number(supplier_id)) {
        await client.query('ROLLBACK')
        return res.status(400).json({ message: 'Invalid DO or supplier mismatch.' })
      }
    }

    // 1) 原先已入库则先反扣
    if (wasPosted && oldWarehouseId) {
      const oldItems = await client.query(
        `SELECT product_id, quantity FROM supplier_invoice_items WHERE invoice_id = $1`,
        [req.params.id],
      )
      await postItemsToStock(client, {
        tenantId,
        warehouseId: oldWarehouseId,
        items: oldItems.rows,
        direction: -1,
        referenceNo: `INV-${invoice_no}-REVERT`,
        notes: `Revert invoice ${invoice_no} before update`,
        supplierId: Number(supplier_id),
        userId: req.user.id,
      })
    }

    const { items: normItems, totalQty, totalAmount } = computeTotals(items)

    await client.query(
      `UPDATE supplier_invoices
       SET supplier_id = $1, do_id = $2, invoice_no = $3, invoice_date = $4,
           total_amount = $5, total_quantity = $6, notes = $7,
           warehouse_id = $8, posted_to_inventory = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 AND tenant_id = $11`,
      [supplier_id, normalizedDoId, invoice_no, invoice_date, totalAmount, totalQty,
       notes || null, willPostStock ? normalizedWarehouseId : null, willPostStock, req.params.id, tenantId],
    )

    await client.query('DELETE FROM supplier_invoice_items WHERE invoice_id = $1', [req.params.id])
    for (const it of normItems) {
      await client.query(
        `INSERT INTO supplier_invoice_items
           (invoice_id, product_id, item_code, description, serial_no, quantity, unit_price, discount, amount, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [req.params.id, it.product_id, it.item_code, it.description, it.serial_no, it.quantity, it.unit_price, it.discount, it.amount, it.sort_order],
      )
    }

    // 2) 新设置需入库则正向入库
    if (willPostStock) {
      await postItemsToStock(client, {
        tenantId,
        warehouseId: normalizedWarehouseId,
        items: normItems,
        direction: 1,
        referenceNo: `INV-${invoice_no}`,
        notes: `Supplier Invoice ${invoice_no} (updated)`,
        supplierId: Number(supplier_id),
        userId: req.user.id,
      })
    }

    await client.query('COMMIT')

    req.auditContext = {
      action: 'SUPPLIER_INVOICE_UPDATE',
      entityType: 'SUPPLIER_INVOICE',
      entityId: String(req.params.id),
      description: `Updated invoice ${invoice_no}`,
    }

    return res.json({ id: Number(req.params.id) })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Invoice number already exists for this tenant.' })
    }
    return res.status(500).json({ message: 'Failed to update invoice.', error: error.message })
  } finally {
    client.release()
  }
})

router.delete('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query(
      `SELECT id, invoice_no, supplier_id, warehouse_id, posted_to_inventory
       FROM supplier_invoices WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Invoice not found.' })
    }
    const row = existing.rows[0]

    // 反扣库存
    if (row.posted_to_inventory && row.warehouse_id) {
      const oldItems = await client.query(
        `SELECT product_id, quantity FROM supplier_invoice_items WHERE invoice_id = $1`,
        [req.params.id],
      )
      await postItemsToStock(client, {
        tenantId,
        warehouseId: Number(row.warehouse_id),
        items: oldItems.rows,
        direction: -1,
        referenceNo: `INV-${row.invoice_no}-DELETE`,
        notes: `Revert invoice ${row.invoice_no} on delete`,
        supplierId: Number(row.supplier_id),
        userId: req.user.id,
      })
    }

    const attachments = await client.query(
      `SELECT storage_path FROM supplier_invoice_attachments WHERE invoice_id = $1`,
      [req.params.id],
    )

    await client.query(
      `DELETE FROM supplier_invoices WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    )

    await client.query('COMMIT')

    attachments.rows.forEach((r) => removeFileQuiet(buildAttachmentPath(SUB_DIR, r.storage_path)))

    req.auditContext = {
      action: 'SUPPLIER_INVOICE_DELETE',
      entityType: 'SUPPLIER_INVOICE',
      entityId: String(req.params.id),
      description: `Deleted invoice ${req.params.id}`,
    }

    return res.status(204).send()
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    return res.status(500).json({ message: 'Failed to delete invoice.', error: error.message })
  } finally {
    client.release()
  }
})

router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  const tenantId = getTenantId(req)
  if (!req.file) {
    return res.status(400).json({ message: 'File is required.' })
  }
  try {
    const parent = await query(
      `SELECT id FROM supplier_invoices WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!parent.rows[0]) {
      removeFileQuiet(req.file.path)
      return res.status(404).json({ message: 'Invoice not found.' })
    }
    const result = await query(
      `INSERT INTO supplier_invoice_attachments (invoice_id, original_name, storage_path, mime_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, original_name, mime_type, file_size, created_at`,
      [req.params.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, req.user.id],
    )
    return res.status(201).json(result.rows[0])
  } catch (error) {
    removeFileQuiet(req.file.path)
    return res.status(500).json({ message: 'Failed to upload attachment.', error: error.message })
  }
})

router.get('/:id/attachments/:attId/download', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const result = await query(
      `SELECT a.original_name, a.storage_path, a.mime_type
       FROM supplier_invoice_attachments a
       INNER JOIN supplier_invoices inv ON inv.id = a.invoice_id
       WHERE a.id = $1 AND inv.id = $2 AND inv.tenant_id = $3`,
      [req.params.attId, req.params.id, tenantId],
    )
    const row = result.rows[0]
    if (!row) return res.status(404).json({ message: 'Attachment not found.' })
    const fullPath = buildAttachmentPath(SUB_DIR, row.storage_path)
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream')
    return res.download(fullPath, row.original_name)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to download attachment.', error: error.message })
  }
})

router.delete('/:id/attachments/:attId', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const result = await query(
      `DELETE FROM supplier_invoice_attachments a
       USING supplier_invoices inv
       WHERE a.id = $1 AND a.invoice_id = inv.id AND inv.id = $2 AND inv.tenant_id = $3
       RETURNING a.storage_path`,
      [req.params.attId, req.params.id, tenantId],
    )
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Attachment not found.' })
    }
    removeFileQuiet(buildAttachmentPath(SUB_DIR, result.rows[0].storage_path))
    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete attachment.', error: error.message })
  }
})

router.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Max 25MB.' })
    }
    return res.status(400).json({ message: 'Upload failed.', error: error.message })
  }
  if (error) {
    return res.status(400).json({ message: error.message || 'Upload failed.' })
  }
  return res.status(400).json({ message: 'Upload failed.' })
})

module.exports = router
