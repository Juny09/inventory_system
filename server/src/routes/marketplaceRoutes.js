const express = require('express')
const { query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { syncMarketplaceInventory } = require('../services/marketplaceSyncService')

const router = express.Router()

router.use(authenticateToken)

router.get('/connections', authorizeRoles('ADMIN', 'MANAGER'), async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          id,
          channel,
          shop_name,
          api_base_url,
          CASE WHEN COALESCE(access_token, '') = '' THEN FALSE ELSE TRUE END AS has_access_token,
          metadata,
          is_active,
          updated_by,
          updated_at
        FROM marketplace_connections
        ORDER BY channel ASC
      `,
    )

    return res.json({ items: result.rows })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load marketplace connections.', error: error.message })
  }
})

router.put('/connections/:channel', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const channel = String(req.params.channel || '').toLowerCase()
  const {
    shopName = '',
    apiBaseUrl = '',
    accessToken = '',
    refreshToken = '',
    metadata = {},
    isActive = true,
  } = req.body

  if (!['shopee', 'lazada', 'tiktok'].includes(channel)) {
    return res.status(400).json({ message: 'Unsupported channel.' })
  }

  try {
    const result = await query(
      `
        INSERT INTO marketplace_connections (
          channel, shop_name, api_base_url, access_token, refresh_token, metadata, is_active, updated_by, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, CURRENT_TIMESTAMP)
        ON CONFLICT (channel)
        DO UPDATE SET
          shop_name = EXCLUDED.shop_name,
          api_base_url = EXCLUDED.api_base_url,
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          metadata = EXCLUDED.metadata,
          is_active = EXCLUDED.is_active,
          updated_by = EXCLUDED.updated_by,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, channel, shop_name, api_base_url, is_active, updated_at
      `,
      [
        channel,
        shopName || null,
        apiBaseUrl || null,
        accessToken || null,
        refreshToken || null,
        JSON.stringify(metadata || {}),
        Boolean(isActive),
        req.user.id,
      ],
    )

    return res.json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save marketplace connection.', error: error.message })
  }
})

router.post(
  '/sync/:channel',
  authorizeRoles('ADMIN', 'MANAGER'),
  async (req, res) => {
    const channel = String(req.params.channel || '').toLowerCase()

    try {
      const result = await syncMarketplaceInventory(channel, req.user?.id)
      return res.json({
        message: `${channel} sync completed.`,
        ...result,
      })
    } catch (error) {
      return res.status(400).json({ message: error.message })
    }
  },
)

router.get('/sync-logs', authorizeRoles('ADMIN', 'MANAGER'), async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          marketplace_sync_logs.*,
          users.full_name AS synced_by_name
        FROM marketplace_sync_logs
        LEFT JOIN users ON users.id = marketplace_sync_logs.synced_by
        ORDER BY marketplace_sync_logs.synced_at DESC
        LIMIT 50
      `,
    )

    return res.json({ items: result.rows })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load sync logs.', error: error.message })
  }
})

router.get('/snapshots', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const channel = String(req.query.channel || '').toLowerCase()

  try {
    const result = await query(
      `
        SELECT
          marketplace_inventory_snapshots.*,
          products.name AS product_name,
          products.sku AS product_sku,
          warehouses.name AS warehouse_name
        FROM marketplace_inventory_snapshots
        LEFT JOIN products ON products.id = marketplace_inventory_snapshots.product_id
        LEFT JOIN warehouses ON warehouses.id = marketplace_inventory_snapshots.warehouse_id
        WHERE ($1 = '' OR marketplace_inventory_snapshots.channel = $1)
        ORDER BY marketplace_inventory_snapshots.synced_at DESC
        LIMIT 500
      `,
      [channel],
    )

    return res.json({ items: result.rows })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load marketplace snapshots.', error: error.message })
  }
})

module.exports = router
