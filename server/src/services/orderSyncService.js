const { query } = require('../config/db')
const { getChannelConfig } = require('./marketplaceSyncService')

function normalizeOrders(payload) {
  const sourceItems = Array.isArray(payload?.items) ? payload.items : []

  return sourceItems.map((item) => ({
    externalOrderId: String(item.orderId || item.externalOrderId || '').trim(),
    orderStatus: String(item.status || 'PENDING').toUpperCase(),
    buyerName: String(item.buyerName || item.customerName || '').trim() || null,
    totalAmount: Number(item.totalAmount || item.amount || 0),
    currency: String(item.currency || 'USD').toUpperCase(),
    orderCreatedAt: item.orderCreatedAt || item.createdAt || null,
    items: Array.isArray(item.items) ? item.items : [],
    payload: item,
  }))
}

async function syncMarketplaceOrders(channel, userId) {
  const config = await getChannelConfig(channel)

  if (!config?.endpoint || !config?.token) {
    throw new Error(`Missing ${channel} endpoint or token. Please configure marketplace connection first.`)
  }

  const endpoint = config.endpoint.replace(/\/inventory$/, '/orders')
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`${channel} order sync failed with status ${response.status}`)
  }

  const payload = await response.json()
  const normalizedOrders = normalizeOrders(payload).filter((item) => item.externalOrderId)

  for (const order of normalizedOrders) {
    const orderResult = await query(
      `
        INSERT INTO marketplace_orders (
          channel, external_order_id, order_status, buyer_name, total_amount, currency, order_created_at, payload, synced_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (channel, external_order_id)
        DO UPDATE SET
          order_status = EXCLUDED.order_status,
          buyer_name = EXCLUDED.buyer_name,
          total_amount = EXCLUDED.total_amount,
          currency = EXCLUDED.currency,
          order_created_at = EXCLUDED.order_created_at,
          payload = EXCLUDED.payload,
          synced_at = CURRENT_TIMESTAMP
        RETURNING id
      `,
      [
        channel,
        order.externalOrderId,
        order.orderStatus,
        order.buyerName,
        Number(order.totalAmount || 0),
        order.currency,
        order.orderCreatedAt,
        JSON.stringify(order.payload || {}),
      ],
    )

    const marketplaceOrderId = orderResult.rows[0].id

    await query(`DELETE FROM marketplace_order_items WHERE marketplace_order_id = $1`, [marketplaceOrderId])

    for (const item of order.items) {
      const externalSku = String(item.sku || item.externalSku || '').trim()
      const matchedProduct = externalSku
        ? await query(`SELECT id FROM products WHERE sku = $1 LIMIT 1`, [externalSku])
        : { rows: [] }

      await query(
        `
          INSERT INTO marketplace_order_items (
            marketplace_order_id, external_item_id, external_sku, product_id, quantity, unit_price, payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        `,
        [
          marketplaceOrderId,
          String(item.itemId || item.externalItemId || ''),
          externalSku || null,
          matchedProduct.rows[0]?.id || null,
          Number(item.quantity || 0),
          Number(item.unitPrice || item.price || 0),
          JSON.stringify(item || {}),
        ],
      )
    }
  }

  await query(
    `
      INSERT INTO marketplace_sync_logs (channel, sync_type, status, records_count, raw_response, synced_by)
      VALUES ($1, 'orders', 'SUCCESS', $2, $3::jsonb, $4)
    `,
    [channel, normalizedOrders.length, JSON.stringify(payload || {}), userId || null],
  )

  return {
    channel,
    recordsCount: normalizedOrders.length,
  }
}

module.exports = {
  syncMarketplaceOrders,
}
