/**
 * Supplier 单据附件共享工具
 *
 * 将 PO / Invoice / Returns 附件的 multer + 下载 + 删除逻辑抽象化。
 * 约定：
 *   - 上传目录：/app/uploads/<subDir>（Docker 卷 uploads_data 挂载在 /app/uploads）
 *   - 每个附件表包含：original_name / storage_path / mime_type / file_size / uploaded_by
 *   - 父表包含 tenant_id，用于隔离校验
 */

const fs = require('fs')
const path = require('path')
const multer = require('multer')

const BASE_UPLOAD_ROOT = path.resolve(__dirname, '../../uploads')

function resolveUploadDir(subDir) {
  const dir = path.join(BASE_UPLOAD_ROOT, subDir)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function pickExt(originalname, mimetype) {
  const ext = path.extname(originalname || '').toLowerCase()
  if (ext) return ext
  if (mimetype === 'application/pdf') return '.pdf'
  if (mimetype === 'image/jpeg') return '.jpg'
  if (mimetype === 'image/png') return '.png'
  if (mimetype === 'image/webp') return '.webp'
  return ''
}

function createUploader({ subDir }) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, resolveUploadDir(subDir))
    },
    filename: (req, file, cb) => {
      const ext = pickExt(file.originalname, file.mimetype)
      const parentId = req.params.id || 'unknown'
      const filename = `p${parentId}_u${req.user.id}_${Date.now()}${ext}`
      cb(null, filename)
    },
  })

  const allowedMimeTypes = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ])

  function fileFilter(_req, file, cb) {
    if (allowedMimeTypes.has(file.mimetype)) {
      cb(null, true)
      return
    }
    cb(new Error('Unsupported file type. Please upload PDF, JPG, PNG or WebP.'), false)
  }

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 25 * 1024 * 1024 },
  })
}

function buildAttachmentPath(subDir, storagePath) {
  return path.join(BASE_UPLOAD_ROOT, subDir, storagePath)
}

function removeFileQuiet(fullPath) {
  if (fullPath && fs.existsSync(fullPath)) {
    fs.unlink(fullPath, () => {})
  }
}

module.exports = {
  createUploader,
  buildAttachmentPath,
  removeFileQuiet,
  BASE_UPLOAD_ROOT,
}
