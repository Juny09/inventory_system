const express = require('express')
const { query } = require('../config/db')
const { authenticateToken } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const { getTenantId } = require('../utils/tenant')

const router = express.Router()

router.use(authenticateToken)

function getSearchPattern(search) {
  return `%${String(search || '').trim()}%`
}

async function resolveVariantId({ tenantId, productId, variantId }) {
  const vid = Number(variantId)
  const pid = Number(productId)

  if (vid) {
    const result = await query('SELECT id, product_id FROM product_variants WHERE id = $1 AND tenant_id = $2', [vid, tenantId])
    if (!result.rows[0]) throw new Error('Variant not found in current company.')
    return { variantId: vid, productId: Number(result.rows[0].product_id) }
  }

  if (pid) {
    const result = await query(
      `
        SELECT id, product_id
        FROM product_variants
        WHERE tenant_id = $1 AND product_id = $2 AND variant_label = 'DEFAULT'
        ORDER BY id ASC
        LIMIT 1
      `,
      [tenantId, pid],
    )
    if (!result.rows[0]) throw new Error('Default variant not found for this product.')
    return { variantId: Number(result.rows[0].id), productId: pid }
  }

  throw new Error('variantId (or productId) is required.')
}

async function saveAlertState({ variantId, productId, warehouseId, status, assignedTo, notes, userId, tenantId }) {
  const resolved = await resolveVariantId({ tenantId, productId, variantId })
  const result = await query(
    `
      INSERT INTO low_stock_alert_states (
        tenant_id,
        variant_id,
        product_id,
        warehouse_id,
        status,
        assigned_to,
        notes,
        updated_by,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, variant_id, warehouse_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        assigned_to = EXCLUDED.assigned_to,
        notes = EXCLUDED.notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [tenantId, resolved.variantId, resolved.productId, warehouseId, status, assignedTo || null, notes || null, userId],
  )

  return result.rows[0]
}

// 基础 FROM + WHERE 条件（$1=searchPattern, $2=warehouseId, $3=status, $4=tenantId）
function getAlertBaseQuery() {
  return `
    FROM stock_levels
    INNER JOIN products ON products.id = stock_levels.product_id AND products.tenant_id = stock_levels.tenant_id
    LEFT JOIN product_variants ON product_variants.id = stock_levels.variant_id AND product_variants.tenant_id = stock_levels.tenant_id
    INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id AND warehouses.tenant_id = stock_levels.tenant_id
    LEFT JOIN categories ON categories.id = products.category_id AND categories.tenant_id = products.tenant_id
    LEFT JOIN product_suppliers ON product_suppliers.product_id = products.id
      AND product_suppliers.is_primary = TRUE
      AND product_suppliers.tenant_id = products.tenant_id
    LEFT JOIN suppliers ON suppliers.id = product_suppliers.supplier_id AND suppliers.tenant_id = products.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        stock_movements.created_at,
        stock_movements.quantity,
        stock_movements.unit_cost,
        stock_movements.purchase_reason,
        stock_movements.reference_no
      FROM stock_movements
      WHERE stock_movements.variant_id = stock_levels.variant_id
        AND stock_movements.movement_type = 'IN'
        AND stock_movements.tenant_id = products.tenant_id
      ORDER BY stock_movements.created_at DESC
      LIMIT 1
    ) last_purchase ON TRUE
    LEFT JOIN low_stock_alert_states ON low_stock_alert_states.variant_id = stock_levels.variant_id
      AND low_stock_alert_states.warehouse_id = stock_levels.warehouse_id
      AND low_stock_alert_states.tenant_id = stock_levels.tenant_id
    LEFT JOIN users AS assignees ON assignees.id = low_stock_alert_states.assigned_to AND assignees.tenant_id = stock_levels.tenant_id
    WHERE stock_levels.tenant_id = $4
      AND stock_levels.quantity <= COALESCE(product_variants.reorder_level, products.reorder_level)
      AND (
        $1 = '%%'
        OR products.name ILIKE $1
        OR COALESCE(product_variants.sku, products.sku) ILIKE $1
        OR COALESCE(product_variants.variant_label, 'DEFAULT') ILIKE $1
        OR warehouses.name ILIKE $1
        OR categories.name ILIKE $1
      )
      AND ($2::int IS NULL OR warehouses.id = $2::int)
      AND ($3 = 'all' OR COALESCE(low_stock_alert_states.status, 'OPEN') = $3)
  `
}

router.get('/low-stock', async (req, res) => {
  const tenantId = getTenantId(req)
  const { search = '', warehouseId = '', status = 'all', all = 'false', sort = 'shortage', order = 'desc' } = req.query
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = getSearchPattern(search)

  // 验证排序字段
  const allowedSortFields = ['shortage', 'product_name', 'warehouse_name', 'quantity', 'reorder_level', 'last_purchase_at']
  const safeSort = allowedSortFields.includes(sort) ? sort : 'shortage'
  const safeOrder = ['asc', 'desc'].includes(order.toLowerCase()) ? order.toLowerCase() : 'desc'

  try {
    const itemsParams = [searchPattern, warehouseId || null, status, tenantId]

    if (loadAll) {
      const result = await query(
        `
          SELECT
            stock_levels.id,
            stock_levels.variant_id,
            products.id AS product_id,
            products.name AS product_name,
            COALESCE(product_variants.sku, products.sku) AS sku,
            COALESCE(product_variants.variant_label, 'DEFAULT') AS variant_label,
            COALESCE(product_variants.reorder_level, products.reorder_level) AS reorder_level,
            stock_levels.quantity,
            warehouses.id AS warehouse_id,
            warehouses.name AS warehouse_name,
            GREATEST(COALESCE(product_variants.reorder_level, products.reorder_level) - stock_levels.quantity, 0) AS shortage,
            COALESCE(low_stock_alert_states.status, 'OPEN') AS alert_status,
            low_stock_alert_states.notes AS alert_notes,
            low_stock_alert_states.assigned_to,
            assignees.full_name AS assigned_to_name,
            suppliers.id AS supplier_id,
            suppliers.name AS supplier_name,
            suppliers.contact_name AS supplier_contact_name,
            suppliers.phone AS supplier_phone,
            suppliers.email AS supplier_email,
            suppliers.lead_time_days AS supplier_lead_time_days,
            suppliers.payment_terms AS supplier_payment_terms,
            last_purchase.created_at AS last_purchase_at,
            last_purchase.quantity AS last_purchase_quantity,
            last_purchase.unit_cost AS last_purchase_unit_cost,
            last_purchase.purchase_reason AS last_purchase_reason,
            last_purchase.reference_no AS last_purchase_reference_no
          ${getAlertBaseQuery()}
          ORDER BY ${safeSort} ${safeOrder}, products.name ASC
        `,
        itemsParams,
      )

      return res.json({
        items: result.rows,
        pagination: buildPagination(result.rows.length, 1, result.rows.length || 1),
        summary: {
          total_alerts: result.rows.length,
          out_of_stock: result.rows.filter((item) => Number(item.quantity) === 0).length,
          affected_products: new Set(result.rows.map((item) => item.product_id)).size,
          affected_variants: new Set(result.rows.map((item) => item.variant_id)).size,
        },
      })
    }

    const [itemsResult, totalResult, summaryResult] = await Promise.all([
      query(
        `
          SELECT
            stock_levels.id,
            stock_levels.variant_id,
            products.id AS product_id,
            products.name AS product_name,
            COALESCE(product_variants.sku, products.sku) AS sku,
            COALESCE(product_variants.variant_label, 'DEFAULT') AS variant_label,
            COALESCE(product_variants.reorder_level, products.reorder_level) AS reorder_level,
            stock_levels.quantity,
            warehouses.id AS warehouse_id,
            warehouses.name AS warehouse_name,
            GREATEST(COALESCE(product_variants.reorder_level, products.reorder_level) - stock_levels.quantity, 0) AS shortage,
            COALESCE(low_stock_alert_states.status, 'OPEN') AS alert_status,
            low_stock_alert_states.notes AS alert_notes,
            low_stock_alert_states.assigned_to,
            assignees.full_name AS assigned_to_name,
            suppliers.id AS supplier_id,
            suppliers.name AS supplier_name,
            suppliers.contact_name AS supplier_contact_name,
            suppliers.phone AS supplier_phone,
            suppliers.email AS supplier_email,
            suppliers.lead_time_days AS supplier_lead_time_days,
            suppliers.payment_terms AS supplier_payment_terms,
            last_purchase.created_at AS last_purchase_at,
            last_purchase.quantity AS last_purchase_quantity,
            last_purchase.unit_cost AS last_purchase_unit_cost,
            last_purchase.purchase_reason AS last_purchase_reason,
            last_purchase.reference_no AS last_purchase_reference_no
          ${getAlertBaseQuery()}
          ORDER BY ${safeSort} ${safeOrder}, products.name ASC
          LIMIT $5 OFFSET $6
        `,
        [...itemsParams, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          ${getAlertBaseQuery()}
        `,
        itemsParams,
      ),
      query(
        `
          SELECT
            COUNT(*)::int AS total_alerts,
            COUNT(*) FILTER (WHERE stock_levels.quantity = 0)::int AS out_of_stock,
            COUNT(DISTINCT stock_levels.product_id)::int AS affected_products,
            COUNT(DISTINCT stock_levels.variant_id)::int AS affected_variants
          ${getAlertBaseQuery()}
        `,
        itemsParams,
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
      summary: summaryResult.rows[0],
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch low stock alerts.', error: error.message })
  }
})

router.put('/low-stock/:productId/:warehouseId', async (req, res) => {
  const tenantId = getTenantId(req)
  const { status = 'OPEN', assignedTo = null, notes = '', variantId = null } = req.body
  const allowedStatuses = ['OPEN', 'READ', 'IGNORED']

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid alert status.' })
  }

  if (assignedTo && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only admin or manager can assign alerts.' })
  }

  try {
    const warehouseCheck = await query('SELECT id FROM warehouses WHERE id = $1 AND tenant_id = $2', [req.params.warehouseId, tenantId])
    if (!warehouseCheck.rows[0]) return res.status(404).json({ message: 'Warehouse not found in current company.' })

    const result = await saveAlertState({
      variantId: variantId || null,
      productId: req.params.productId,
      warehouseId: req.params.warehouseId,
      status,
      assignedTo,
      notes,
      userId: req.user.id,
      tenantId,
    })

    req.auditContext = {
      action: 'ALERT_UPDATE',
      entityType: 'ALERT',
      entityId: `${req.params.productId}:${req.params.warehouseId}`,
      description: `Updated low stock alert for product ${req.params.productId} in warehouse ${req.params.warehouseId}`,
    }

    return res.json(result)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update low stock alert.', error: error.message })
  }
})

router.post('/low-stock/bulk-update', async (req, res) => {
  const tenantId = getTenantId(req)
  const { items = [], status = 'OPEN', assignedTo = null, notes = '' } = req.body
  const allowedStatuses = ['OPEN', 'READ', 'IGNORED']

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items is required.' })
  }

  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid alert status.' })
  }

  if (assignedTo && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only admin or manager can assign alerts.' })
  }

  const hasInvalidItemStatus = items.some((item) => item.status && !allowedStatuses.includes(item.status))

  if (hasInvalidItemStatus) {
    return res.status(400).json({ message: 'Invalid alert status.' })
  }

  try {
    const result = await Promise.all(
      items.map((item) => {
        const resolvedStatus = item.status || status || 'OPEN'
        const resolvedAssignedTo = item.assignedTo ?? assignedTo
        const resolvedNotes = item.notes ?? notes

        return saveAlertState({
          variantId: item.variantId ?? item.variant_id ?? null,
          productId: item.productId,
          warehouseId: item.warehouseId,
          status: resolvedStatus,
          assignedTo: resolvedAssignedTo,
          notes: resolvedNotes,
          userId: req.user.id,
          tenantId,
        })
      }),
    )

    req.auditContext = {
      action: 'ALERT_BULK_UPDATE',
      entityType: 'ALERT',
      entityId: String(items.length),
      description: `Bulk updated ${items.length} low stock alerts`,
    }

    return res.success({
      updated: result.length,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to bulk update low stock alerts.', error: error.message })
  }
})

router.post('/low-stock/bulk-reorder-level', async (req, res) => {
  console.log('[DEBUG] bulk-reorder-level received:', { 
    body: req.body,
    tenantId: getTenantId(req),
    userRole: req.user?.role 
  })

  const tenantId = getTenantId(req)
  const { reorderLevel, warehouseId = null, productId = null, filters = {} } = req.body

  // 校验权限
  if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only admin or manager can update reorder level.' })
  }

  // 校验 reorderLevel
  if (reorderLevel === undefined || reorderLevel < 0) {
    return res.status(400).json({ message: 'reorderLevel must be a non-negative number.' })
  }

  try {
    // 构建动态 WHERE 条件
    let whereClause = 'products.tenant_id = $1'
    let params = [tenantId]
    let paramIndex = 2

    // 应用 filters（仅使用 products 表的字段）
    if (filters.search && filters.search.trim()) {
      whereClause += ` AND (
        products.name ILIKE $${paramIndex} OR 
        products.sku ILIKE $${paramIndex}
      )`
      params.push(`%${filters.search.trim()}%`)
      paramIndex++
    }

    // 应用 warehouseId 筛选（使用 EXISTS 子查询，避免 JOIN 丢失记录）
    if (warehouseId) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM stock_levels sl
        WHERE sl.product_id = products.id
          AND sl.tenant_id = products.tenant_id
          AND sl.warehouse_id = $${paramIndex}::int
      )`
      params.push(warehouseId)
      paramIndex++
    }

    if (productId) {
      whereClause += ` AND products.id = $${paramIndex}::int`
      params.push(productId)
      paramIndex++
    }

    // 执行批量更新（直接更新 products 表，不 JOIN stock_levels）
    params.push(reorderLevel)
    
    const result = await query(
      `
        UPDATE products
        SET reorder_level = $${paramIndex}, updated_at = CURRENT_TIMESTAMP
        WHERE ${whereClause}
        RETURNING products.id, products.name, products.sku, products.reorder_level
      `,
      params
    )

    req.auditContext = {
      action: 'BULK_REORDER_LEVEL_UPDATE',
      entityType: 'PRODUCT',
      entityId: String(result.rowCount),
      description: `Bulk updated reorder_level for ${result.rowCount} products`,
    }

    return res.success({
      updated: result.rowCount,
      items: result.rows,
    })
  } catch (error) {
    console.error('Bulk reorder level update error:', error)
    return res.status(500).json({ message: 'Failed to bulk update reorder level.', error: error.message })
  }
})

module.exports = router
