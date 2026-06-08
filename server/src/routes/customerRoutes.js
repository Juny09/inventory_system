const express = require('express')
const { query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const { createUploader, buildAttachmentPath, removeFileQuiet } = require('./_supplierDocAttachment')

const router = express.Router()
const SUB_DIR = 'customers'
const upload = createUploader({ subDir: SUB_DIR })

router.use(authenticateToken)

function getSearchPattern(search) {
  return `%${String(search || '').trim()}%`
}

function normalizeSort(sortBy) {
  const allowed = new Set(['name', 'created_at', 'updated_at'])
  return allowed.has(sortBy) ? sortBy : 'updated_at'
}

function normalizeSortOrder(sortOrder) {
  return String(sortOrder || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
}

router.get('/', async (req, res) => {
  const { search = '', status = 'all', sortBy = 'updated_at', sortOrder = 'desc' } = req.query
  const searchPattern = getSearchPattern(search)
  const resolvedSortBy = normalizeSort(sortBy)
  const resolvedSortOrder = normalizeSortOrder(sortOrder)
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const tenantId = req.tenantId

  try {
    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            c.*,
            COUNT(b.id)::int AS bill_count
          FROM customers c
          LEFT JOIN customer_bills b
            ON b.customer_id = c.id
            AND b.tenant_id = c.tenant_id
          WHERE c.tenant_id = $6
            AND (
              $1 = '%%'
              OR c.name ILIKE $1
              OR c.company_name ILIKE $1
              OR c.contact_name ILIKE $1
              OR c.phone ILIKE $1
              OR c.email ILIKE $1
            )
            AND (
              $2 = 'all'
              OR ($2 = 'active' AND c.is_active = TRUE)
              OR ($2 = 'inactive' AND c.is_active = FALSE)
            )
          GROUP BY c.id
          ORDER BY
            CASE WHEN $3 = 'name' THEN COALESCE(c.company_name, c.name) END ${resolvedSortOrder},
            CASE WHEN $3 = 'created_at' THEN c.created_at END ${resolvedSortOrder},
            CASE WHEN $3 = 'updated_at' THEN c.updated_at END ${resolvedSortOrder},
            c.id DESC
          LIMIT $4 OFFSET $5
        `,
        [searchPattern, status, resolvedSortBy, pageSize, offset, tenantId],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM customers c
          WHERE c.tenant_id = $3
            AND (
              $1 = '%%'
              OR c.name ILIKE $1
              OR c.company_name ILIKE $1
              OR c.contact_name ILIKE $1
              OR c.phone ILIKE $1
              OR c.email ILIKE $1
            )
            AND (
              $2 = 'all'
              OR ($2 = 'active' AND c.is_active = TRUE)
              OR ($2 = 'inactive' AND c.is_active = FALSE)
            )
        `,
        [searchPattern, status, tenantId],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch customers.', error: error.message })
  }
})

router.post('/', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = req.tenantId
  const userId = req.user?.id || null
  const { name, companyName, contactName, phone, email, address, notes, isActive } = req.body

  if (!name) {
    return res.status(400).json({ message: 'Customer name is required.' })
  }

  try {
    const created = await query(
      `
        INSERT INTO customers (
          tenant_id,
          name,
          company_name,
          contact_name,
          phone,
          email,
          address,
          notes,
          is_active,
          created_by,
          updated_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
        RETURNING *
      `,
      [
        tenantId,
        name,
        companyName || null,
        contactName || null,
        phone || null,
        email || null,
        address || null,
        notes || null,
        isActive !== false,
        userId,
      ],
    )

    return res.status(201).json({ data: created.rows[0] })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create customer.', error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  const tenantId = req.tenantId
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid id.' })

  try {
    const [customer, attachments] = await Promise.all([
      query(`SELECT * FROM customers WHERE tenant_id = $1 AND id = $2`, [tenantId, id]),
      query(
        `
          SELECT id, original_name, storage_path, mime_type, file_size, created_at
          FROM customer_attachments
          WHERE tenant_id = $1 AND customer_id = $2
          ORDER BY created_at DESC, id DESC
        `,
        [tenantId, id],
      ),
    ])

    if (!customer.rows.length) return res.status(404).json({ message: 'Customer not found.' })

    return res.json({
      data: customer.rows[0],
      attachments: attachments.rows.map((row) => ({
        id: row.id,
        originalName: row.original_name,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        createdAt: row.created_at,
        url: `/uploads/${SUB_DIR}/${row.storage_path}`,
      })),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch customer.', error: error.message })
  }
})

router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = req.tenantId
  const userId = req.user?.id || null
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid id.' })

  const { name, companyName, contactName, phone, email, address, notes, isActive } = req.body
  if (!name) {
    return res.status(400).json({ message: 'Customer name is required.' })
  }

  try {
    const updated = await query(
      `
        UPDATE customers
        SET
          name = $3,
          company_name = $4,
          contact_name = $5,
          phone = $6,
          email = $7,
          address = $8,
          notes = $9,
          is_active = $10,
          updated_by = $11,
          updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1 AND id = $2
        RETURNING *
      `,
      [
        tenantId,
        id,
        name,
        companyName || null,
        contactName || null,
        phone || null,
        email || null,
        address || null,
        notes || null,
        isActive !== false,
        userId,
      ],
    )

    if (!updated.rows.length) return res.status(404).json({ message: 'Customer not found.' })
    return res.json({ data: updated.rows[0] })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update customer.', error: error.message })
  }
})

router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const tenantId = req.tenantId
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid id.' })

  try {
    const deleted = await query(`DELETE FROM customers WHERE tenant_id = $1 AND id = $2 RETURNING id`, [tenantId, id])
    if (!deleted.rows.length) return res.status(404).json({ message: 'Customer not found.' })
    return res.json({ success: true })
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ message: 'Customer has bills and cannot be deleted.' })
    }
    return res.status(500).json({ message: 'Failed to delete customer.', error: error.message })
  }
})

router.post('/:id/attachments', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), upload.single('file'), async (req, res) => {
  const tenantId = req.tenantId
  const customerId = Number(req.params.id)
  if (!Number.isInteger(customerId)) return res.status(400).json({ message: 'Invalid id.' })

  const file = req.file
  if (!file) return res.status(400).json({ message: 'No file uploaded.' })

  try {
    const exists = await query(`SELECT id FROM customers WHERE tenant_id = $1 AND id = $2`, [tenantId, customerId])
    if (!exists.rows.length) {
      removeFileQuiet(file.path)
      return res.status(404).json({ message: 'Customer not found.' })
    }

    const uploaded = await query(
      `
        INSERT INTO customer_attachments (
          tenant_id,
          customer_id,
          original_name,
          storage_path,
          mime_type,
          file_size,
          uploaded_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING id, original_name, storage_path, mime_type, file_size, created_at
      `,
      [tenantId, customerId, file.originalname, file.filename, file.mimetype, file.size, req.user?.id || null],
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
    const customerId = Number(req.params.id)
    const attachmentId = Number(req.params.attachmentId)
    if (!Number.isInteger(customerId) || !Number.isInteger(attachmentId)) {
      return res.status(400).json({ message: 'Invalid id.' })
    }

    try {
      const existing = await query(
        `
          DELETE FROM customer_attachments
          WHERE tenant_id = $1 AND customer_id = $2 AND id = $3
          RETURNING storage_path
        `,
        [tenantId, customerId, attachmentId],
      )
      if (!existing.rows.length) return res.status(404).json({ message: 'Attachment not found.' })

      const fullPath = buildAttachmentPath(SUB_DIR, existing.rows[0].storage_path)
      removeFileQuiet(fullPath)
      return res.json({ success: true })
    } catch (error) {
      return res.status(500).json({ message: 'Failed to delete attachment.', error: error.message })
    }
  },
)

module.exports = router

