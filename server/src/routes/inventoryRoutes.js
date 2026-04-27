const express = require('express')
const { pool, query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { ensureStockRow, getStockQuantity, updateStock } = require('../utils/inventoryService')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const { canViewCost } = require('../utils/costAccess')

const router = express.Router()

router.use(authenticateToken)

function getSearchPattern(search) {
  return `%${String(search || '').trim()}%`
}

// 库存总览支持分页、搜索和高级筛选，适合库存量大时提升列表性能
router.get('/', async (req, res) => {
  const { search = '', categoryId = '', warehouseId = '', lowStockOnly = 'false', all = 'false' } = req.query
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = getSearchPattern(search)
  const onlyLowStock = lowStockOnly === 'true'
  const allowCostAccess = canViewCost(req)

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT
            stock_levels.id,
            stock_levels.product_id,
            stock_levels.warehouse_id,
            stock_levels.quantity AS on_hand_quantity,
            stock_levels.allocated_quantity AS order_allocated_quantity,
            GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) AS warehouse_available_quantity,
            stock_levels.updated_at,
            products.name AS product_name,
            products.sku,
            products.barcode,
            products.reorder_level,
            products.unit,
            products.cost_price,
            categories.name AS category_name,
            warehouses.name AS warehouse_name,
            warehouses.code AS warehouse_code
          FROM stock_levels
          INNER JOIN products ON products.id = stock_levels.product_id
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id
          LEFT JOIN categories ON categories.id = products.category_id
          WHERE (
            $1 = '%%'
            OR products.name ILIKE $1
            OR products.sku ILIKE $1
            OR products.barcode ILIKE $1
            OR categories.name ILIKE $1
            OR warehouses.name ILIKE $1
            OR warehouses.code ILIKE $1
          )
            AND ($2::int IS NULL OR products.category_id = $2::int)
            AND ($3::int IS NULL OR stock_levels.warehouse_id = $3::int)
            AND ($4 = FALSE OR GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) <= products.reorder_level)
          ORDER BY stock_levels.updated_at DESC
        `,
        [searchPattern, categoryId || null, warehouseId || null, onlyLowStock],
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
            stock_levels.warehouse_id,
            stock_levels.quantity AS on_hand_quantity,
            stock_levels.allocated_quantity AS order_allocated_quantity,
            GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) AS warehouse_available_quantity,
            stock_levels.updated_at,
            products.name AS product_name,
            products.sku,
            products.barcode,
            products.reorder_level,
            products.unit,
            products.cost_price,
            categories.name AS category_name,
            warehouses.name AS warehouse_name,
            warehouses.code AS warehouse_code
          FROM stock_levels
          INNER JOIN products ON products.id = stock_levels.product_id
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id
          LEFT JOIN categories ON categories.id = products.category_id
          WHERE (
            $1 = '%%'
            OR products.name ILIKE $1
            OR products.sku ILIKE $1
            OR products.barcode ILIKE $1
            OR categories.name ILIKE $1
            OR warehouses.name ILIKE $1
            OR warehouses.code ILIKE $1
          )
            AND ($2::int IS NULL OR products.category_id = $2::int)
            AND ($3::int IS NULL OR stock_levels.warehouse_id = $3::int)
            AND ($4 = FALSE OR GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) <= products.reorder_level)
          ORDER BY stock_levels.updated_at DESC
          LIMIT $5 OFFSET $6
        `,
        [searchPattern, categoryId || null, warehouseId || null, onlyLowStock, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM stock_levels
          INNER JOIN products ON products.id = stock_levels.product_id
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id
          LEFT JOIN categories ON categories.id = products.category_id
          WHERE (
            $1 = '%%'
            OR products.name ILIKE $1
            OR products.sku ILIKE $1
            OR products.barcode ILIKE $1
            OR categories.name ILIKE $1
            OR warehouses.name ILIKE $1
            OR warehouses.code ILIKE $1
          )
            AND ($2::int IS NULL OR products.category_id = $2::int)
            AND ($3::int IS NULL OR stock_levels.warehouse_id = $3::int)
            AND ($4 = FALSE OR GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) <= products.reorder_level)
        `,
        [searchPattern, categoryId || null, warehouseId || null, onlyLowStock],
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

  try {
    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            stock_movements.id,
            stock_movements.movement_type,
            stock_movements.quantity,
            stock_movements.reference_no,
            stock_movements.notes,
            stock_movements.created_at,
            products.name AS product_name,
            products.sku,
            source_warehouse.name AS source_warehouse_name,
            destination_warehouse.name AS destination_warehouse_name,
            users.full_name AS created_by_name
          FROM stock_movements
          INNER JOIN products ON products.id = stock_movements.product_id
          LEFT JOIN warehouses AS source_warehouse ON source_warehouse.id = stock_movements.source_warehouse_id
          LEFT JOIN warehouses AS destination_warehouse ON destination_warehouse.id = stock_movements.destination_warehouse_id
          LEFT JOIN users ON users.id = stock_movements.created_by
          WHERE (
            $1 = '%%'
            OR products.name ILIKE $1
            OR products.sku ILIKE $1
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
        [searchPattern, movementType, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM stock_movements
          INNER JOIN products ON products.id = stock_movements.product_id
          LEFT JOIN warehouses AS source_warehouse ON source_warehouse.id = stock_movements.source_warehouse_id
          LEFT JOIN warehouses AS destination_warehouse ON destination_warehouse.id = stock_movements.destination_warehouse_id
          LEFT JOIN users ON users.id = stock_movements.created_by
          WHERE (
            $1 = '%%'
            OR products.name ILIKE $1
            OR products.sku ILIKE $1
            OR stock_movements.reference_no ILIKE $1
            OR stock_movements.movement_type ILIKE $1
            OR source_warehouse.name ILIKE $1
            OR destination_warehouse.name ILIKE $1
            OR users.full_name ILIKE $1
          )
            AND ($2 = 'all' OR stock_movements.movement_type = $2)
        `,
        [searchPattern, movementType],
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

async function createMovement(req, res, movementType) {
  const { productId, warehouseId, sourceWarehouseId, destinationWarehouseId, quantity, referenceNo, notes, supplierId, unitCost, purchaseReason } =
    req.body
  const movementQty = Number(quantity)

  if (!productId || !movementQty || movementQty <= 0) {
    return res.status(400).json({ message: 'productId and positive quantity are required.' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    if (movementType === 'IN') {
      if (!warehouseId) {
        throw new Error('warehouseId is required for stock in.')
      }

      await ensureStockRow(client, productId, warehouseId)
      const currentStock = await getStockQuantity(client, productId, warehouseId)
      await updateStock(
        client,
        productId,
        warehouseId,
        currentStock.onHandQuantity + movementQty,
        currentStock.allocatedQuantity,
      )

      const result = await client.query(
        `
          INSERT INTO stock_movements (
            movement_type,
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
          VALUES ('IN', $1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `,
        [
          productId,
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

      await client.query('COMMIT')
      return res.status(201).json(result.rows[0])
    }

    if (movementType === 'OUT') {
      if (!warehouseId) {
        throw new Error('warehouseId is required for stock out.')
      }

      await ensureStockRow(client, productId, warehouseId)
      const currentStock = await getStockQuantity(client, productId, warehouseId)
      const currentAvailable = currentStock.onHandQuantity - currentStock.allocatedQuantity

      if (currentAvailable < movementQty) {
        throw new Error('Not enough stock for stock out.')
      }

      await updateStock(
        client,
        productId,
        warehouseId,
        currentStock.onHandQuantity - movementQty,
        currentStock.allocatedQuantity,
      )

      const result = await client.query(
        `
          INSERT INTO stock_movements (
            movement_type,
            product_id,
            source_warehouse_id,
            quantity,
            reference_no,
            notes,
            created_by
          )
          VALUES ('OUT', $1, $2, $3, $4, $5, $6)
          RETURNING *
        `,
        [productId, warehouseId, movementQty, referenceNo || null, notes || null, req.user.id],
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

    await ensureStockRow(client, productId, sourceWarehouseId)
    await ensureStockRow(client, productId, destinationWarehouseId)

    const sourceStock = await getStockQuantity(client, productId, sourceWarehouseId)
    const sourceAvailable = sourceStock.onHandQuantity - sourceStock.allocatedQuantity

    if (sourceAvailable < movementQty) {
      throw new Error('Not enough stock for transfer.')
    }

    const destinationStock = await getStockQuantity(client, productId, destinationWarehouseId)

    await updateStock(
      client,
      productId,
      sourceWarehouseId,
      sourceStock.onHandQuantity - movementQty,
      sourceStock.allocatedQuantity,
    )
    await updateStock(
      client,
      productId,
      destinationWarehouseId,
      destinationStock.onHandQuantity + movementQty,
      destinationStock.allocatedQuantity,
    )

    const result = await client.query(
      `
        INSERT INTO stock_movements (
          movement_type,
          product_id,
          source_warehouse_id,
          destination_warehouse_id,
          quantity,
          reference_no,
          notes,
          created_by
        )
        VALUES ('TRANSFER', $1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        productId,
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
  const { productId, warehouseId, quantity, mode = 'reserve', referenceNo, notes } = req.body
  const allocationQty = Number(quantity)
  const normalizedMode = String(mode || '').toLowerCase()

  if (!productId || !warehouseId || !allocationQty || allocationQty <= 0) {
    return res.status(400).json({ message: 'productId, warehouseId and positive quantity are required.' })
  }

  if (!['reserve', 'release'].includes(normalizedMode)) {
    return res.status(400).json({ message: 'mode must be reserve or release.' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await ensureStockRow(client, productId, warehouseId)

    const currentStock = await getStockQuantity(client, productId, warehouseId)
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

    await updateStock(client, productId, warehouseId, currentStock.onHandQuantity, nextAllocated)

    const result = await client.query(
      `
        INSERT INTO stock_movements (
          movement_type,
          product_id,
          source_warehouse_id,
          quantity,
          reference_no,
          notes,
          created_by
        )
        VALUES ('OUT', $1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        productId,
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
