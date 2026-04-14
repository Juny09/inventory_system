const express = require('express')
const { query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')

const router = express.Router()

router.use(authenticateToken)

router.get('/shipments', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  const { status = 'all', search = '' } = req.query
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = `%${String(search || '').trim()}%`

  try {
    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            shipping_shipments.*,
            marketplace_orders.external_order_id,
            marketplace_orders.channel,
            marketplace_orders.buyer_name
          FROM shipping_shipments
          LEFT JOIN marketplace_orders ON marketplace_orders.id = shipping_shipments.marketplace_order_id
          WHERE ($1 = 'all' OR shipping_shipments.shipment_status = $1)
            AND (
              $2 = '%%'
              OR COALESCE(shipping_shipments.tracking_no, '') ILIKE $2
              OR COALESCE(marketplace_orders.external_order_id, '') ILIKE $2
              OR COALESCE(marketplace_orders.buyer_name, '') ILIKE $2
            )
          ORDER BY shipping_shipments.updated_at DESC
          LIMIT $3 OFFSET $4
        `,
        [String(status).toUpperCase(), searchPattern, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM shipping_shipments
          LEFT JOIN marketplace_orders ON marketplace_orders.id = shipping_shipments.marketplace_order_id
          WHERE ($1 = 'all' OR shipping_shipments.shipment_status = $1)
            AND (
              $2 = '%%'
              OR COALESCE(shipping_shipments.tracking_no, '') ILIKE $2
              OR COALESCE(marketplace_orders.external_order_id, '') ILIKE $2
              OR COALESCE(marketplace_orders.buyer_name, '') ILIKE $2
            )
        `,
        [String(status).toUpperCase(), searchPattern],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch shipments.', error: error.message })
  }
})

router.post('/shipments/:orderId/create', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { orderId } = req.params
  const { carrier = 'MANUAL', serviceLevel = 'STANDARD', trackingNo = '', labelUrl = '' } = req.body

  try {
    const orderResult = await query(`SELECT id, channel FROM marketplace_orders WHERE id = $1`, [orderId])

    if (!orderResult.rows[0]) {
      return res.status(404).json({ message: 'Order not found.' })
    }

    const shipmentResult = await query(
      `
        INSERT INTO shipping_shipments (
          channel,
          marketplace_order_id,
          shipment_status,
          carrier,
          service_level,
          tracking_no,
          label_url,
          shipped_at,
          updated_by
        )
        VALUES ($1, $2, 'SHIPPED', $3, $4, $5, $6, CURRENT_TIMESTAMP, $7)
        RETURNING *
      `,
      [
        orderResult.rows[0].channel,
        orderId,
        carrier || 'MANUAL',
        serviceLevel || 'STANDARD',
        trackingNo || null,
        labelUrl || null,
        req.user.id,
      ],
    )

    return res.status(201).json(shipmentResult.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create shipment.', error: error.message })
  }
})

router.put('/shipments/:id/status', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { status, trackingNo, labelUrl, carrier, serviceLevel } = req.body
  const normalizedStatus = String(status || '').toUpperCase()

  if (!['PENDING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].includes(normalizedStatus)) {
    return res.status(400).json({ message: 'Invalid shipment status.' })
  }

  try {
    const result = await query(
      `
        UPDATE shipping_shipments
        SET
          shipment_status = $2,
          tracking_no = COALESCE($3, tracking_no),
          label_url = COALESCE($4, label_url),
          carrier = COALESCE($5, carrier),
          service_level = COALESCE($6, service_level),
          shipped_at = CASE WHEN $2 = 'SHIPPED' AND shipped_at IS NULL THEN CURRENT_TIMESTAMP ELSE shipped_at END,
          delivered_at = CASE WHEN $2 = 'DELIVERED' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
          updated_by = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
      [
        req.params.id,
        normalizedStatus,
        trackingNo || null,
        labelUrl || null,
        carrier || null,
        serviceLevel || null,
        req.user.id,
      ],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Shipment not found.' })
    }

    return res.json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update shipment status.', error: error.message })
  }
})

module.exports = router
