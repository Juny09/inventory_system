const express = require('express')
const { query } = require('../config/db')
const { authenticateToken } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const { canViewCost } = require('../utils/costAccess')

const router = express.Router()

router.use(authenticateToken)

function getSearchPattern(search) {
  return `%${String(search || '').trim()}%`
}

// 当前库存报表支持搜索和分页，导出时前端可拉取更大页码
router.get('/inventory', async (req, res) => {
  const { search = '', all = 'false' } = req.query
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = getSearchPattern(search)
  const allowCostAccess = canViewCost(req)

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT
            products.name AS product_name,
            products.sku,
            products.barcode,
            warehouses.name AS warehouse_name,
            stock_levels.quantity AS on_hand_quantity,
            stock_levels.allocated_quantity AS order_allocated_quantity,
            GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) AS warehouse_available_quantity,
            products.reorder_level,
            products.cost_price,
            ROUND(GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) * products.cost_price, 2) AS stock_value
          FROM stock_levels
          INNER JOIN products ON products.id = stock_levels.product_id
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id
          LEFT JOIN categories ON categories.id = products.category_id
          WHERE (
            $1 = '%%'
            OR products.name ILIKE $1
            OR products.sku ILIKE $1
            OR products.barcode ILIKE $1
            OR warehouses.name ILIKE $1
            OR categories.name ILIKE $1
          )
          ORDER BY products.name ASC, warehouses.name ASC
        `,
        [searchPattern],
      )

      return res.json({
        items: result.rows.map((row) => ({
          ...row,
          cost_price: allowCostAccess ? row.cost_price : null,
          stock_value: allowCostAccess ? row.stock_value : null,
        })),
        pagination: buildPagination(result.rows.length, 1, result.rows.length || 1),
      })
    }

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            products.name AS product_name,
            products.sku,
            products.barcode,
            warehouses.name AS warehouse_name,
            stock_levels.quantity AS on_hand_quantity,
            stock_levels.allocated_quantity AS order_allocated_quantity,
            GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) AS warehouse_available_quantity,
            products.reorder_level,
            products.cost_price,
            ROUND(GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) * products.cost_price, 2) AS stock_value
          FROM stock_levels
          INNER JOIN products ON products.id = stock_levels.product_id
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id
          LEFT JOIN categories ON categories.id = products.category_id
          WHERE (
            $1 = '%%'
            OR products.name ILIKE $1
            OR products.sku ILIKE $1
            OR products.barcode ILIKE $1
            OR warehouses.name ILIKE $1
            OR categories.name ILIKE $1
          )
          ORDER BY products.name ASC, warehouses.name ASC
          LIMIT $2 OFFSET $3
        `,
        [searchPattern, pageSize, offset],
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
            OR warehouses.name ILIKE $1
            OR categories.name ILIKE $1
          )
        `,
        [searchPattern],
      ),
    ])

    return res.json({
      items: itemsResult.rows.map((row) => ({
        ...row,
        cost_price: allowCostAccess ? row.cost_price : null,
        stock_value: allowCostAccess ? row.stock_value : null,
      })),
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch inventory report.', error: error.message })
  }
})

// 流水报表支持时间范围、关键词搜索和分页
router.get('/movements', async (req, res) => {
  const { startDate, endDate, search = '', all = 'false' } = req.query
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = getSearchPattern(search)

  try {
    if (loadAll) {
      const result = await query(
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
          WHERE ($1::timestamp IS NULL OR stock_movements.created_at >= $1::timestamp)
            AND ($2::timestamp IS NULL OR stock_movements.created_at <= $2::timestamp)
            AND (
              $3 = '%%'
              OR products.name ILIKE $3
              OR products.sku ILIKE $3
              OR stock_movements.reference_no ILIKE $3
              OR stock_movements.movement_type ILIKE $3
              OR source_warehouse.name ILIKE $3
              OR destination_warehouse.name ILIKE $3
              OR users.full_name ILIKE $3
            )
          ORDER BY stock_movements.created_at DESC
        `,
        [startDate || null, endDate || null, searchPattern],
      )

      return res.json({
        items: result.rows,
        pagination: buildPagination(result.rows.length, 1, result.rows.length || 1),
      })
    }

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
          WHERE ($1::timestamp IS NULL OR stock_movements.created_at >= $1::timestamp)
            AND ($2::timestamp IS NULL OR stock_movements.created_at <= $2::timestamp)
            AND (
              $3 = '%%'
              OR products.name ILIKE $3
              OR products.sku ILIKE $3
              OR stock_movements.reference_no ILIKE $3
              OR stock_movements.movement_type ILIKE $3
              OR source_warehouse.name ILIKE $3
              OR destination_warehouse.name ILIKE $3
              OR users.full_name ILIKE $3
            )
          ORDER BY stock_movements.created_at DESC
          LIMIT $4 OFFSET $5
        `,
        [startDate || null, endDate || null, searchPattern, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM stock_movements
          INNER JOIN products ON products.id = stock_movements.product_id
          LEFT JOIN warehouses AS source_warehouse ON source_warehouse.id = stock_movements.source_warehouse_id
          LEFT JOIN warehouses AS destination_warehouse ON destination_warehouse.id = stock_movements.destination_warehouse_id
          LEFT JOIN users ON users.id = stock_movements.created_by
          WHERE ($1::timestamp IS NULL OR stock_movements.created_at >= $1::timestamp)
            AND ($2::timestamp IS NULL OR stock_movements.created_at <= $2::timestamp)
            AND (
              $3 = '%%'
              OR products.name ILIKE $3
              OR products.sku ILIKE $3
              OR stock_movements.reference_no ILIKE $3
              OR stock_movements.movement_type ILIKE $3
              OR source_warehouse.name ILIKE $3
              OR destination_warehouse.name ILIKE $3
              OR users.full_name ILIKE $3
            )
        `,
        [startDate || null, endDate || null, searchPattern],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch movement report.', error: error.message })
  }
})

module.exports = router
