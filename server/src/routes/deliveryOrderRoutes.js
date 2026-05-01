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
const SUB_DIR = 'delivery-orders'
const upload = createUploader({ subDir: SUB_DIR })

router.use(authenticateToken)

/**
 * 列表：支持 ?supplierId=&search=&page=&pageSize=&year=&month=
 * 响应 { items: [...], pagination }
 */
router.get('/', async (req, res) => {
  const tenantId = getTenantId(req)
  const { page, pageSize, offset } = getPaginationParams(req.query)

  const filters = ['d.tenant_id = $1']
  const params = [tenantId]
  let idx = 2

  if (req.query.supplierId) {
    filters.push(`d.supplier_id = $${idx++}`)
    params.push(Number(req.query.supplierId))
  }
  if (req.query.search) {
    filters.push(`(d.do_no ILIKE $${idx} OR s.company_name ILIKE $${idx} OR s.name ILIKE $${idx})`)
    params.push(`%${req.query.search}%`)
    idx++
  }
  if (req.query.year) {
    filters.push(`EXTRACT(YEAR FROM d.do_date) = $${idx++}`)
    params.push(Number(req.query.year))
  }
  if (req.query.month) {
    filters.push(`EXTRACT(MONTH FROM d.do_date) = $${idx++}`)
    params.push(Number(req.query.month))
  }

  const whereClause = filters.join(' AND ')

  try {
    const [list, total] = await Promise.all([
      query(
        `
          SELECT d.id, d.do_no, d.do_date, d.notes, d.created_at, d.updated_at,
                 d.supplier_id, d.warehouse_id, d.posted_to_inventory,
                 COALESCE(s.company_name, s.name) AS supplier_name,
                 w.name AS warehouse_name,
                 (SELECT COUNT(*)::int FROM delivery_order_items WHERE do_id = d.id) AS item_count,
                 (SELECT COUNT(*)::int FROM delivery_order_attachments WHERE do_id = d.id) AS attachment_count
          FROM delivery_orders d
          LEFT JOIN suppliers s ON s.id = d.supplier_id
          LEFT JOIN warehouses w ON w.id = d.warehouse_id
          WHERE ${whereClause}
          ORDER BY d.do_date DESC, d.id DESC
          LIMIT $${idx} OFFSET $${idx + 1}
        `,
        [...params, pageSize, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS total FROM delivery_orders d
         LEFT JOIN suppliers s ON s.id = d.supplier_id
         WHERE ${whereClause}`,
        params,
      ),
    ])

    return res.json({
      items: list.rows,
      pagination: buildPagination(total.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list delivery orders.', error: error.message })
  }
})

/**
 * 详情：含 items + attachments
 */
router.get('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const header = await query(
      `SELECT d.id, d.do_no, d.do_date, d.notes, d.supplier_id, d.warehouse_id, d.posted_to_inventory,
              d.created_at, d.updated_at,
              COALESCE(s.company_name, s.name) AS supplier_name,
              w.name AS warehouse_name
       FROM delivery_orders d
       LEFT JOIN suppliers s ON s.id = d.supplier_id
       LEFT JOIN warehouses w ON w.id = d.warehouse_id
       WHERE d.id = $1 AND d.tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!header.rows[0]) {
      return res.status(404).json({ message: 'Delivery order not found.' })
    }

    const [items, attachments] = await Promise.all([
      query(
        `SELECT i.id, i.product_id, i.item_code, i.description, i.serial_no, i.quantity, i.sort_order,
                p.name AS product_name, p.product_code AS product_product_code
         FROM delivery_order_items i
         LEFT JOIN products p ON p.id = i.product_id
         WHERE i.do_id = $1
         ORDER BY i.sort_order ASC, i.id ASC`,
        [req.params.id],
      ),
      query(
        `SELECT id, original_name, mime_type, file_size, uploaded_by, created_at
         FROM delivery_order_attachments
         WHERE do_id = $1
         ORDER BY created_at DESC`,
        [req.params.id],
      ),
    ])

    return res.json({ ...header.rows[0], items: items.rows, attachments: attachments.rows })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load delivery order.', error: error.message })
  }
})

/**
 * 创建：事务 INSERT header + items
 */
router.post('/', async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplier_id, do_no, do_date, notes, warehouse_id, items = [] } = req.body || {}

  if (!supplier_id || !do_no || !do_date) {
    return res.status(400).json({ message: 'supplier_id, do_no, do_date are required.' })
  }

  const normalizedWarehouseId = warehouse_id ? Number(warehouse_id) : null
  const willPostStock = Boolean(normalizedWarehouseId)

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
      `INSERT INTO delivery_orders (tenant_id, supplier_id, do_no, do_date, notes, warehouse_id, posted_to_inventory, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [tenantId, supplier_id, do_no, do_date, notes || null, normalizedWarehouseId, willPostStock, req.user.id],
    )
    const doId = header.rows[0].id

    for (let i = 0; i < items.length; i += 1) {
      const it = items[i]
      await client.query(
        `INSERT INTO delivery_order_items (do_id, product_id, item_code, description, serial_no, quantity, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          doId,
          it.product_id || null,
          it.item_code || null,
          it.description || null,
          it.serial_no || null,
          Number(it.quantity) || 0,
          i,
        ],
      )
    }

    // 入库：有 warehouse 时自动将明细写入 stock_levels
    if (willPostStock) {
      await postItemsToStock(client, {
        tenantId,
        warehouseId: normalizedWarehouseId,
        items,
        direction: 1,
        referenceNo: `DO-${do_no}`,
        notes: `Delivery Order ${do_no}`,
        supplierId: Number(supplier_id),
        userId: req.user.id,
      })
    }

    await client.query('COMMIT')

    req.auditContext = {
      action: 'DELIVERY_ORDER_CREATE',
      entityType: 'DELIVERY_ORDER',
      entityId: String(doId),
      description: `Created delivery order ${do_no}${willPostStock ? ' (stock posted)' : ''}`,
    }

    return res.status(201).json({ id: doId })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505') {
      return res.status(409).json({ message: 'DO number already exists for this tenant.' })
    }
    return res.status(500).json({ message: 'Failed to create delivery order.', error: error.message })
  } finally {
    client.release()
  }
})

/**
 * 更新：事务 UPDATE header + DELETE/INSERT items
 */
router.put('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplier_id, do_no, do_date, notes, warehouse_id, items = [] } = req.body || {}
  if (!supplier_id || !do_no || !do_date) {
    return res.status(400).json({ message: 'supplier_id, do_no, do_date are required.' })
  }

  const newWarehouseId = warehouse_id ? Number(warehouse_id) : null
  const willPostStock = Boolean(newWarehouseId)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query(
      `SELECT id, warehouse_id, posted_to_inventory FROM delivery_orders
       WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Delivery order not found.' })
    }
    const wasPosted = Boolean(existing.rows[0].posted_to_inventory)
    const oldWarehouseId = existing.rows[0].warehouse_id ? Number(existing.rows[0].warehouse_id) : null

    const supplierCheck = await client.query(
      `SELECT id FROM suppliers WHERE id = $1 AND tenant_id = $2`,
      [supplier_id, tenantId],
    )
    if (!supplierCheck.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(400).json({ message: 'Invalid supplier.' })
    }

    // 1) 如果原先已入库，先按旧明细反扣
    if (wasPosted && oldWarehouseId) {
      const oldItems = await client.query(
        `SELECT product_id, quantity FROM delivery_order_items WHERE do_id = $1`,
        [req.params.id],
      )
      await postItemsToStock(client, {
        tenantId,
        warehouseId: oldWarehouseId,
        items: oldItems.rows,
        direction: -1,
        referenceNo: `DO-${do_no}-REVERT`,
        notes: `Revert delivery order ${do_no} before update`,
        supplierId: Number(supplier_id),
        userId: req.user.id,
      })
    }

    // 2) 更新表头 + 重建 items
    await client.query(
      `UPDATE delivery_orders
       SET supplier_id = $1, do_no = $2, do_date = $3, notes = $4,
           warehouse_id = $5, posted_to_inventory = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND tenant_id = $8`,
      [supplier_id, do_no, do_date, notes || null, newWarehouseId, willPostStock, req.params.id, tenantId],
    )

    await client.query('DELETE FROM delivery_order_items WHERE do_id = $1', [req.params.id])
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i]
      await client.query(
        `INSERT INTO delivery_order_items (do_id, product_id, item_code, description, serial_no, quantity, sort_order)
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

    // 3) 如果新设置仍需入库，按新明细入库
    if (willPostStock) {
      await postItemsToStock(client, {
        tenantId,
        warehouseId: newWarehouseId,
        items,
        direction: 1,
        referenceNo: `DO-${do_no}`,
        notes: `Delivery Order ${do_no} (updated)`,
        supplierId: Number(supplier_id),
        userId: req.user.id,
      })
    }

    await client.query('COMMIT')

    req.auditContext = {
      action: 'DELIVERY_ORDER_UPDATE',
      entityType: 'DELIVERY_ORDER',
      entityId: String(req.params.id),
      description: `Updated delivery order ${do_no}`,
    }

    return res.json({ id: Number(req.params.id) })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505') {
      return res.status(409).json({ message: 'DO number already exists for this tenant.' })
    }
    return res.status(500).json({ message: 'Failed to update delivery order.', error: error.message })
  } finally {
    client.release()
  }
})

/**
 * 删除（CASCADE 清理 items/attachments）
 */
router.delete('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query(
      `SELECT id, do_no, supplier_id, warehouse_id, posted_to_inventory
       FROM delivery_orders WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Delivery order not found.' })
    }
    const row = existing.rows[0]

    // 反扣库存
    if (row.posted_to_inventory && row.warehouse_id) {
      const oldItems = await client.query(
        `SELECT product_id, quantity FROM delivery_order_items WHERE do_id = $1`,
        [req.params.id],
      )
      await postItemsToStock(client, {
        tenantId,
        warehouseId: Number(row.warehouse_id),
        items: oldItems.rows,
        direction: -1,
        referenceNo: `DO-${row.do_no}-DELETE`,
        notes: `Revert delivery order ${row.do_no} on delete`,
        supplierId: Number(row.supplier_id),
        userId: req.user.id,
      })
    }

    const attachments = await client.query(
      `SELECT storage_path FROM delivery_order_attachments WHERE do_id = $1`,
      [req.params.id],
    )

    await client.query(
      `DELETE FROM delivery_orders WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    )

    await client.query('COMMIT')

    attachments.rows.forEach((r) => removeFileQuiet(buildAttachmentPath(SUB_DIR, r.storage_path)))

    req.auditContext = {
      action: 'DELIVERY_ORDER_DELETE',
      entityType: 'DELIVERY_ORDER',
      entityId: String(req.params.id),
      description: `Deleted delivery order ${req.params.id}`,
    }

    return res.status(204).send()
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23503') {
      return res.status(409).json({ message: 'Cannot delete: related invoices exist.' })
    }
    return res.status(500).json({ message: 'Failed to delete delivery order.', error: error.message })
  } finally {
    client.release()
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
      `SELECT id FROM delivery_orders WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!parent.rows[0]) {
      removeFileQuiet(req.file.path)
      return res.status(404).json({ message: 'Delivery order not found.' })
    }
    const result = await query(
      `INSERT INTO delivery_order_attachments (do_id, original_name, storage_path, mime_type, file_size, uploaded_by)
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
       FROM delivery_order_attachments a
       INNER JOIN delivery_orders d ON d.id = a.do_id
       WHERE a.id = $1 AND d.id = $2 AND d.tenant_id = $3`,
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
      `DELETE FROM delivery_order_attachments a
       USING delivery_orders d
       WHERE a.id = $1 AND a.do_id = d.id AND d.id = $2 AND d.tenant_id = $3
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
