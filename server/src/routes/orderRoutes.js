const express = require('express')
const { query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { syncMarketplaceOrders } = require('../services/orderSyncService')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const { createRateLimiter } = require('../middleware/rateLimit')

const router = express.Router()
const syncRateLimit = createRateLimiter({ namespace: 'orders-sync', windowMs: 60 * 1000, max: 12 })

router.use(authenticateToken)

router.post('/sync/:channel', authorizeRoles('ADMIN', 'MANAGER'), syncRateLimit, async (req, res) => {
  const channel = String(req.params.channel || '').toLowerCase()

  if (!['shopee', 'lazada', 'tiktok'].includes(channel)) {
    return res.status(400).json({ message: 'Unsupported channel.' })
  }

  try {
    const result = await syncMarketplaceOrders(channel, req.user?.id)
    return res.json({
      message: `${channel} order sync completed.`,
      ...result,
    })
  } catch (error) {
    return res.status(400).json({ message: error.message })
  }
})

router.get('/', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  const { channel = '', status = 'all', search = '' } = req.query
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = `%${String(search || '').trim()}%`

  try {
    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            marketplace_orders.*,
            COUNT(marketplace_order_items.id)::int AS item_count
          FROM marketplace_orders
          LEFT JOIN marketplace_order_items ON marketplace_order_items.marketplace_order_id = marketplace_orders.id
          WHERE ($1 = '' OR marketplace_orders.channel = $1)
            AND ($2 = 'all' OR marketplace_orders.order_status = $2)
            AND (
              $3 = '%%'
              OR marketplace_orders.external_order_id ILIKE $3
              OR COALESCE(marketplace_orders.buyer_name, '') ILIKE $3
            )
          GROUP BY marketplace_orders.id
          ORDER BY marketplace_orders.order_created_at DESC NULLS LAST, marketplace_orders.synced_at DESC
          LIMIT $4 OFFSET $5
        `,
        [String(channel).toLowerCase(), String(status).toUpperCase(), searchPattern, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM marketplace_orders
          WHERE ($1 = '' OR marketplace_orders.channel = $1)
            AND ($2 = 'all' OR marketplace_orders.order_status = $2)
            AND (
              $3 = '%%'
              OR marketplace_orders.external_order_id ILIKE $3
              OR COALESCE(marketplace_orders.buyer_name, '') ILIKE $3
            )
        `,
        [String(channel).toLowerCase(), String(status).toUpperCase(), searchPattern],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch orders.', error: error.message })
  }
})

router.get('/:id', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  try {
    const [orderResult, itemsResult] = await Promise.all([
      query(`SELECT * FROM marketplace_orders WHERE id = $1`, [req.params.id]),
      query(
        `
          SELECT marketplace_order_items.*, products.name AS product_name, products.sku AS product_sku
          FROM marketplace_order_items
          LEFT JOIN products ON products.id = marketplace_order_items.product_id
          WHERE marketplace_order_items.marketplace_order_id = $1
          ORDER BY marketplace_order_items.id ASC
        `,
        [req.params.id],
      ),
    ])

    if (!orderResult.rows[0]) {
      return res.status(404).json({ message: 'Order not found.' })
    }

    return res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch order detail.', error: error.message })
  }
})

module.exports = router
