const { query } = require('../config/db')

const channelConfigs = {
  shopee: {
    endpoint: process.env.SHOPEE_SYNC_ENDPOINT,
    token: process.env.SHOPEE_ACCESS_TOKEN,
  },
  lazada: {
    endpoint: process.env.LAZADA_SYNC_ENDPOINT,
    token: process.env.LAZADA_ACCESS_TOKEN,
  },
  tiktok: {
    endpoint: process.env.TIKTOK_SYNC_ENDPOINT,
    token: process.env.TIKTOK_ACCESS_TOKEN,
  },
}

async function getChannelConfig(channel) {
  const dbResult = await query(
    `
      SELECT channel, api_base_url, access_token
      FROM marketplace_connections
      WHERE channel = $1 AND is_active = TRUE
      LIMIT 1
    `,
    [channel],
  )

  if (dbResult.rows[0]?.api_base_url && dbResult.rows[0]?.access_token) {
    return {
      endpoint: `${String(dbResult.rows[0].api_base_url).replace(/\/$/, '')}/inventory`,
      token: dbResult.rows[0].access_token,
    }
  }

  return channelConfigs[channel]
}

function normalizeRecords(payload) {
  const sourceItems = Array.isArray(payload?.items) ? payload.items : []

  return sourceItems.map((item) => {
    const onHandQuantity = Number(item.onHand ?? item.on_hand ?? item.quantity ?? 0)
    const allocatedQuantity = Number(item.allocated ?? item.order_allocated ?? 0)
    const availableQuantity = Number(
      item.available ?? item.warehouse_available ?? Math.max(onHandQuantity - allocatedQuantity, 0),
    )

    return {
      externalSku: String(item.sku || item.externalSku || '').trim(),
      warehouseCode: String(item.warehouseCode || item.warehouse_code || '').trim(),
      onHandQuantity,
      allocatedQuantity,
      availableQuantity,
      rawPayload: item,
    }
  })
}

async function saveSnapshots(channel, normalizedRecords) {
  await query(`DELETE FROM marketplace_inventory_snapshots WHERE channel = $1`, [channel])

  for (const item of normalizedRecords) {
    const warehouseResult = item.warehouseCode
      ? await query(`SELECT id FROM warehouses WHERE code = $1 LIMIT 1`, [item.warehouseCode])
      : { rows: [] }

    const productResult = item.externalSku
      ? await query(`SELECT id FROM products WHERE sku = $1 LIMIT 1`, [item.externalSku])
      : { rows: [] }

    await query(
      `
        INSERT INTO marketplace_inventory_snapshots (
          channel,
          external_sku,
          product_id,
          warehouse_id,
          on_hand,
          allocated_quantity,
          available_quantity,
          payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        channel,
        item.externalSku || 'UNKNOWN',
        productResult.rows[0]?.id || null,
        warehouseResult.rows[0]?.id || null,
        item.onHandQuantity,
        item.allocatedQuantity,
        item.availableQuantity,
        JSON.stringify(item.rawPayload || {}),
      ],
    )
  }
}

async function syncMarketplaceInventory(channel, userId) {
  const config = await getChannelConfig(channel)

  if (!config) {
    throw new Error(`Unsupported channel: ${channel}`)
  }

  if (!config.endpoint || !config.token) {
    throw new Error(`Missing ${channel} endpoint or token. Please set environment variables.`)
  }

  const response = await fetch(config.endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`${channel} sync failed with status ${response.status}`)
  }

  const payload = await response.json()
  const normalizedRecords = normalizeRecords(payload).filter((item) => item.externalSku)

  await saveSnapshots(channel, normalizedRecords)

  await query(
    `
      INSERT INTO marketplace_sync_logs (channel, sync_type, status, records_count, raw_response, synced_by)
      VALUES ($1, 'inventory', 'SUCCESS', $2, $3::jsonb, $4)
    `,
    [channel, normalizedRecords.length, JSON.stringify(payload || {}), userId || null],
  )

  return {
    channel,
    recordsCount: normalizedRecords.length,
  }
}

module.exports = {
  syncMarketplaceInventory,
  getChannelConfig,
}
