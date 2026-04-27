const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const { query } = require('../config/db')
const { authenticateToken } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')

const router = express.Router()

router.use(authenticateToken)

const UPLOAD_DIR = path.join(__dirname, '../../uploads/bank-statements')

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

function normalizeMonth(value) {
  const raw = String(value || '').trim()
  if (!/^\d{4}-\d{2}$/.test(raw)) return null
  const [year, month] = raw.split('-').map((x) => Number(x))
  if (!year || month < 1 || month > 12) return null
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toISOString().slice(0, 10)
}

function pickExt(originalname, mimetype) {
  const ext = path.extname(originalname || '').toLowerCase()
  if (ext) return ext
  if (mimetype === 'application/pdf') return '.pdf'
  if (mimetype === 'image/jpeg') return '.jpg'
  if (mimetype === 'image/png') return '.png'
  if (mimetype === 'image/webp') return '.webp'
  if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return '.xlsx'
  if (mimetype === 'application/vnd.ms-excel') return '.xls'
  return ''
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir()
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    const month = normalizeMonth(req.body.month)
    const ext = pickExt(file.originalname, file.mimetype)
    const safeMonth = month ? month.slice(0, 7) : 'unknown'
    const filename = `u${req.user.id}_${safeMonth}_${Date.now()}${ext}`
    cb(null, filename)
  },
})

function fileFilter(_req, file, cb) {
  const allowedMimeTypes = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ])

  if (allowedMimeTypes.has(file.mimetype)) {
    cb(null, true)
    return
  }

  cb(new Error('Unsupported file type. Please upload PDF, image, or Excel.'), false)
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
})

router.get('/', async (req, res) => {
  const { page, pageSize, offset } = getPaginationParams(req.query)

  try {
    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT id, statement_month, original_name, mime_type, file_size, created_at
          FROM bank_statements
          WHERE uploaded_by = $1
          ORDER BY statement_month DESC, created_at DESC
          LIMIT $2 OFFSET $3
        `,
        [req.user.id, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM bank_statements
          WHERE uploaded_by = $1
        `,
        [req.user.id],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch bank statements.', error: error.message })
  }
})

router.post('/', upload.single('file'), async (req, res) => {
  const month = normalizeMonth(req.body.month)
  if (!month) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {})
    }
    return res.status(400).json({ message: 'Invalid month. Expected YYYY-MM.' })
  }

  if (!req.file) {
    return res.status(400).json({ message: 'File is required.' })
  }

  try {
    const result = await query(
      `
        INSERT INTO bank_statements (
          uploaded_by,
          statement_month,
          original_name,
          storage_path,
          mime_type,
          file_size
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (uploaded_by, statement_month)
        DO UPDATE SET
          original_name = EXCLUDED.original_name,
          storage_path = EXCLUDED.storage_path,
          mime_type = EXCLUDED.mime_type,
          file_size = EXCLUDED.file_size,
          created_at = CURRENT_TIMESTAMP
        RETURNING id, statement_month, original_name, mime_type, file_size, created_at
      `,
      [req.user.id, month, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size],
    )

    req.auditContext = {
      action: 'BANK_STATEMENT_UPLOAD',
      entityType: 'BANK_STATEMENT',
      entityId: String(result.rows[0].id),
      description: `Uploaded bank statement ${result.rows[0].id}`,
    }

    return res.status(201).json(result.rows[0])
  } catch (error) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {})
    }
    return res.status(500).json({ message: 'Failed to upload bank statement.', error: error.message })
  }
})

router.get('/:id/download', async (req, res) => {
  try {
    const result = await query(
      `
        SELECT id, uploaded_by, original_name, storage_path, mime_type
        FROM bank_statements
        WHERE id = $1
      `,
      [req.params.id],
    )

    const row = result.rows[0]
    if (!row) {
      return res.status(404).json({ message: 'Bank statement not found.' })
    }

    if (Number(row.uploaded_by) !== Number(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Permission denied.' })
    }

    const filePath = path.join(UPLOAD_DIR, row.storage_path)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found.' })
    }

    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream')
    return res.download(filePath, row.original_name)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to download bank statement.', error: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const existing = await query(
      `
        SELECT id, uploaded_by, storage_path
        FROM bank_statements
        WHERE id = $1
      `,
      [req.params.id],
    )

    const row = existing.rows[0]
    if (!row) {
      return res.status(404).json({ message: 'Bank statement not found.' })
    }

    if (Number(row.uploaded_by) !== Number(req.user.id) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Permission denied.' })
    }

    await query('DELETE FROM bank_statements WHERE id = $1', [req.params.id])

    const filePath = path.join(UPLOAD_DIR, row.storage_path)
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {})
    }

    req.auditContext = {
      action: 'BANK_STATEMENT_DELETE',
      entityType: 'BANK_STATEMENT',
      entityId: String(req.params.id),
      description: `Deleted bank statement ${req.params.id}`,
    }

    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete bank statement.', error: error.message })
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
