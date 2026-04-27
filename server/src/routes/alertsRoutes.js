const express = require('express')
const { query } = require('../config/db')
const { authenticateToken } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')

const router = express.Router()

router.use(authenticateToken)

function getSearchPattern(search) {
  return `%${String(search || '').trim()}%`
}

async function saveAlertState({ productId, warehouseId, status, assignedTo, notes, userId }) {
  const result = await query(
    `
      INSERT INTO low_stock_alert_states (
        product_id,
        warehouse_id,
        status,
        assigned_to,
        notes,
        updated_by,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (product_id, warehouse_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        assigned_to = EXCLUDED.assigned_to,
        notes = EXCLUDED.notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
    [productId, warehouseId, status, assignedTo || null, notes || null, userId],
  )

  return result.rows[0]
}

function getAlertBaseQuery() {
  return `
    FROM stock_levels
    INNER JOIN products ON products.id = stock_levels.product_id
    INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id
    LEFT JOIN categories ON categories.id = products.category_id
    LEFT JOIN product_suppliers ON product_suppliers.product_id = products.id
      AND product_suppliers.is_primary = TRUE
    LEFT JOIN suppliers ON suppliers.id = product_suppliers.supplier_id
    LEFT JOIN LATERAL (
      SELECT
        stock_movements.created_at,
        stock_movements.quantity,
        stock_movements.unit_cost,
        stock_movements.purchase_reason,
        stock_movements.reference_no
      FROM stock_movements
      WHERE stock_movements.product_id = products.id
        AND stock_movements.movement_type = 'IN'
      ORDER BY stock_movements.created_at DESC
      LIMIT 1
    ) last_purchase ON TRUE
    LEFT JOIN low_stock_alert_states ON low_stock_alert_states.product_id = stock_levels.product_id
      AND low_stock_alert_states.warehouse_id = stock_levels.warehouse_id
    LEFT JOIN users AS assignees ON assignees.id = low_stock_alert_states.assigned_to
    WHERE stock_levels.quantity <= products.reorder_level
      AND (
        $1 = '%%'
        OR products.name ILIKE $1
        OR products.sku ILIKE $1
        OR warehouses.name ILIKE $1
        OR categories.name ILIKE $1
      )
      AND ($2::int IS NULL OR warehouses.id = $2::int)
      AND ($3 = 'all' OR COALESCE(low_stock_alert_states.status, 'OPEN') = $3)
  `
}

router.get('/low-stock', async (req, res) => {
  const { search = '', warehouseId = '', status = 'all', all = 'false' } = req.query
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = getSearchPattern(search)

  try {
    const itemsParams = [searchPattern, warehouseId || null, status]

    if (loadAll) {
      const result = await query(
        `
          SELECT
            stock_levels.id,
            products.id AS product_id,
            products.name AS product_name,
            products.sku,
            products.reorder_level,
            stock_levels.quantity,
            warehouses.id AS warehouse_id,
            warehouses.name AS warehouse_name,
            GREATEST(products.reorder_level - stock_levels.quantity, 0) AS shortage,
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
          ORDER BY shortage DESC, products.name ASC
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
        },
      })
    }

    const [itemsResult, totalResult, summaryResult] = await Promise.all([
      query(
        `
          SELECT
            stock_levels.id,
            products.id AS product_id,
            products.name AS product_name,
            products.sku,
            products.reorder_level,
            stock_levels.quantity,
            warehouses.id AS warehouse_id,
            warehouses.name AS warehouse_name,
            GREATEST(products.reorder_level - stock_levels.quantity, 0) AS shortage,
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
          ORDER BY shortage DESC, products.name ASC
          LIMIT $4 OFFSET $5
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
            COUNT(DISTINCT stock_levels.product_id)::int AS affected_products
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
  const { status = 'OPEN', assignedTo = null, notes = '' } = req.body
  const allowedStatuses = ['OPEN', 'READ', 'IGNORED']

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid alert status.' })
  }

  if (assignedTo && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only admin or manager can assign alerts.' })
  }

  try {
    const result = await saveAlertState({
      productId: req.params.productId,
      warehouseId: req.params.warehouseId,
      status,
      assignedTo,
      notes,
      userId: req.user.id,
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
          productId: item.productId,
          warehouseId: item.warehouseId,
          status: resolvedStatus,
          assignedTo: resolvedAssignedTo,
          notes: resolvedNotes,
          userId: req.user.id,
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

module.exports = router
