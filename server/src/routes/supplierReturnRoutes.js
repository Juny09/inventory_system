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
const SUB_DIR = 'supplier-returns'
const upload = createUploader({ subDir: SUB_DIR })

const DOC_TYPES = new Set(['RETURN', 'CLAIM', 'REPAIR'])

router.use(authenticateToken)

router.get('/', async (req, res) => {
  const tenantId = getTenantId(req)
  const { page, pageSize, offset } = getPaginationParams(req.query)

  const filters = ['r.tenant_id = $1']
  const params = [tenantId]
  let idx = 2

  if (req.query.supplierId) {
    filters.push(`r.supplier_id = $${idx++}`)
    params.push(Number(req.query.supplierId))
  }
  if (req.query.docType && DOC_TYPES.has(String(req.query.docType).toUpperCase())) {
    filters.push(`r.doc_type = $${idx++}`)
    params.push(String(req.query.docType).toUpperCase())
  }
  if (req.query.search) {
    filters.push(`(r.document_no ILIKE $${idx} OR s.company_name ILIKE $${idx} OR s.name ILIKE $${idx})`)
    params.push(`%${req.query.search}%`)
    idx++
  }

  const whereClause = filters.join(' AND ')

  try {
    const [list, total] = await Promise.all([
      query(
        `
          SELECT r.id, r.doc_type, r.document_no, r.document_date, r.notes,
                 r.supplier_id,
                 COALESCE(s.company_name, s.name) AS supplier_name,
                 r.created_at, r.updated_at,
                 (SELECT COUNT(*)::int FROM supplier_return_items WHERE return_id = r.id) AS item_count,
                 (SELECT COUNT(*)::int FROM supplier_return_attachments WHERE return_id = r.id) AS attachment_count
          FROM supplier_returns r
          LEFT JOIN suppliers s ON s.id = r.supplier_id
          WHERE ${whereClause}
          ORDER BY r.document_date DESC, r.id DESC
          LIMIT $${idx} OFFSET $${idx + 1}
        `,
        [...params, pageSize, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS total FROM supplier_returns r
         LEFT JOIN suppliers s ON s.id = r.supplier_id
         WHERE ${whereClause}`,
        params,
      ),
    ])

    return res.json({
      items: list.rows,
      pagination: buildPagination(total.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list returns.', error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const header = await query(
      `SELECT r.id, r.doc_type, r.document_no, r.document_date, r.notes,
              r.supplier_id,
              COALESCE(s.company_name, s.name) AS supplier_name,
              r.created_at, r.updated_at
       FROM supplier_returns r
       LEFT JOIN suppliers s ON s.id = r.supplier_id
       WHERE r.id = $1 AND r.tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!header.rows[0]) {
      return res.status(404).json({ message: 'Return document not found.' })
    }

    const [items, attachments] = await Promise.all([
      query(
        `SELECT i.id, i.product_id, i.item_code, i.description, i.serial_no, i.quantity, i.sort_order,
                p.name AS product_name, p.product_code AS product_product_code
         FROM supplier_return_items i
         LEFT JOIN products p ON p.id = i.product_id
         WHERE i.return_id = $1
         ORDER BY i.sort_order ASC, i.id ASC`,
        [req.params.id],
      ),
      query(
        `SELECT id, original_name, mime_type, file_size, uploaded_by, created_at
         FROM supplier_return_attachments
         WHERE return_id = $1
         ORDER BY created_at DESC`,
        [req.params.id],
      ),
    ])

    return res.json({ ...header.rows[0], items: items.rows, attachments: attachments.rows })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load return.', error: error.message })
  }
})

router.post('/', async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplier_id, doc_type, document_no, document_date, notes, items = [] } = req.body || {}

  if (!supplier_id || !doc_type || !document_no || !document_date) {
    return res.status(400).json({ message: 'supplier_id, doc_type, document_no, document_date are required.' })
  }
  const docType = String(doc_type).toUpperCase()
  if (!DOC_TYPES.has(docType)) {
    return res.status(400).json({ message: 'doc_type must be RETURN, CLAIM or REPAIR.' })
  }

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

    const header = await client.query(
      `INSERT INTO supplier_returns (tenant_id, supplier_id, doc_type, document_no, document_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [tenantId, supplier_id, docType, document_no, document_date, notes || null, req.user.id],
    )
    const retId = header.rows[0].id

    for (let i = 0; i < items.length; i += 1) {
      const it = items[i]
      await client.query(
        `INSERT INTO supplier_return_items (return_id, product_id, item_code, description, serial_no, quantity, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          retId,
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
      action: 'SUPPLIER_RETURN_CREATE',
      entityType: 'SUPPLIER_RETURN',
      entityId: String(retId),
      description: `Created ${docType} document ${document_no}`,
    }

    return res.status(201).json({ id: retId })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Document number already exists for this tenant.' })
    }
    return res.status(500).json({ message: 'Failed to create return.', error: error.message })
  } finally {
    client.release()
  }
})

router.put('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  const { supplier_id, doc_type, document_no, document_date, notes, items = [] } = req.body || {}
  if (!supplier_id || !doc_type || !document_no || !document_date) {
    return res.status(400).json({ message: 'supplier_id, doc_type, document_no, document_date are required.' })
  }
  const docType = String(doc_type).toUpperCase()
  if (!DOC_TYPES.has(docType)) {
    return res.status(400).json({ message: 'doc_type must be RETURN, CLAIM or REPAIR.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query(
      `SELECT id FROM supplier_returns WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Return document not found.' })
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
      `UPDATE supplier_returns
       SET supplier_id = $1, doc_type = $2, document_no = $3, document_date = $4,
           notes = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND tenant_id = $7`,
      [supplier_id, docType, document_no, document_date, notes || null, req.params.id, tenantId],
    )

    await client.query('DELETE FROM supplier_return_items WHERE return_id = $1', [req.params.id])
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i]
      await client.query(
        `INSERT INTO supplier_return_items (return_id, product_id, item_code, description, serial_no, quantity, sort_order)
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
      action: 'SUPPLIER_RETURN_UPDATE',
      entityType: 'SUPPLIER_RETURN',
      entityId: String(req.params.id),
      description: `Updated ${docType} document ${document_no}`,
    }

    return res.json({ id: Number(req.params.id) })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Document number already exists for this tenant.' })
    }
    return res.status(500).json({ message: 'Failed to update return.', error: error.message })
  } finally {
    client.release()
  }
})

router.delete('/:id', async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const attachments = await query(
      `SELECT storage_path FROM supplier_return_attachments
       WHERE return_id = $1 AND return_id IN (SELECT id FROM supplier_returns WHERE tenant_id = $2)`,
      [req.params.id, tenantId],
    )
    const result = await query(
      `DELETE FROM supplier_returns WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, tenantId],
    )
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Return document not found.' })
    }
    attachments.rows.forEach((row) => removeFileQuiet(buildAttachmentPath(SUB_DIR, row.storage_path)))

    req.auditContext = {
      action: 'SUPPLIER_RETURN_DELETE',
      entityType: 'SUPPLIER_RETURN',
      entityId: String(req.params.id),
      description: `Deleted return document ${req.params.id}`,
    }

    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete return.', error: error.message })
  }
})

router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  const tenantId = getTenantId(req)
  if (!req.file) {
    return res.status(400).json({ message: 'File is required.' })
  }
  try {
    const parent = await query(
      `SELECT id FROM supplier_returns WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    )
    if (!parent.rows[0]) {
      removeFileQuiet(req.file.path)
      return res.status(404).json({ message: 'Return document not found.' })
    }
    const result = await query(
      `INSERT INTO supplier_return_attachments (return_id, original_name, storage_path, mime_type, file_size, uploaded_by)
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
       FROM supplier_return_attachments a
       INNER JOIN supplier_returns r ON r.id = a.return_id
       WHERE a.id = $1 AND r.id = $2 AND r.tenant_id = $3`,
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
      `DELETE FROM supplier_return_attachments a
       USING supplier_returns r
       WHERE a.id = $1 AND a.return_id = r.id AND r.id = $2 AND r.tenant_id = $3
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
