const express = require('express')
const { query } = require('../config/db')
const { authenticateToken } = require('../middleware/auth')
const { getTenantId } = require('../utils/tenant')

const router = express.Router()

router.use(authenticateToken)

// 仪表盘汇总：卡片数据 + 最近流水（按 tenant_id 隔离）
router.get('/summary', async (req, res) => {
  const tenantId = getTenantId(req)
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
        query('SELECT COUNT(*)::int AS count FROM products WHERE is_active = TRUE AND tenant_id = $1', [tenantId]),
        query('SELECT COUNT(*)::int AS count FROM warehouses WHERE is_active = TRUE AND tenant_id = $1', [tenantId]),
        query(
          `
            SELECT COUNT(*)::int AS count
            FROM stock_levels
            INNER JOIN products ON products.id = stock_levels.product_id AND products.tenant_id = stock_levels.tenant_id
            WHERE stock_levels.quantity <= products.reorder_level
              AND stock_levels.tenant_id = $1
          `,
          [tenantId],
        ),
        query('SELECT COALESCE(SUM(quantity), 0)::int AS total FROM stock_levels WHERE tenant_id = $1', [tenantId]),
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
            INNER JOIN products ON products.id = stock_movements.product_id AND products.tenant_id = stock_movements.tenant_id
            WHERE stock_movements.tenant_id = $1
            ORDER BY stock_movements.created_at DESC
            LIMIT 10
          `,
          [tenantId],
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
            INNER JOIN products ON products.id = stock_levels.product_id AND products.tenant_id = stock_levels.tenant_id
            INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id AND warehouses.tenant_id = stock_levels.tenant_id
            WHERE stock_levels.quantity <= products.reorder_level
              AND stock_levels.tenant_id = $1
            ORDER BY (products.reorder_level - stock_levels.quantity) DESC, products.name ASC
            LIMIT 5
          `,
          [tenantId],
        ),
        query(
          `
            SELECT
              TO_CHAR(DATE_TRUNC('month', stock_movements.created_at), 'YYYY-MM') AS month,
              COUNT(*)::int AS total
            FROM stock_movements
            WHERE stock_movements.created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
              AND stock_movements.tenant_id = $1
            GROUP BY DATE_TRUNC('month', stock_movements.created_at)
            ORDER BY DATE_TRUNC('month', stock_movements.created_at) ASC
          `,
          [tenantId],
        ),
        query(
          `
            SELECT
              warehouses.name AS label,
              COALESCE(SUM(stock_levels.quantity), 0)::int AS total
            FROM warehouses
            LEFT JOIN stock_levels ON stock_levels.warehouse_id = warehouses.id AND stock_levels.tenant_id = warehouses.tenant_id
            WHERE warehouses.tenant_id = $1
            GROUP BY warehouses.id, warehouses.name
            ORDER BY total DESC, warehouses.name ASC
          `,
          [tenantId],
        ),
        query(
          `
            SELECT
              COALESCE(categories.name, 'Uncategorized') AS label,
              COALESCE(SUM(stock_levels.quantity), 0)::int AS total
            FROM stock_levels
            INNER JOIN products ON products.id = stock_levels.product_id AND products.tenant_id = stock_levels.tenant_id
            LEFT JOIN categories ON categories.id = products.category_id AND categories.tenant_id = products.tenant_id
            WHERE stock_levels.tenant_id = $1
            GROUP BY COALESCE(categories.name, 'Uncategorized')
            ORDER BY total DESC, label ASC
          `,
          [tenantId],
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
