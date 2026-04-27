const express = require('express')
const { randomUUID } = require('crypto')
const { query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { writeAuditLog } = require('../utils/auditLog')
const { createRateLimiter } = require('../middleware/rateLimit')
const { syncMarketplaceInventory, getChannelConfig } = require('../services/marketplaceSyncService')
const { syncMarketplaceOrders } = require('../services/orderSyncService')

const router = express.Router()
const syncRateLimit = createRateLimiter({ namespace: 'marketplace-sync', windowMs: 60 * 1000, max: 12 })
const oauthRateLimit = createRateLimiter({ namespace: 'marketplace-oauth', windowMs: 60 * 1000, max: 20 })

router.use(authenticateToken)

function isSupportedChannel(channel) {
  return ['shopee', 'lazada', 'tiktok'].includes(channel)
}

async function logMarketplaceError({ channel, operation, errorCode, message, details, requestId, userId }) {
  await query(
    `
      INSERT INTO marketplace_error_logs (
        channel, operation, error_code, message, details, request_id, created_by
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
    `,
    [channel, operation, errorCode, message, JSON.stringify(details || {}), requestId || null, userId || null],
  )
}

async function logMarketplaceAudit(req, { action, entityId = null, description, metadata = {} }) {
  await writeAuditLog(query, {
    userId: req.user?.id || null,
    userEmail: req.user?.email || null,
    userRole: req.user?.role || null,
    action,
    entityType: 'MARKETPLACE',
    entityId,
    method: req.method,
    path: req.originalUrl,
    description,
    metadata,
  })
}

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

    return res.success({ items: result.rows })
  } catch (error) {
    return res.fail('MARKETPLACE_CONNECTIONS_LOAD_FAILED', 'Failed to load marketplace connections.', { error: error.message }, 500)
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

  if (!isSupportedChannel(channel)) {
    return res.fail('UNSUPPORTED_CHANNEL', 'Unsupported channel.', { channel }, 400)
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

    await logMarketplaceAudit(req, {
      action: 'MARKETPLACE_CONNECTION_UPSERT',
      entityId: channel,
      description: `Updated marketplace connection for ${channel}`,
      metadata: {
        channel,
        hasAccessToken: Boolean(accessToken),
        isActive: Boolean(isActive),
      },
    })

    return res.success(result.rows[0])
  } catch (error) {
    await logMarketplaceError({
      channel,
      operation: 'connection_upsert',
      errorCode: 'CONNECTION_SAVE_FAILED',
      message: error.message,
      details: { body: { shopName, apiBaseUrl, isActive } },
      requestId: req.requestId,
      userId: req.user?.id,
    })
    return res.fail('MARKETPLACE_CONNECTION_SAVE_FAILED', 'Failed to save marketplace connection.', { error: error.message }, 500)
  }
})

router.post(
  '/sync/:channel',
  authorizeRoles('ADMIN', 'MANAGER'),
  syncRateLimit,
  async (req, res) => {
    const channel = String(req.params.channel || '').toLowerCase()

    if (!isSupportedChannel(channel)) {
      return res.fail('UNSUPPORTED_CHANNEL', 'Unsupported channel.', { channel }, 400)
    }

    try {
      const result = await syncMarketplaceInventory(channel, req.user?.id)
      await logMarketplaceAudit(req, {
        action: 'MARKETPLACE_INVENTORY_SYNC',
        entityId: channel,
        description: `${channel} inventory sync completed`,
        metadata: {
          channel,
          status: 'SUCCESS',
          recordsCount: result.recordsCount,
        },
      })

      return res.success({
        message: `${channel} sync completed.`,
        ...result,
      })
    } catch (error) {
      await query(
        `
          INSERT INTO marketplace_sync_logs (channel, sync_type, status, records_count, raw_response, synced_by)
          VALUES ($1, 'inventory', 'FAILED', 0, $2::jsonb, $3)
        `,
        [channel, JSON.stringify({ error: error.message }), req.user?.id || null],
      )
      await logMarketplaceError({
        channel,
        operation: 'inventory_sync',
        errorCode: 'INVENTORY_SYNC_FAILED',
        message: error.message,
        details: {},
        requestId: req.requestId,
        userId: req.user?.id,
      })
      await logMarketplaceAudit(req, {
        action: 'MARKETPLACE_INVENTORY_SYNC',
        entityId: channel,
        description: `${channel} inventory sync failed`,
        metadata: {
          channel,
          status: 'FAILED',
          error: error.message,
        },
      })
      return res.fail('MARKETPLACE_SYNC_FAILED', error.message, { channel }, 400)
    }
  },
)

router.post('/oauth/:channel/start', authorizeRoles('ADMIN', 'MANAGER'), oauthRateLimit, async (req, res) => {
  const channel = String(req.params.channel || '').toLowerCase()
  const redirectUri = String(req.body?.redirectUri || '').trim()

  if (!isSupportedChannel(channel)) {
    return res.fail('UNSUPPORTED_CHANNEL', 'Unsupported channel.', { channel }, 400)
  }

  if (!redirectUri) {
    return res.fail('REDIRECT_URI_REQUIRED', 'redirectUri is required.', null, 400)
  }

  try {
    const stateToken = randomUUID().replace(/-/g, '')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const connectionResult = await query(
      `
        SELECT api_base_url, metadata
        FROM marketplace_connections
        WHERE channel = $1
        LIMIT 1
      `,
      [channel],
    )
    const metadata = connectionResult.rows[0]?.metadata || {}
    const authPath = metadata.authPath || '/oauth/authorize'
    const authBase = (connectionResult.rows[0]?.api_base_url || '').replace(/\/$/, '')
    const authorizeUrl = authBase
      ? `${authBase}${authPath}?state=${stateToken}&redirect_uri=${encodeURIComponent(redirectUri)}`
      : null

    await query(
      `
        INSERT INTO marketplace_oauth_states (channel, state_token, redirect_uri, expires_at, created_by)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [channel, stateToken, redirectUri, expiresAt, req.user.id],
    )

    await logMarketplaceAudit(req, {
      action: 'MARKETPLACE_OAUTH_START',
      entityId: channel,
      description: `Started OAuth flow for ${channel}`,
      metadata: { channel, redirectUri, stateToken },
    })

    return res.success({
      channel,
      state: stateToken,
      redirectUri,
      authorizeUrl,
      expiresAt,
    })
  } catch (error) {
    await logMarketplaceError({
      channel,
      operation: 'oauth_start',
      errorCode: 'OAUTH_START_FAILED',
      message: error.message,
      details: { redirectUri },
      requestId: req.requestId,
      userId: req.user?.id,
    })
    return res.fail('MARKETPLACE_OAUTH_START_FAILED', 'Failed to start OAuth flow.', { error: error.message }, 500)
  }
})

router.get('/oauth/:channel/callback', authorizeRoles('ADMIN', 'MANAGER'), oauthRateLimit, async (req, res) => {
  const channel = String(req.params.channel || '').toLowerCase()
  const state = String(req.query.state || '')
  const code = String(req.query.code || '')
  const oauthError = String(req.query.error || '')

  if (!isSupportedChannel(channel)) {
    return res.fail('UNSUPPORTED_CHANNEL', 'Unsupported channel.', { channel }, 400)
  }

  if (!state) {
    return res.fail('STATE_REQUIRED', 'state is required.', null, 400)
  }

  try {
    const stateResult = await query(
      `
        SELECT *
        FROM marketplace_oauth_states
        WHERE channel = $1 AND state_token = $2
        LIMIT 1
      `,
      [channel, state],
    )
    const stateRow = stateResult.rows[0]

    if (!stateRow) {
      return res.fail('INVALID_STATE', 'Invalid OAuth state.', null, 400)
    }

    if (new Date(stateRow.expires_at).getTime() < Date.now()) {
      return res.fail('STATE_EXPIRED', 'OAuth state expired.', null, 400)
    }

    if (oauthError) {
      await logMarketplaceError({
        channel,
        operation: 'oauth_callback',
        errorCode: 'OAUTH_PROVIDER_ERROR',
        message: oauthError,
        details: { state, code },
        requestId: req.requestId,
        userId: req.user?.id,
      })
      return res.fail('MARKETPLACE_OAUTH_FAILED', 'OAuth callback returned error.', { oauthError }, 400)
    }

    const connectionResult = await query(
      `
        SELECT metadata
        FROM marketplace_connections
        WHERE channel = $1
        LIMIT 1
      `,
      [channel],
    )
    const metadata = connectionResult.rows[0]?.metadata || {}
    metadata.oauth = {
      ...(metadata.oauth || {}),
      lastState: state,
      lastCode: code || null,
      lastSuccessAt: new Date().toISOString(),
    }

    await query(
      `
        INSERT INTO marketplace_connections (channel, metadata, updated_by, updated_at, is_active)
        VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP, TRUE)
        ON CONFLICT (channel)
        DO UPDATE SET
          metadata = EXCLUDED.metadata,
          updated_by = EXCLUDED.updated_by,
          updated_at = CURRENT_TIMESTAMP,
          is_active = TRUE
      `,
      [channel, JSON.stringify(metadata), req.user.id],
    )

    await query(`DELETE FROM marketplace_oauth_states WHERE id = $1`, [stateRow.id])
    await logMarketplaceAudit(req, {
      action: 'MARKETPLACE_OAUTH_CALLBACK',
      entityId: channel,
      description: `Completed OAuth callback for ${channel}`,
      metadata: { channel, state, hasCode: Boolean(code) },
    })

    return res.success({
      channel,
      connected: true,
      state,
      hasCode: Boolean(code),
    })
  } catch (error) {
    await logMarketplaceError({
      channel,
      operation: 'oauth_callback',
      errorCode: 'OAUTH_CALLBACK_FAILED',
      message: error.message,
      details: { state, code },
      requestId: req.requestId,
      userId: req.user?.id,
    })
    return res.fail('MARKETPLACE_OAUTH_CALLBACK_FAILED', 'Failed to handle OAuth callback.', { error: error.message }, 500)
  }
})

router.post('/connections/:channel/test', authorizeRoles('ADMIN', 'MANAGER'), syncRateLimit, async (req, res) => {
  const channel = String(req.params.channel || '').toLowerCase()
  if (!isSupportedChannel(channel)) {
    return res.fail('UNSUPPORTED_CHANNEL', 'Unsupported channel.', { channel }, 400)
  }

  try {
    const config = await getChannelConfig(channel)

    if (!config?.endpoint || !config?.token) {
      return res.fail('MISSING_CHANNEL_CONFIG', 'Channel endpoint/token not configured.', { channel }, 400)
    }

    const healthUrl = config.endpoint.replace(/\/inventory$/, '/health')
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Connection test failed with status ${response.status}`)
    }

    const payload = await response.json().catch(() => ({}))
    await logMarketplaceAudit(req, {
      action: 'MARKETPLACE_CONNECTION_TEST',
      entityId: channel,
      description: `Connection test passed for ${channel}`,
      metadata: { channel, status: 'SUCCESS' },
    })

    return res.success({
      channel,
      healthy: true,
      endpoint: config.endpoint,
      response: payload,
    })
  } catch (error) {
    await logMarketplaceError({
      channel,
      operation: 'connection_test',
      errorCode: 'CONNECTION_TEST_FAILED',
      message: error.message,
      details: {},
      requestId: req.requestId,
      userId: req.user?.id,
    })
    await logMarketplaceAudit(req, {
      action: 'MARKETPLACE_CONNECTION_TEST',
      entityId: channel,
      description: `Connection test failed for ${channel}`,
      metadata: { channel, status: 'FAILED', error: error.message },
    })
    return res.fail('MARKETPLACE_CONNECTION_TEST_FAILED', 'Connection test failed.', { error: error.message }, 400)
  }
})

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

    return res.success({ items: result.rows })
  } catch (error) {
    return res.fail('MARKETPLACE_SYNC_LOGS_LOAD_FAILED', 'Failed to load sync logs.', { error: error.message }, 500)
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

    return res.success({ items: result.rows })
  } catch (error) {
    return res.fail('MARKETPLACE_SNAPSHOTS_LOAD_FAILED', 'Failed to load marketplace snapshots.', { error: error.message }, 500)
  }
})

router.get('/status/overview', authorizeRoles('ADMIN', 'MANAGER'), async (_req, res) => {
  try {
    const [connectionsResult, syncResult, orderResult, shippingResult, errorsResult] = await Promise.all([
      query(
        `
          SELECT channel, shop_name, is_active, updated_at
          FROM marketplace_connections
          ORDER BY channel ASC
        `,
      ),
      query(
        `
          SELECT channel, MAX(synced_at) AS last_sync_at, COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed_sync_count
          FROM marketplace_sync_logs
          GROUP BY channel
        `,
      ),
      query(
        `
          SELECT channel, COUNT(*)::int AS total_orders
          FROM marketplace_orders
          GROUP BY channel
        `,
      ),
      query(
        `
          SELECT channel, COUNT(*)::int AS total_shipments
          FROM shipping_shipments
          GROUP BY channel
        `,
      ),
      query(
        `
          SELECT channel, COUNT(*)::int AS total_errors
          FROM marketplace_error_logs
          WHERE created_at >= NOW() - INTERVAL '7 days'
          GROUP BY channel
        `,
      ),
    ])

    const channels = ['shopee', 'lazada', 'tiktok']
    const toMap = (rows, key = 'channel') =>
      rows.reduce((acc, row) => {
        acc[row[key]] = row
        return acc
      }, {})

    const connMap = toMap(connectionsResult.rows)
    const syncMap = toMap(syncResult.rows)
    const orderMap = toMap(orderResult.rows)
    const shippingMap = toMap(shippingResult.rows)
    const errorMap = toMap(errorsResult.rows)

    const overview = channels.map((channel) => ({
      channel,
      connected: Boolean(connMap[channel]?.is_active),
      shopName: connMap[channel]?.shop_name || null,
      updatedAt: connMap[channel]?.updated_at || null,
      lastSyncAt: syncMap[channel]?.last_sync_at || null,
      failedSyncCount: Number(syncMap[channel]?.failed_sync_count || 0),
      totalOrders: Number(orderMap[channel]?.total_orders || 0),
      totalShipments: Number(shippingMap[channel]?.total_shipments || 0),
      errorsIn7Days: Number(errorMap[channel]?.total_errors || 0),
    }))

    return res.success({ items: overview })
  } catch (error) {
    return res.fail('MARKETPLACE_OVERVIEW_LOAD_FAILED', 'Failed to load marketplace status overview.', { error: error.message }, 500)
  }
})

router.get('/errors', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const channel = String(req.query.channel || '').toLowerCase()
  const { page, pageSize, offset } = require('../utils/pagination').getPaginationParams(req.query)

  if (channel && !isSupportedChannel(channel)) {
    return res.fail('UNSUPPORTED_CHANNEL', 'Unsupported channel.', { channel }, 400)
  }

  try {
    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT id, channel, operation, error_code, message, details, request_id, created_by, created_at
          FROM marketplace_error_logs
          WHERE ($1 = '' OR channel = $1)
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `,
        [channel, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM marketplace_error_logs
          WHERE ($1 = '' OR channel = $1)
        `,
        [channel],
      ),
    ])

    return res.success({
      items: itemsResult.rows,
      pagination: require('../utils/pagination').buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.fail('MARKETPLACE_ERRORS_LOAD_FAILED', 'Failed to load marketplace errors.', { error: error.message }, 500)
  }
})

router.post('/orders/sync/:channel', authorizeRoles('ADMIN', 'MANAGER'), syncRateLimit, async (req, res) => {
  const channel = String(req.params.channel || '').toLowerCase()
  if (!isSupportedChannel(channel)) {
    return res.fail('UNSUPPORTED_CHANNEL', 'Unsupported channel.', { channel }, 400)
  }

  try {
    const result = await syncMarketplaceOrders(channel, req.user?.id)
    await logMarketplaceAudit(req, {
      action: 'MARKETPLACE_ORDER_SYNC',
      entityId: channel,
      description: `${channel} order sync completed`,
      metadata: { channel, status: 'SUCCESS', recordsCount: result.recordsCount },
    })
    return res.success({
      message: `${channel} order sync completed.`,
      ...result,
    })
  } catch (error) {
    await query(
      `
        INSERT INTO marketplace_sync_logs (channel, sync_type, status, records_count, raw_response, synced_by)
        VALUES ($1, 'orders', 'FAILED', 0, $2::jsonb, $3)
      `,
      [channel, JSON.stringify({ error: error.message }), req.user?.id || null],
    )
    await logMarketplaceError({
      channel,
      operation: 'order_sync',
      errorCode: 'ORDER_SYNC_FAILED',
      message: error.message,
      details: {},
      requestId: req.requestId,
      userId: req.user?.id,
    })
    await logMarketplaceAudit(req, {
      action: 'MARKETPLACE_ORDER_SYNC',
      entityId: channel,
      description: `${channel} order sync failed`,
      metadata: { channel, status: 'FAILED', error: error.message },
    })
    return res.fail('MARKETPLACE_ORDER_SYNC_FAILED', error.message, { channel }, 400)
  }
})

module.exports = router
