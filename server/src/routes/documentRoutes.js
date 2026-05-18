const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { pool, query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getTenantId } = require('../utils/tenant')
const { extractDocumentText, extractWithOllama, getOllamaModels, getDefaultPrompt } = require('../utils/documentParser')
const { parseDocument } = require('../utils/documentExtractor')

const router = express.Router()
router.use(authenticateToken)

const uploadDir = path.join(__dirname, '../../uploads/documents')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`
    cb(null, unique)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) return cb(null, true)
    cb(new Error('Only PDF, JPG, PNG, WebP are allowed.'))
  },
})

/**
 * GET /api/ollama/models
 * 返回本地已安装的 Ollama 模型列表 + 默认 prompt
 */
router.get('/ollama/models', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (_req, res) => {
  try {
    const models = await getOllamaModels()
    return res.json({ models, defaultPrompt: getDefaultPrompt() })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch Ollama models.', error: error.message })
  }
})

/**
 * POST /api/documents/parse
 * 上传文件 → OCR/提取文本 → 解析字段 → 匹配供应商和产品 → 返回预览
 */
router.post('/parse', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File is required.' })
  }

  const tenantId = getTenantId(req)
  const filePath = req.file.path

  // 从前端 form-data 中读取模型和自定义 prompt
  const selectedModel = req.body?.model || ''
  let finalPrompt = req.body?.customPrompt || ''

  // 如果前端没传 prompt，尝试从数据库获取默认 prompt
  if (!finalPrompt) {
    try {
      const dbPrompt = await query(
        `SELECT content FROM document_prompts
         WHERE tenant_id = $1 AND is_default = TRUE
         LIMIT 1`,
        [tenantId],
      )
      if (dbPrompt.rows[0]?.content) {
        finalPrompt = dbPrompt.rows[0].content
        console.log('[Prompt] Using DB default prompt.')
      } else {
        // fallback to system-level default
        const sysPrompt = await query(
          `SELECT content FROM document_prompts
           WHERE tenant_id = 1 AND is_default = TRUE
           LIMIT 1`,
        )
        if (sysPrompt.rows[0]?.content) {
          finalPrompt = sysPrompt.rows[0].content
          console.log('[Prompt] Using system fallback prompt.')
        }
      }
    } catch (e) {
      console.log('[Prompt] DB lookup failed, using code fallback:', e.message)
    }
    if (!finalPrompt) {
      finalPrompt = getDefaultPrompt()
    }
  }

  try {
    // 1. 优先尝试 Ollama 直接提取结构化数据
    let ollamaResult = null
    try {
      ollamaResult = await extractWithOllama(filePath, req.file.mimetype, {
        model: selectedModel || undefined,
        prompt: finalPrompt || undefined,
      })
    } catch (e) {
      console.log('[Ollama] Not available, falling back to OCR:', e.message)
    }

    // 2. 提取文本（用于正则回退 + rawText 展示）
    const rawText = await extractDocumentText(filePath, req.file.mimetype)

    // 3. 解析字段（优先使用 Ollama 结果，否则正则回退）
    const parsed = parseDocument(rawText, ollamaResult)

    // 3. 在数据库中匹配供应商（模糊匹配）
    let matchedSupplier = null
    if (parsed.supplierName) {
      const searchPattern = `%${parsed.supplierName.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
      const supResult = await query(
        `SELECT id, name FROM suppliers
         WHERE tenant_id = $1 AND (name ILIKE $2 OR name ILIKE $3)
         LIMIT 1`,
        [tenantId, searchPattern, `%${parsed.supplierName.split(' ').slice(0, 2).join(' ')}%`]
      )
      if (supResult.rows[0]) {
        matchedSupplier = supResult.rows[0]
      }
    }

    // 4. 在数据库中匹配产品（基于 OCR 提取的描述模糊匹配）
    const matchedItems = []
    for (const item of parsed.items) {
      if (!item.description) continue
      // 取前 5 个词做匹配
      const keywords = item.description.split(/\s+/).slice(0, 5).join(' ')
      const searchPattern = `%${keywords.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
      const prodResult = await query(
        `SELECT id, name, sku, unit FROM products
         WHERE tenant_id = $1 AND (name ILIKE $2 OR sku ILIKE $3)
         LIMIT 3`,
        [tenantId, searchPattern, `%${keywords.slice(0, 10)}%`]
      )
      matchedItems.push({
        extractedQuantity: item.quantity,
        extractedDescription: item.description,
        matchedProducts: prodResult.rows,
      })
    }

    // 5. 查找默认仓库
    const whResult = await query(
      `SELECT id, name FROM warehouses WHERE tenant_id = $1 ORDER BY id LIMIT 1`,
      [tenantId]
    )
    const defaultWarehouse = whResult.rows[0] || null

    // 6. 返回预览数据
    return res.json({
      documentType: parsed.documentType,
      documentNumber: parsed.documentNumber,
      date: parsed.date,
      supplierName: parsed.supplierName,
      matchedSupplier: matchedSupplier,
      items: matchedItems,
      defaultWarehouse: defaultWarehouse,
      rawText: parsed.rawText,
      fileName: req.file.originalname,
      fileUrl: `/uploads/documents/${path.basename(filePath)}`,
    })
  } catch (error) {
    console.error('Document parse error:', error)
    return res.status(500).json({ message: 'Failed to parse document.', error: error.message })
  } finally {
    // 保留文件供预览，定期清理即可
  }
})

/**
 * POST /api/documents/create
 * 确认预览数据后，自动创建 Delivery Order 或 Invoice
 * body: { documentType, documentNumber, date, supplierId, warehouseId, items, notes }
 */
router.post('/create', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  const tenantId = getTenantId(req)
  const { documentType, documentNumber, date, supplierId, warehouseId, items, notes } = req.body

  if (!documentType || !documentNumber || !date || !supplierId) {
    return res.status(400).json({ message: 'documentType, documentNumber, date, supplierId are required.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (documentType === 'delivery_order') {
      // 创建 Delivery Order
      const doResult = await client.query(
        `INSERT INTO delivery_orders (tenant_id, supplier_id, do_no, do_date, warehouse_id, notes, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7)
         RETURNING *`,
        [tenantId, Number(supplierId), documentNumber, date, warehouseId ? Number(warehouseId) : null, notes || null, req.user.id]
      )
      const doId = doResult.rows[0].id

      // 插入 items
      if (Array.isArray(items) && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          await client.query(
            `INSERT INTO delivery_order_items (delivery_order_id, product_id, item_code, description, quantity, unit, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [doId, it.productId || null, it.itemCode || '', it.description || '', Number(it.quantity) || 0, it.unit || 'pcs', i]
          )
        }
      }

      await client.query('COMMIT')
      return res.status(201).json({ message: 'Delivery Order created.', id: doId, type: 'delivery_order' })
    }

    if (documentType === 'invoice') {
      // 创建 Invoice
      const invResult = await client.query(
        `INSERT INTO supplier_invoices (tenant_id, supplier_id, invoice_no, invoice_date, warehouse_id, notes, status, post_to_inventory, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8)
         RETURNING *`,
        [tenantId, Number(supplierId), documentNumber, date, warehouseId ? Number(warehouseId) : null, notes || null, Boolean(warehouseId), req.user.id]
      )
      const invId = invResult.rows[0].id

      if (Array.isArray(items) && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          await client.query(
            `INSERT INTO supplier_invoice_items (invoice_id, product_id, description, quantity, unit_cost, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [invId, it.productId || null, it.description || '', Number(it.quantity) || 0, Number(it.unitCost) || 0, i]
          )
        }
      }

      await client.query('COMMIT')
      return res.status(201).json({ message: 'Invoice created.', id: invId, type: 'invoice' })
    }

    return res.status(400).json({ message: 'Unknown document type.' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Document create error:', error)
    return res.status(500).json({ message: 'Failed to create document.', error: error.message })
  } finally {
    client.release()
  }
})

module.exports = router
