const express = require('express')
const { query } = require('../config/db')
const { authenticateToken } = require('../middleware/auth')

const router = express.Router()

router.use(authenticateToken)

// 仪表盘汇总：卡片数据 + 最近流水
router.get('/summary', async (_req, res) => {
  try {
    const [
      productCount,
      warehouseCount,
      lowStockCount,
      totalOnHand,
      recentMovements,
      lowStockPreview,
      movementTrend,
      stockByWarehouse,
      stockByCategory,
    ] =
      await Promise.all([
        query('SELECT COUNT(*)::int AS count FROM products WHERE is_active = TRUE'),
        query('SELECT COUNT(*)::int AS count FROM warehouses WHERE is_active = TRUE'),
        query(
          `
            SELECT COUNT(*)::int AS count
            FROM stock_levels
            INNER JOIN products ON products.id = stock_levels.product_id
            WHERE stock_levels.quantity <= products.reorder_level
          `,
        ),
        query('SELECT COALESCE(SUM(quantity), 0)::int AS total FROM stock_levels'),
        query(
          `
            SELECT
              stock_movements.id,
              stock_movements.movement_type,
              stock_movements.quantity,
              stock_movements.created_at,
              products.name AS product_name,
              products.sku
            FROM stock_movements
            INNER JOIN products ON products.id = stock_movements.product_id
            ORDER BY stock_movements.created_at DESC
            LIMIT 10
          `,
        ),
        query(
          `
            SELECT
              products.name AS product_name,
              products.sku,
              warehouses.name AS warehouse_name,
              stock_levels.quantity,
              products.reorder_level
            FROM stock_levels
            INNER JOIN products ON products.id = stock_levels.product_id
            INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id
            WHERE stock_levels.quantity <= products.reorder_level
            ORDER BY (products.reorder_level - stock_levels.quantity) DESC, products.name ASC
            LIMIT 5
          `,
        ),
        query(
          `
            SELECT
              TO_CHAR(DATE_TRUNC('month', stock_movements.created_at), 'YYYY-MM') AS month,
              COUNT(*)::int AS total
            FROM stock_movements
            WHERE stock_movements.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
            GROUP BY DATE_TRUNC('month', stock_movements.created_at)
            ORDER BY DATE_TRUNC('month', stock_movements.created_at) ASC
          `,
        ),
        query(
          `
            SELECT
              warehouses.name AS label,
              COALESCE(SUM(stock_levels.quantity), 0)::int AS total
            FROM warehouses
            LEFT JOIN stock_levels ON stock_levels.warehouse_id = warehouses.id
            GROUP BY warehouses.id, warehouses.name
            ORDER BY total DESC, warehouses.name ASC
          `,
        ),
        query(
          `
            SELECT
              COALESCE(categories.name, 'Uncategorized') AS label,
              COALESCE(SUM(stock_levels.quantity), 0)::int AS total
            FROM stock_levels
            INNER JOIN products ON products.id = stock_levels.product_id
            LEFT JOIN categories ON categories.id = products.category_id
            GROUP BY COALESCE(categories.name, 'Uncategorized')
            ORDER BY total DESC, label ASC
          `,
        ),
      ])

    return res.json({
      cards: {
        products: productCount.rows[0].count,
        warehouses: warehouseCount.rows[0].count,
        lowStockItems: lowStockCount.rows[0].count,
        totalOnHand: totalOnHand.rows[0].total,
      },
      recentMovements: recentMovements.rows,
      lowStockPreview: lowStockPreview.rows,
      charts: {
        movementTrend: movementTrend.rows,
        stockByWarehouse: stockByWarehouse.rows,
        stockByCategory: stockByCategory.rows,
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load dashboard summary.', error: error.message })
  }
})

module.exports = router
