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

async function resolveLocation(
  client,
  tenantId,
  warehouseId,
  {
    locationId = null,
    locationCode = '',
    locationName = '',
    zone = '',
    shelf = '',
    bin = '',
    level = '',
  } = {},
  allowCreate = false,
) {
  if (!warehouseId) {
    return null
  }

  const normalizedLocationCode = String(locationCode || '').trim().toUpperCase()
  const normalizedLocationName = String(locationName || '').trim()
  const normalizedZone = String(zone || '').trim()
  const normalizedShelf = String(shelf || '').trim()
  const normalizedBin = String(bin || '').trim()
  const normalizedLevel = String(level || '').trim()

  if (locationId) {
    const locationResult = await client.query(
      `
        SELECT id, warehouse_id, location_code, location_name, zone, shelf, bin, level
        FROM warehouse_locations
        WHERE id = $1 AND tenant_id = $2 AND warehouse_id = $3
      `,
      [locationId, tenantId, warehouseId],
    )
    if (!locationResult.rows[0]) {
      throw new Error('Location not found in current warehouse.')
    }
    return locationResult.rows[0]
  }

  if (!normalizedLocationCode) {
    return null
  }

  const existingResult = await client.query(
    `
      SELECT id, warehouse_id, location_code, location_name, zone, shelf, bin, level
      FROM warehouse_locations
      WHERE tenant_id = $1 AND warehouse_id = $2 AND location_code = $3
      LIMIT 1
    `,
    [tenantId, warehouseId, normalizedLocationCode],
  )

  if (existingResult.rows[0]) {
    const existing = existingResult.rows[0]
    if (allowCreate) {
      const updatedResult = await client.query(
        `
          UPDATE warehouse_locations
          SET
            location_name = COALESCE(NULLIF($4, ''), location_name),
            zone = COALESCE(NULLIF($5, ''), zone),
            shelf = COALESCE(NULLIF($6, ''), shelf),
            bin = COALESCE(NULLIF($7, ''), bin),
            level = COALESCE(NULLIF($8, ''), level),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND tenant_id = $2 AND warehouse_id = $3
          RETURNING id, warehouse_id, location_code, location_name, zone, shelf, bin, level
        `,
        [
          existing.id,
          tenantId,
          warehouseId,
          normalizedLocationName,
          normalizedZone,
          normalizedShelf,
          normalizedBin,
          normalizedLevel,
        ],
      )
      return updatedResult.rows[0]
    }

    return existing
  }

  if (!allowCreate) {
    throw new Error('Location not found in current warehouse.')
  }

  const insertResult = await client.query(
    `
      INSERT INTO warehouse_locations (
        tenant_id,
        warehouse_id,
        location_code,
        location_name,
        zone,
        shelf,
        bin,
        level,
        is_active
      )
      VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''), TRUE)
      RETURNING id, warehouse_id, location_code, location_name, zone, shelf, bin, level
    `,
    [
      tenantId,
      warehouseId,
      normalizedLocationCode,
      normalizedLocationName,
      normalizedZone,
      normalizedShelf,
      normalizedBin,
      normalizedLevel,
    ],
  )

  return insertResult.rows[0]
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
            warehouses.code AS warehouse_code,
            warehouse_locations.id AS location_id,
            warehouse_locations.location_code,
            warehouse_locations.location_name,
            warehouse_locations.zone,
            warehouse_locations.shelf,
            warehouse_locations.bin,
            warehouse_locations.level
          FROM stock_levels
          INNER JOIN products ON products.id = stock_levels.product_id AND products.tenant_id = stock_levels.tenant_id
          LEFT JOIN product_variants ON product_variants.id = stock_levels.variant_id AND product_variants.tenant_id = stock_levels.tenant_id
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id AND warehouses.tenant_id = stock_levels.tenant_id
          LEFT JOIN warehouse_locations ON warehouse_locations.id = stock_levels.location_id AND warehouse_locations.tenant_id = stock_levels.tenant_id
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
              OR warehouse_locations.location_code ILIKE $1
              OR warehouse_locations.location_name ILIKE $1
              OR warehouse_locations.shelf ILIKE $1
              OR warehouse_locations.bin ILIKE $1
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
            warehouses.code AS warehouse_code,
            warehouse_locations.id AS location_id,
            warehouse_locations.location_code,
            warehouse_locations.location_name,
            warehouse_locations.zone,
            warehouse_locations.shelf,
            warehouse_locations.bin,
            warehouse_locations.level
          FROM stock_levels
          INNER JOIN products ON products.id = stock_levels.product_id AND products.tenant_id = stock_levels.tenant_id
          LEFT JOIN product_variants ON product_variants.id = stock_levels.variant_id AND product_variants.tenant_id = stock_levels.tenant_id
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id AND warehouses.tenant_id = stock_levels.tenant_id
          LEFT JOIN warehouse_locations ON warehouse_locations.id = stock_levels.location_id AND warehouse_locations.tenant_id = stock_levels.tenant_id
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
              OR warehouse_locations.location_code ILIKE $1
              OR warehouse_locations.location_name ILIKE $1
              OR warehouse_locations.shelf ILIKE $1
              OR warehouse_locations.bin ILIKE $1
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
          LEFT JOIN warehouse_locations ON warehouse_locations.id = stock_levels.location_id AND warehouse_locations.tenant_id = stock_levels.tenant_id
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
              OR warehouse_locations.location_code ILIKE $1
              OR warehouse_locations.location_name ILIKE $1
              OR warehouse_locations.shelf ILIKE $1
              OR warehouse_locations.bin ILIKE $1
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
            source_location.location_code AS source_location_code,
            source_location.shelf AS source_shelf,
            source_location.bin AS source_bin,
            destination_location.location_code AS destination_location_code,
            destination_location.shelf AS destination_shelf,
            destination_location.bin AS destination_bin,
            users.full_name AS created_by_name
          FROM stock_movements
          INNER JOIN products ON products.id = stock_movements.product_id AND products.tenant_id = stock_movements.tenant_id
          LEFT JOIN product_variants ON product_variants.id = stock_movements.variant_id AND product_variants.tenant_id = stock_movements.tenant_id
          LEFT JOIN warehouses AS source_warehouse ON source_warehouse.id = stock_movements.source_warehouse_id
          LEFT JOIN warehouses AS destination_warehouse ON destination_warehouse.id = stock_movements.destination_warehouse_id
          LEFT JOIN warehouse_locations AS source_location ON source_location.id = stock_movements.source_location_id
          LEFT JOIN warehouse_locations AS destination_location ON destination_location.id = stock_movements.destination_location_id
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
              OR source_location.location_code ILIKE $1
              OR destination_location.location_code ILIKE $1
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
          LEFT JOIN warehouse_locations AS source_location ON source_location.id = stock_movements.source_location_id
          LEFT JOIN warehouse_locations AS destination_location ON destination_location.id = stock_movements.destination_location_id
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
              OR source_location.location_code ILIKE $1
              OR destination_location.location_code ILIKE $1
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
  const currentMarkup = Number(row.markup_percentage || 0)
  const resolvedMarkup = currentMarkup > 0 ? currentMarkup : 30
  const costChanged = nextCost !== oldCost

  await client.query(
    `
      UPDATE products
      SET
        cost_price = CASE WHEN $3 = TRUE THEN $4 ELSE cost_price END,
        markup_percentage = CASE WHEN COALESCE(markup_percentage, 0) = 0 THEN $5 ELSE markup_percentage END,
        suggested_price = CASE
          WHEN COALESCE(suggested_price, 0) = 0
            OR (COALESCE(markup_percentage, 0) = 0 AND COALESCE(suggested_price, 0) = ROUND($4::numeric, 2))
            THEN ROUND($4 * (1 + $5 / 100.0), 2)
          ELSE suggested_price
        END,
        selling_price = CASE
          WHEN COALESCE(selling_price, 0) = 0
            OR (COALESCE(markup_percentage, 0) = 0 AND COALESCE(selling_price, 0) = ROUND($4::numeric, 2))
            THEN ROUND($4 * (1 + $5 / 100.0), 2)
          ELSE selling_price
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2
    `,
    [productId, tenantId, costChanged, Number(nextCost.toFixed(2)), resolvedMarkup],
  )

  if (costChanged) {
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
      SET
        markup_percentage = CASE WHEN COALESCE(markup_percentage, 0) = 0 THEN $3 ELSE markup_percentage END,
        suggested_price = CASE
          WHEN COALESCE(suggested_price, 0) = 0
            OR (COALESCE(markup_percentage, 0) = 0 AND COALESCE(suggested_price, 0) = ROUND($4::numeric, 2))
            THEN ROUND($4 * (1 + $3 / 100.0), 2)
          ELSE suggested_price
        END
      WHERE tenant_id = $2
        AND product_id = $1
        AND (is_default = TRUE OR channel_key = 'retail')
    `,
    [productId, tenantId, resolvedMarkup, nextCost],
  )
}

async function loadWarehouseStockRows(client, variantId, warehouseId, tenantId) {
  const result = await client.query(
    `
      SELECT
        id,
        location_id,
        quantity,
        allocated_quantity
      FROM stock_levels
      WHERE variant_id = $1
        AND warehouse_id = $2
        AND tenant_id = $3
      ORDER BY quantity DESC, allocated_quantity DESC, id ASC
    `,
    [variantId, warehouseId, tenantId],
  )

  return result.rows.map((row) => ({
    id: Number(row.id),
    locationId: row.location_id ? Number(row.location_id) : null,
    quantity: Number(row.quantity || 0),
    allocatedQuantity: Number(row.allocated_quantity || 0),
  }))
}

async function applyWarehouseAllocation(client, variantId, warehouseId, tenantId, allocationQty, mode) {
  const rows = await loadWarehouseStockRows(client, variantId, warehouseId, tenantId)

  if (rows.length === 0) {
    throw new Error('No stock row found for this warehouse.')
  }

  const totalOnHand = rows.reduce((sum, row) => sum + row.quantity, 0)
  const totalAllocated = rows.reduce((sum, row) => sum + row.allocatedQuantity, 0)

  if (mode === 'reserve' && totalAllocated + allocationQty > totalOnHand) {
    throw new Error('Allocated quantity cannot exceed on hand quantity.')
  }

  if (mode === 'release' && totalAllocated - allocationQty < 0) {
    throw new Error('Allocated quantity cannot be negative.')
  }

  const workingRows = rows.map((row) => ({ ...row }))
  let remaining = allocationQty

  if (mode === 'reserve') {
    // 中文注释：预留时优先占用可用数量最多的仓位，避免把同一批预留拆得太碎。
    workingRows.sort((left, right) => {
      const leftAvailable = left.quantity - left.allocatedQuantity
      const rightAvailable = right.quantity - right.allocatedQuantity
      return rightAvailable - leftAvailable
    })

    for (const row of workingRows) {
      if (remaining <= 0) break
      const available = row.quantity - row.allocatedQuantity
      if (available <= 0) continue
      const reserved = Math.min(available, remaining)
      row.allocatedQuantity += reserved
      remaining -= reserved
    }
  } else {
    // 中文注释：释放时优先从已预留最多的仓位回退，逻辑更容易追踪。
    workingRows.sort((left, right) => right.allocatedQuantity - left.allocatedQuantity)

    for (const row of workingRows) {
      if (remaining <= 0) break
      if (row.allocatedQuantity <= 0) continue
      const released = Math.min(row.allocatedQuantity, remaining)
      row.allocatedQuantity -= released
      remaining -= released
    }
  }

  if (remaining > 0) {
    throw new Error(mode === 'reserve' ? 'Allocated quantity cannot exceed on hand quantity.' : 'Allocated quantity cannot be negative.')
  }

  await Promise.all(
    workingRows.map((row) =>
      client.query(
        `
          UPDATE stock_levels
          SET allocated_quantity = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND tenant_id = $3
        `,
        [row.id, row.allocatedQuantity, tenantId],
      )),
  )

  return {
    totalOnHand,
    totalAllocated: workingRows.reduce((sum, row) => sum + row.allocatedQuantity, 0),
  }
}

async function createMovement(req, res, movementType) {
  const {
    variantId,
    productId,
    warehouseId,
    sourceWarehouseId,
    destinationWarehouseId,
    quantity,
    referenceNo,
    notes,
    supplierId,
    unitCost,
    purchaseReason,
    locationId,
    locationCode,
    locationName,
    zone,
    shelf,
    bin,
    level,
    sourceLocationId,
    destinationLocationId,
  } = req.body
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
      const destinationLocation = await resolveLocation(
        client,
        tenantId,
        warehouseId,
        { locationId, locationCode, locationName, zone, shelf, bin, level },
        true,
      )

      await ensureStockRow(
        client,
        resolvedVariantId,
        resolvedProductId,
        warehouseId,
        tenantId,
        destinationLocation?.id || null,
      )
      const currentStock = await getStockQuantity(
        client,
        resolvedVariantId,
        warehouseId,
        tenantId,
        destinationLocation?.id || null,
      )
      await updateStock(
        client,
        resolvedVariantId,
        warehouseId,
        currentStock.onHandQuantity + movementQty,
        currentStock.allocatedQuantity,
        tenantId,
        destinationLocation?.id || null,
      )

      const result = await client.query(
        `
          INSERT INTO stock_movements (
            tenant_id,
            movement_type,
            variant_id,
            product_id,
            destination_warehouse_id,
            destination_location_id,
            quantity,
            reference_no,
            notes,
            supplier_id,
            unit_cost,
            purchase_reason,
            created_by
          )
          VALUES ($1, 'IN', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `,
        [
          tenantId,
          resolvedVariantId,
          resolvedProductId,
          warehouseId,
          destinationLocation?.id || null,
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
      const resolvedSourceLocation = await resolveLocation(
        client,
        tenantId,
        warehouseId,
        { locationId, locationCode },
        false,
      )

      await ensureStockRow(
        client,
        resolvedVariantId,
        resolvedProductId,
        warehouseId,
        tenantId,
        resolvedSourceLocation?.id || null,
      )
      const currentStock = await getStockQuantity(
        client,
        resolvedVariantId,
        warehouseId,
        tenantId,
        resolvedSourceLocation?.id || null,
      )
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
        resolvedSourceLocation?.id || null,
      )

      const result = await client.query(
        `
          INSERT INTO stock_movements (
            tenant_id,
            movement_type,
            variant_id,
            product_id,
            source_warehouse_id,
            source_location_id,
            quantity,
            reference_no,
            notes,
            created_by
          )
          VALUES ($1, 'OUT', $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `,
        [
          tenantId,
          resolvedVariantId,
          resolvedProductId,
          warehouseId,
          resolvedSourceLocation?.id || null,
          movementQty,
          referenceNo || null,
          notes || null,
          req.user.id,
        ],
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
    const resolvedSourceLocation = await resolveLocation(
      client,
      tenantId,
      sourceWarehouseId,
      { locationId: sourceLocationId },
      false,
    )
    const resolvedDestinationLocation = await resolveLocation(
      client,
      tenantId,
      destinationWarehouseId,
      { locationId: destinationLocationId },
      false,
    )

    await ensureStockRow(
      client,
      resolvedVariantId,
      resolvedProductId,
      sourceWarehouseId,
      tenantId,
      resolvedSourceLocation?.id || null,
    )
    await ensureStockRow(
      client,
      resolvedVariantId,
      resolvedProductId,
      destinationWarehouseId,
      tenantId,
      resolvedDestinationLocation?.id || null,
    )

    const sourceStock = await getStockQuantity(
      client,
      resolvedVariantId,
      sourceWarehouseId,
      tenantId,
      resolvedSourceLocation?.id || null,
    )
    const sourceAvailable = sourceStock.onHandQuantity - sourceStock.allocatedQuantity

    if (sourceAvailable < movementQty) {
      throw new Error('Not enough stock for transfer.')
    }

    const destinationStock = await getStockQuantity(
      client,
      resolvedVariantId,
      destinationWarehouseId,
      tenantId,
      resolvedDestinationLocation?.id || null,
    )

    await updateStock(
      client,
      resolvedVariantId,
      sourceWarehouseId,
      sourceStock.onHandQuantity - movementQty,
      sourceStock.allocatedQuantity,
      tenantId,
      resolvedSourceLocation?.id || null,
    )
    await updateStock(
      client,
      resolvedVariantId,
      destinationWarehouseId,
      destinationStock.onHandQuantity + movementQty,
      destinationStock.allocatedQuantity,
      tenantId,
      resolvedDestinationLocation?.id || null,
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
          source_location_id,
          destination_location_id,
          quantity,
          reference_no,
          notes,
          created_by
        )
        VALUES ($1, 'TRANSFER', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `,
      [
        tenantId,
        resolvedVariantId,
        resolvedProductId,
        sourceWarehouseId,
        destinationWarehouseId,
        resolvedSourceLocation?.id || null,
        resolvedDestinationLocation?.id || null,
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

    const allocationResult = await applyWarehouseAllocation(
      client,
      resolvedVariantId,
      warehouseId,
      tenantId,
      allocationQty,
      normalizedMode,
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
      on_hand_quantity: allocationResult.totalOnHand,
      order_allocated_quantity: allocationResult.totalAllocated,
      warehouse_available_quantity: allocationResult.totalOnHand - allocationResult.totalAllocated,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    return res.status(400).json({ message: error.message })
  } finally {
    client.release()
  }
})

module.exports = router
