const express = require('express')
const { pool, query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { ensureStockRow, getStockQuantity, updateStock } = require('../utils/inventoryService')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const { canViewCost } = require('../utils/costAccess')
const { getTenantId } = require('../utils/tenant')

const router = express.Router()

router.use(authenticateToken)

function getSearchPattern(search) {
  return `%${String(search || '').trim()}%`
}

async function resolveVariant(client, tenantId, productId, variantId) {
  const vid = Number(variantId)
  const pid = Number(productId)

  if (vid) {
    const result = await client.query(
      'SELECT id, product_id FROM product_variants WHERE id = $1 AND tenant_id = $2',
      [vid, tenantId],
    )
    if (!result.rows[0]) throw new Error('Variant not found in current company.')
    return { variantId: vid, productId: Number(result.rows[0].product_id) }
  }

  if (pid) {
    const result = await client.query(
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

// 库存总览支持分页、搜索和高级筛选，适合库存量大时提升列表性能
router.get('/', async (req, res) => {
  const { search = '', categoryId = '', warehouseId = '', lowStockOnly = 'false', all = 'false' } = req.query
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = getSearchPattern(search)
  const onlyLowStock = lowStockOnly === 'true'
  const allowCostAccess = canViewCost(req)
  const tenantId = getTenantId(req)

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT
            stock_levels.id,
            stock_levels.product_id,
            stock_levels.variant_id,
            stock_levels.warehouse_id,
            stock_levels.quantity AS on_hand_quantity,
            stock_levels.allocated_quantity AS order_allocated_quantity,
            GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) AS warehouse_available_quantity,
            stock_levels.updated_at,
            products.name AS product_name,
            COALESCE(product_variants.variant_label, 'DEFAULT') AS variant_label,
            COALESCE(product_variants.sku, products.sku) AS sku,
            COALESCE(product_variants.barcode, products.barcode) AS barcode,
            COALESCE(product_variants.reorder_level, products.reorder_level) AS reorder_level,
            products.unit,
            products.cost_price,
            categories.name AS category_name,
            warehouses.name AS warehouse_name,
            warehouses.code AS warehouse_code
          FROM stock_levels
          INNER JOIN products ON products.id = stock_levels.product_id AND products.tenant_id = stock_levels.tenant_id
          LEFT JOIN product_variants ON product_variants.id = stock_levels.variant_id AND product_variants.tenant_id = stock_levels.tenant_id
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id AND warehouses.tenant_id = stock_levels.tenant_id
          LEFT JOIN categories ON categories.id = products.category_id AND categories.tenant_id = products.tenant_id
          WHERE stock_levels.tenant_id = $5
            AND (
              $1 = '%%'
              OR products.name ILIKE $1
              OR COALESCE(product_variants.sku, products.sku) ILIKE $1
              OR COALESCE(product_variants.barcode, products.barcode) ILIKE $1
              OR COALESCE(product_variants.variant_label, 'DEFAULT') ILIKE $1
              OR categories.name ILIKE $1
              OR warehouses.name ILIKE $1
              OR warehouses.code ILIKE $1
            )
            AND ($2::int IS NULL OR products.category_id = $2::int)
            AND ($3::int IS NULL OR stock_levels.warehouse_id = $3::int)
            AND ($4 = FALSE OR GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) <= COALESCE(product_variants.reorder_level, products.reorder_level))
          ORDER BY stock_levels.updated_at DESC
        `,
        [searchPattern, categoryId || null, warehouseId || null, onlyLowStock, tenantId],
      )

      return res.json({
        items: result.rows.map((row) => ({
          ...row,
          cost_price: allowCostAccess ? row.cost_price : null,
        })),
        pagination: buildPagination(result.rows.length, 1, result.rows.length || 1),
      })
    }

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            stock_levels.id,
            stock_levels.product_id,
            stock_levels.variant_id,
            stock_levels.warehouse_id,
            stock_levels.quantity AS on_hand_quantity,
            stock_levels.allocated_quantity AS order_allocated_quantity,
            GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) AS warehouse_available_quantity,
            stock_levels.updated_at,
            products.name AS product_name,
            COALESCE(product_variants.variant_label, 'DEFAULT') AS variant_label,
            COALESCE(product_variants.sku, products.sku) AS sku,
            COALESCE(product_variants.barcode, products.barcode) AS barcode,
            COALESCE(product_variants.reorder_level, products.reorder_level) AS reorder_level,
            products.unit,
            products.cost_price,
            categories.name AS category_name,
            warehouses.name AS warehouse_name,
            warehouses.code AS warehouse_code
          FROM stock_levels
          INNER JOIN products ON products.id = stock_levels.product_id AND products.tenant_id = stock_levels.tenant_id
          LEFT JOIN product_variants ON product_variants.id = stock_levels.variant_id AND product_variants.tenant_id = stock_levels.tenant_id
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id AND warehouses.tenant_id = stock_levels.tenant_id
          LEFT JOIN categories ON categories.id = products.category_id AND categories.tenant_id = products.tenant_id
          WHERE stock_levels.tenant_id = $7
            AND (
              $1 = '%%'
              OR products.name ILIKE $1
              OR COALESCE(product_variants.sku, products.sku) ILIKE $1
              OR COALESCE(product_variants.barcode, products.barcode) ILIKE $1
              OR COALESCE(product_variants.variant_label, 'DEFAULT') ILIKE $1
              OR categories.name ILIKE $1
              OR warehouses.name ILIKE $1
              OR warehouses.code ILIKE $1
            )
            AND ($2::int IS NULL OR products.category_id = $2::int)
            AND ($3::int IS NULL OR stock_levels.warehouse_id = $3::int)
            AND ($4 = FALSE OR GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) <= COALESCE(product_variants.reorder_level, products.reorder_level))
          ORDER BY stock_levels.updated_at DESC
          LIMIT $5 OFFSET $6
        `,
        [searchPattern, categoryId || null, warehouseId || null, onlyLowStock, pageSize, offset, tenantId],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM stock_levels
          INNER JOIN products ON products.id = stock_levels.product_id AND products.tenant_id = stock_levels.tenant_id
          LEFT JOIN product_variants ON product_variants.id = stock_levels.variant_id AND product_variants.tenant_id = stock_levels.tenant_id
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id AND warehouses.tenant_id = stock_levels.tenant_id
          LEFT JOIN categories ON categories.id = products.category_id AND categories.tenant_id = products.tenant_id
          WHERE stock_levels.tenant_id = $5
            AND (
              $1 = '%%'
              OR products.name ILIKE $1
              OR COALESCE(product_variants.sku, products.sku) ILIKE $1
              OR COALESCE(product_variants.barcode, products.barcode) ILIKE $1
              OR COALESCE(product_variants.variant_label, 'DEFAULT') ILIKE $1
              OR categories.name ILIKE $1
              OR warehouses.name ILIKE $1
              OR warehouses.code ILIKE $1
            )
            AND ($2::int IS NULL OR products.category_id = $2::int)
            AND ($3::int IS NULL OR stock_levels.warehouse_id = $3::int)
            AND ($4 = FALSE OR GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) <= COALESCE(product_variants.reorder_level, products.reorder_level))
        `,
        [searchPattern, categoryId || null, warehouseId || null, onlyLowStock, tenantId],
      ),
    ])

    return res.json({
      items: itemsResult.rows.map((row) => ({
        ...row,
        cost_price: allowCostAccess ? row.cost_price : null,
      })),
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch inventory.', error: error.message })
  }
})

// 最近流水支持搜索、类型筛选和分页，方便前端表格只渲染当前页
router.get('/transactions', async (req, res) => {
  const { search = '', movementType = 'all' } = req.query
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = getSearchPattern(search)
  const tenantId = getTenantId(req)

  try {
    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            stock_movements.id,
            stock_movements.movement_type,
            stock_movements.variant_id,
            stock_movements.quantity,
            stock_movements.reference_no,
            stock_movements.notes,
            stock_movements.created_at,
            products.name AS product_name,
            COALESCE(product_variants.sku, products.sku) AS sku,
            COALESCE(product_variants.variant_label, 'DEFAULT') AS variant_label,
            source_warehouse.name AS source_warehouse_name,
            destination_warehouse.name AS destination_warehouse_name,
            users.full_name AS created_by_name
          FROM stock_movements
          INNER JOIN products ON products.id = stock_movements.product_id AND products.tenant_id = stock_movements.tenant_id
          LEFT JOIN product_variants ON product_variants.id = stock_movements.variant_id AND product_variants.tenant_id = stock_movements.tenant_id
          LEFT JOIN warehouses AS source_warehouse ON source_warehouse.id = stock_movements.source_warehouse_id
          LEFT JOIN warehouses AS destination_warehouse ON destination_warehouse.id = stock_movements.destination_warehouse_id
          LEFT JOIN users ON users.id = stock_movements.created_by
          WHERE stock_movements.tenant_id = $5
            AND (
              $1 = '%%'
              OR products.name ILIKE $1
              OR COALESCE(product_variants.sku, products.sku) ILIKE $1
              OR COALESCE(product_variants.variant_label, 'DEFAULT') ILIKE $1
              OR stock_movements.reference_no ILIKE $1
              OR stock_movements.movement_type ILIKE $1
              OR source_warehouse.name ILIKE $1
              OR destination_warehouse.name ILIKE $1
              OR users.full_name ILIKE $1
            )
            AND ($2 = 'all' OR stock_movements.movement_type = $2)
          ORDER BY stock_movements.created_at DESC
          LIMIT $3 OFFSET $4
        `,
        [searchPattern, movementType, pageSize, offset, tenantId],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM stock_movements
          INNER JOIN products ON products.id = stock_movements.product_id AND products.tenant_id = stock_movements.tenant_id
          LEFT JOIN product_variants ON product_variants.id = stock_movements.variant_id AND product_variants.tenant_id = stock_movements.tenant_id
          LEFT JOIN warehouses AS source_warehouse ON source_warehouse.id = stock_movements.source_warehouse_id
          LEFT JOIN warehouses AS destination_warehouse ON destination_warehouse.id = stock_movements.destination_warehouse_id
          LEFT JOIN users ON users.id = stock_movements.created_by
          WHERE stock_movements.tenant_id = $3
            AND (
              $1 = '%%'
              OR products.name ILIKE $1
              OR COALESCE(product_variants.sku, products.sku) ILIKE $1
              OR COALESCE(product_variants.variant_label, 'DEFAULT') ILIKE $1
              OR stock_movements.reference_no ILIKE $1
              OR stock_movements.movement_type ILIKE $1
              OR source_warehouse.name ILIKE $1
              OR destination_warehouse.name ILIKE $1
              OR users.full_name ILIKE $1
            )
            AND ($2 = 'all' OR stock_movements.movement_type = $2)
        `,
        [searchPattern, movementType, tenantId],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch transactions.', error: error.message })
  }
})

async function syncProductPricingFromUnitCost(client, { tenantId, productId, unitCost, userId, referenceNo }) {
  const nextCost = Number(unitCost || 0)
  if (!productId || !Number.isFinite(nextCost) || nextCost <= 0) {
    return
  }

  const current = await client.query(
    `SELECT cost_price, markup_percentage FROM products WHERE id = $1 AND tenant_id = $2`,
    [productId, tenantId],
  )
  const row = current.rows[0]
  if (!row) {
    return
  }

  const oldCost = Number(row.cost_price || 0)
  const costChanged = nextCost !== oldCost

  if (costChanged) {
    await client.query(
      `UPDATE products
       SET cost_price = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [productId, tenantId, Number(nextCost.toFixed(2))],
    )

    const percentChange = oldCost > 0 ? ((nextCost - oldCost) / oldCost) * 100 : nextCost === 0 ? 0 : 100
    await client.query(
      `
        INSERT INTO product_cost_price_histories (
          tenant_id,
          product_id,
          old_cost_price,
          new_cost_price,
          percent_change,
          reason,
          changed_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        tenantId,
        productId,
        oldCost,
        nextCost,
        Number.isFinite(percentChange) ? percentChange : 0,
        referenceNo ? `Stock in ${referenceNo}` : 'Stock in',
        userId || null,
      ],
    )

    await client.query(
      `
        DELETE FROM product_cost_price_histories
        WHERE id IN (
          SELECT id
          FROM product_cost_price_histories
          WHERE product_id = $1 AND tenant_id = $2
          ORDER BY changed_at DESC
          OFFSET 5
        )
      `,
      [productId, tenantId],
    )
  }

  await client.query(
    `
      UPDATE product_pricing_rules
      SET suggested_price = ROUND($3 * (1 + COALESCE(markup_percentage, 0) / 100.0), 2)
      WHERE tenant_id = $2
        AND product_id = $1
        AND COALESCE(suggested_price, 0) = 0
    `,
    [productId, tenantId, nextCost],
  )

  await client.query(
    `
      UPDATE products
      SET
        suggested_price = CASE
          WHEN COALESCE(suggested_price, 0) = 0 THEN ROUND($3 * (1 + COALESCE(markup_percentage, 0) / 100.0), 2)
          ELSE suggested_price
        END,
        selling_price = CASE
          WHEN COALESCE(selling_price, 0) = 0 THEN ROUND($3 * (1 + COALESCE(markup_percentage, 0) / 100.0), 2)
          ELSE selling_price
        END
      WHERE id = $1 AND tenant_id = $2
    `,
    [productId, tenantId, nextCost],
  )
}

async function createMovement(req, res, movementType) {
  const { variantId, productId, warehouseId, sourceWarehouseId, destinationWarehouseId, quantity, referenceNo, notes, supplierId, unitCost, purchaseReason } =
    req.body
  const movementQty = Number(quantity)
  const tenantId = getTenantId(req)

  if ((!variantId && !productId) || !movementQty || movementQty <= 0) {
    return res.status(400).json({ message: 'variantId (or productId) and positive quantity are required.' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const resolved = await resolveVariant(client, tenantId, productId, variantId)
    const resolvedVariantId = resolved.variantId
    const resolvedProductId = resolved.productId

    if (movementType === 'IN') {
      if (!warehouseId) {
        throw new Error('warehouseId is required for stock in.')
      }
      const wh = await client.query('SELECT id FROM warehouses WHERE id = $1 AND tenant_id = $2', [warehouseId, tenantId])
      if (!wh.rows[0]) throw new Error('Warehouse not found in current company.')

      await ensureStockRow(client, resolvedVariantId, resolvedProductId, warehouseId, tenantId)
      const currentStock = await getStockQuantity(client, resolvedVariantId, warehouseId, tenantId)
      await updateStock(
        client,
        resolvedVariantId,
        warehouseId,
        currentStock.onHandQuantity + movementQty,
        currentStock.allocatedQuantity,
        tenantId,
      )

      const result = await client.query(
        `
          INSERT INTO stock_movements (
            tenant_id,
            movement_type,
            variant_id,
            product_id,
            destination_warehouse_id,
            quantity,
            reference_no,
            notes,
            supplier_id,
            unit_cost,
            purchase_reason,
            created_by
          )
          VALUES ($1, 'IN', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `,
        [
          tenantId,
          resolvedVariantId,
          resolvedProductId,
          warehouseId,
          movementQty,
          referenceNo || null,
          notes || null,
          supplierId || null,
          unitCost === undefined || unitCost === null || unitCost === '' ? null : Number(Number(unitCost).toFixed(2)),
          purchaseReason || null,
          req.user.id,
        ],
      )

      await syncProductPricingFromUnitCost(client, {
        tenantId,
        productId: resolvedProductId,
        unitCost,
        userId: req.user.id,
        referenceNo,
      })

      await client.query('COMMIT')
      return res.status(201).json(result.rows[0])
    }

    if (movementType === 'OUT') {
      if (!warehouseId) {
        throw new Error('warehouseId is required for stock out.')
      }
      const wh = await client.query('SELECT id FROM warehouses WHERE id = $1 AND tenant_id = $2', [warehouseId, tenantId])
      if (!wh.rows[0]) throw new Error('Warehouse not found in current company.')

      await ensureStockRow(client, resolvedVariantId, resolvedProductId, warehouseId, tenantId)
      const currentStock = await getStockQuantity(client, resolvedVariantId, warehouseId, tenantId)
      const currentAvailable = currentStock.onHandQuantity - currentStock.allocatedQuantity

      if (currentAvailable < movementQty) {
        throw new Error('Not enough stock for stock out.')
      }

      await updateStock(
        client,
        resolvedVariantId,
        warehouseId,
        currentStock.onHandQuantity - movementQty,
        currentStock.allocatedQuantity,
        tenantId,
      )

      const result = await client.query(
        `
          INSERT INTO stock_movements (
            tenant_id,
            movement_type,
            variant_id,
            product_id,
            source_warehouse_id,
            quantity,
            reference_no,
            notes,
            created_by
          )
          VALUES ($1, 'OUT', $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `,
        [tenantId, resolvedVariantId, resolvedProductId, warehouseId, movementQty, referenceNo || null, notes || null, req.user.id],
      )

      await client.query('COMMIT')
      return res.status(201).json(result.rows[0])
    }

    if (!sourceWarehouseId || !destinationWarehouseId) {
      throw new Error('sourceWarehouseId and destinationWarehouseId are required for transfer.')
    }

    if (sourceWarehouseId === destinationWarehouseId) {
      throw new Error('Source and destination warehouses must be different.')
    }

    const whCheck = await client.query(
      'SELECT id FROM warehouses WHERE id = ANY($1::int[]) AND tenant_id = $2',
      [[sourceWarehouseId, destinationWarehouseId], tenantId],
    )
    if (whCheck.rows.length !== 2) throw new Error('Warehouse not found in current company.')

    await ensureStockRow(client, resolvedVariantId, resolvedProductId, sourceWarehouseId, tenantId)
    await ensureStockRow(client, resolvedVariantId, resolvedProductId, destinationWarehouseId, tenantId)

    const sourceStock = await getStockQuantity(client, resolvedVariantId, sourceWarehouseId, tenantId)
    const sourceAvailable = sourceStock.onHandQuantity - sourceStock.allocatedQuantity

    if (sourceAvailable < movementQty) {
      throw new Error('Not enough stock for transfer.')
    }

    const destinationStock = await getStockQuantity(client, resolvedVariantId, destinationWarehouseId, tenantId)

    await updateStock(
      client,
      resolvedVariantId,
      sourceWarehouseId,
      sourceStock.onHandQuantity - movementQty,
      sourceStock.allocatedQuantity,
      tenantId,
    )
    await updateStock(
      client,
      resolvedVariantId,
      destinationWarehouseId,
      destinationStock.onHandQuantity + movementQty,
      destinationStock.allocatedQuantity,
      tenantId,
    )

    const result = await client.query(
      `
        INSERT INTO stock_movements (
          tenant_id,
          movement_type,
          variant_id,
          product_id,
          source_warehouse_id,
          destination_warehouse_id,
          quantity,
          reference_no,
          notes,
          created_by
        )
        VALUES ($1, 'TRANSFER', $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        tenantId,
        resolvedVariantId,
        resolvedProductId,
        sourceWarehouseId,
        destinationWarehouseId,
        movementQty,
        referenceNo || null,
        notes || null,
        req.user.id,
      ],
    )

    await client.query('COMMIT')
    return res.status(201).json(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    return res.status(400).json({ message: error.message })
  } finally {
    client.release()
  }
}

router.post('/stock-in', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) =>
  createMovement(req, res, 'IN'),
)

router.post('/stock-out', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) =>
  createMovement(req, res, 'OUT'),
)

router.post('/transfer', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) =>
  createMovement(req, res, 'TRANSFER'),
)

router.post('/allocate', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  const { variantId, productId, warehouseId, quantity, mode = 'reserve', referenceNo, notes } = req.body
  const allocationQty = Number(quantity)
  const normalizedMode = String(mode || '').toLowerCase()
  const tenantId = getTenantId(req)

  if ((!variantId && !productId) || !warehouseId || !allocationQty || allocationQty <= 0) {
    return res.status(400).json({ message: 'variantId (or productId), warehouseId and positive quantity are required.' })
  }

  if (!['reserve', 'release'].includes(normalizedMode)) {
    return res.status(400).json({ message: 'mode must be reserve or release.' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const resolved = await resolveVariant(client, tenantId, productId, variantId)
    const resolvedVariantId = resolved.variantId
    const resolvedProductId = resolved.productId
    const wh = await client.query('SELECT id FROM warehouses WHERE id = $1 AND tenant_id = $2', [warehouseId, tenantId])
    if (!wh.rows[0]) throw new Error('Warehouse not found in current company.')

    await ensureStockRow(client, resolvedVariantId, resolvedProductId, warehouseId, tenantId)

    const currentStock = await getStockQuantity(client, resolvedVariantId, warehouseId, tenantId)
    const nextAllocated =
      normalizedMode === 'reserve'
        ? currentStock.allocatedQuantity + allocationQty
        : currentStock.allocatedQuantity - allocationQty

    if (nextAllocated < 0) {
      throw new Error('Allocated quantity cannot be negative.')
    }

    if (nextAllocated > currentStock.onHandQuantity) {
      throw new Error('Allocated quantity cannot exceed on hand quantity.')
    }

    await updateStock(client, resolvedVariantId, warehouseId, currentStock.onHandQuantity, nextAllocated, tenantId)

    const result = await client.query(
      `
        INSERT INTO stock_movements (
          tenant_id,
          movement_type,
          variant_id,
          product_id,
          source_warehouse_id,
          quantity,
          reference_no,
          notes,
          created_by
        )
        VALUES ($1, 'OUT', $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        tenantId,
        resolvedVariantId,
        resolvedProductId,
        warehouseId,
        allocationQty,
        referenceNo || null,
        notes || (normalizedMode === 'reserve' ? 'Order allocation reserved' : 'Order allocation released'),
        req.user.id,
      ],
    )

    await client.query('COMMIT')
    return res.status(201).json({
      ...result.rows[0],
      mode: normalizedMode,
      on_hand_quantity: currentStock.onHandQuantity,
      order_allocated_quantity: nextAllocated,
      warehouse_available_quantity: currentStock.onHandQuantity - nextAllocated,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    return res.status(400).json({ message: error.message })
  } finally {
    client.release()
  }
})

module.exports = router
