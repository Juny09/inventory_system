const express = require('express')
const multer = require('multer')
const { pool, query } = require('../config/db')
const { authenticateToken } = require('../middleware/auth')
const { getTenantId } = require('../utils/tenant')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const {
  createUploader,
  buildAttachmentPath,
  removeFileQuiet,
} = require('./_supplierDocAttachment')

const router = express.Router()
const SUB_DIR = 'purchase-orders'
const upload = createUploader({ subDir: SUB_DIR })

router.use(authenticateToken)

/**
 * 列表：支持 ?supplierId=&search=&page=&pageSize=
 * 响应 { items: [...], pagination }
 */
router.get('/', async (req, res) => {
  const tenantId = getTenantId(req)
  const { page, pageSize, offset } = getPaginationParams(req.query)

  const filters = ['po.tenant_id = $1']
  const params = [tenantId]
  let idx = 2

  if (req.query.supplierId) {
    filters.push(`po.supplier_id = $${idx++}`)
    params.push(Number(req.query.supplierId))
  }
  if (req.query.search) {
    filters.push(`(po.po_no ILIKE $${idx} OR s.company_name ILIKE $${idx} OR s.name ILIKE $${idx})`)
    params.push(`%${req.query.search}%`)
    idx++
  }

  const whereClause = filters.join(' AND ')

  try {
    const [list, total] = await Promise.all([
      query(
        `
          SELECT po.id, po.po_no, po.po_date, po.notes, po.created_at, po.updated_at,
                 po.supplier_id,
                 COALESCE(s.company_name, s.name) AS supplier_name,
                 (SELECT COUNT(*)::int FROM purchase_order_items WHERE po_id = po.id) AS item_count,
                 (SELECT COUNT(*)::int FROM purchase_order_attachments WHERE po_id = po.id) AS attachment_count
          FROM purchase_orders po
          LEFT JOIN suppliers s ON s.id = po.supplier_id
          WHERE ${whereClause}
          ORDER BY po.po_date DESC, po.id DESC
          LIMIT $${idx} OFFSET $${idx + 1}
        `,
        [...params, pageSize, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS total FROM purchase_orders po
         LEFT JOIN suppliers s ON s.id = po.supplier_id
         WHERE ${whereClause}`,
        params,
      ),
    ])

    return res.json({
      items: list.rows,
      pagination: buildPagination(total.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list purchase orders.', error: error.message })
  }
})

/**
 * 详情：含 items + attachments
 */
router.get('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const header = await query(
      `SELECT po.id, po.po_no, po.po_date, po.notes, po.supplier_id, po.created_at, po.updated_at,
              COALESCE(s.company_name, s.name) AS supplier_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       WHERE po.id = $1 AND po.tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!header.rows[0]) {
      return res.status(404).json({ message: 'Purchase order not found.' })
    }

    const [items, attachments] = await Promise.all([
      query(
        `SELECT i.id, i.product_id, i.item_code, i.description, i.serial_no, i.quantity, i.sort_order,
                p.name AS product_name, p.product_code AS product_product_code
         FROM purchase_order_items i
         LEFT JOIN products p ON p.id = i.product_id
         WHERE i.po_id = $1
         ORDER BY i.sort_order ASC, i.id ASC`,
        [req.params.id],
      ),
      query(
        `SELECT id, original_name, mime_type, file_size, uploaded_by, created_at
         FROM purchase_order_attachments
         WHERE po_id = $1
         ORDER BY created_at DESC`,
        [req.params.id],
      ),
    ])

    return res.json({ ...header.rows[0], items: items.rows, attachments: attachments.rows })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load purchase order.', error: error.message })
  }
})

/**
 * 创建：事务 INSERT header + items
 */
router.post('/', async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplier_id, po_no, po_date, notes, items = [] } = req.body || {}

  if (!supplier_id || !po_no || !po_date) {
    return res.status(400).json({ message: 'supplier_id, po_no, po_date are required.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 校验 supplier 归属当前租户
    const supplierCheck = await client.query(
      `SELECT id FROM suppliers WHERE id = $1 AND tenant_id = $2`,
      [supplier_id, tenantId],
    )
    if (!supplierCheck.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Invalid supplier.' })
    }

    const header = await client.query(
      `INSERT INTO purchase_orders (tenant_id, supplier_id, po_no, po_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [tenantId, supplier_id, po_no, po_date, notes || null, req.user.id],
    )
    const poId = header.rows[0].id

    for (let i = 0; i < items.length; i += 1) {
      const it = items[i]
      await client.query(
        `INSERT INTO purchase_order_items (po_id, product_id, item_code, description, serial_no, quantity, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          poId,
          it.product_id || null,
          it.item_code || null,
          it.description || null,
          it.serial_no || null,
          Number(it.quantity) || 0,
          i,
        ],
      )
    }

    await client.query('COMMIT')

    req.auditContext = {
      action: 'PURCHASE_ORDER_CREATE',
      entityType: 'PURCHASE_ORDER',
      entityId: String(poId),
      description: `Created purchase order ${po_no}`,
    }

    return res.status(201).json({ id: poId })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505') {
      return res.status(409).json({ message: 'PO number already exists for this tenant.' })
    }
    return res.status(500).json({ message: 'Failed to create purchase order.', error: error.message })
  } finally {
    client.release()
  }
})

/**
 * 更新：事务 UPDATE header + DELETE/INSERT items
 */
router.put('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplier_id, po_no, po_date, notes, items = [] } = req.body || {}
  if (!supplier_id || !po_no || !po_date) {
    return res.status(400).json({ message: 'supplier_id, po_no, po_date are required.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query(
      `SELECT id FROM purchase_orders WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Purchase order not found.' })
    }

    const supplierCheck = await client.query(
      `SELECT id FROM suppliers WHERE id = $1 AND tenant_id = $2`,
      [supplier_id, tenantId],
    )
    if (!supplierCheck.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Invalid supplier.' })
    }

    await client.query(
      `UPDATE purchase_orders
       SET supplier_id = $1, po_no = $2, po_date = $3, notes = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND tenant_id = $6`,
      [supplier_id, po_no, po_date, notes || null, req.params.id, tenantId],
    )

    await client.query('DELETE FROM purchase_order_items WHERE po_id = $1', [req.params.id])
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i]
      await client.query(
        `INSERT INTO purchase_order_items (po_id, product_id, item_code, description, serial_no, quantity, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          req.params.id,
          it.product_id || null,
          it.item_code || null,
          it.description || null,
          it.serial_no || null,
          Number(it.quantity) || 0,
          i,
        ],
      )
    }

    await client.query('COMMIT')

    req.auditContext = {
      action: 'PURCHASE_ORDER_UPDATE',
      entityType: 'PURCHASE_ORDER',
      entityId: String(req.params.id),
      description: `Updated purchase order ${po_no}`,
    }

    return res.json({ id: Number(req.params.id) })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505') {
      return res.status(409).json({ message: 'PO number already exists for this tenant.' })
    }
    return res.status(500).json({ message: 'Failed to update purchase order.', error: error.message })
  } finally {
    client.release()
  }
})

/**
 * 删除（CASCADE 清理 items/attachments）
 */
router.delete('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const attachments = await query(
      `SELECT storage_path FROM purchase_order_attachments
       WHERE po_id = $1 AND po_id IN (SELECT id FROM purchase_orders WHERE tenant_id = $2)`,
      [req.params.id, tenantId],
    )
    const result = await query(
      `DELETE FROM purchase_orders WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, tenantId],
    )
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Purchase order not found.' })
    }
    attachments.rows.forEach((row) => removeFileQuiet(buildAttachmentPath(SUB_DIR, row.storage_path)))

    req.auditContext = {
      action: 'PURCHASE_ORDER_DELETE',
      entityType: 'PURCHASE_ORDER',
      entityId: String(req.params.id),
      description: `Deleted purchase order ${req.params.id}`,
    }

    return res.status(204).send()
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ message: 'Cannot delete: related invoices exist.' })
    }
    return res.status(500).json({ message: 'Failed to delete purchase order.', error: error.message })
  }
})

/**
 * 附件上传
 */
router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  const tenantId = getTenantId(req)
  if (!req.file) {
    return res.status(400).json({ message: 'File is required.' })
  }
  try {
    const parent = await query(
      `SELECT id FROM purchase_orders WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!parent.rows[0]) {
      removeFileQuiet(req.file.path)
      return res.status(404).json({ message: 'Purchase order not found.' })
    }
    const result = await query(
      `INSERT INTO purchase_order_attachments (po_id, original_name, storage_path, mime_type, file_size, uploaded_by)
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

/**
 * 附件下载
 */
router.get('/:id/attachments/:attId/download', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const result = await query(
      `SELECT a.original_name, a.storage_path, a.mime_type
       FROM purchase_order_attachments a
       INNER JOIN purchase_orders po ON po.id = a.po_id
       WHERE a.id = $1 AND po.id = $2 AND po.tenant_id = $3`,
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

/**
 * 附件删除
 */
router.delete('/:id/attachments/:attId', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const result = await query(
      `DELETE FROM purchase_order_attachments a
       USING purchase_orders po
       WHERE a.id = $1 AND a.po_id = po.id AND po.id = $2 AND po.tenant_id = $3
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
