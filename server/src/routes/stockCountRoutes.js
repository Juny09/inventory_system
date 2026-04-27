const express = require('express')
const { pool, query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')

const router = express.Router()

router.use(authenticateToken)

function getSearchPattern(search) {
  return `%${String(search || '').trim()}%`
}

router.get('/', async (req, res) => {
  const { search = '', status = 'all' } = req.query
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = getSearchPattern(search)

  try {
    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            stock_counts.id,
            stock_counts.status,
            stock_counts.notes,
            stock_counts.created_at,
            stock_counts.completed_at,
            stock_counts.applied_at,
            warehouses.name AS warehouse_name,
            creators.full_name AS created_by_name,
            completers.full_name AS completed_by_name,
            appliers.full_name AS applied_by_name,
            COUNT(stock_count_items.id)::int AS item_count,
            COALESCE(SUM(ABS(stock_count_items.difference_quantity)), 0)::int AS total_difference
          FROM stock_counts
          INNER JOIN warehouses ON warehouses.id = stock_counts.warehouse_id
          LEFT JOIN users AS creators ON creators.id = stock_counts.created_by
          LEFT JOIN users AS completers ON completers.id = stock_counts.completed_by
          LEFT JOIN users AS appliers ON appliers.id = stock_counts.applied_by
          LEFT JOIN stock_count_items ON stock_count_items.stock_count_id = stock_counts.id
          WHERE (
            $1 = '%%'
            OR warehouses.name ILIKE $1
            OR COALESCE(stock_counts.notes, '') ILIKE $1
            OR COALESCE(creators.full_name, '') ILIKE $1
          )
            AND ($2 = 'all' OR stock_counts.status = $2)
          GROUP BY
            stock_counts.id,
            warehouses.name,
            creators.full_name,
            completers.full_name,
            appliers.full_name
          ORDER BY stock_counts.created_at DESC
          LIMIT $3 OFFSET $4
        `,
        [searchPattern, status, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM stock_counts
          INNER JOIN warehouses ON warehouses.id = stock_counts.warehouse_id
          LEFT JOIN users AS creators ON creators.id = stock_counts.created_by
          WHERE (
            $1 = '%%'
            OR warehouses.name ILIKE $1
            OR COALESCE(stock_counts.notes, '') ILIKE $1
            OR COALESCE(creators.full_name, '') ILIKE $1
          )
            AND ($2 = 'all' OR stock_counts.status = $2)
        `,
        [searchPattern, status],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch stock counts.', error: error.message })
  }
})

router.post('/', async (req, res) => {
  const { warehouseId, notes } = req.body

  if (!warehouseId) {
    return res.status(400).json({ message: 'warehouseId is required.' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const existingRows = await client.query(
      `
        SELECT COUNT(*)::int AS total
        FROM stock_levels
        INNER JOIN products ON products.id = stock_levels.product_id
        WHERE stock_levels.warehouse_id = $1
          AND products.is_active = TRUE
      `,
      [warehouseId],
    )

    if (existingRows.rows[0].total === 0) {
      throw new Error('Selected warehouse has no active stock items to count.')
    }

    const countResult = await client.query(
      `
        INSERT INTO stock_counts (warehouse_id, notes, created_by)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [warehouseId, notes || null, req.user.id],
    )

    const stockCount = countResult.rows[0]

    await client.query(
      `
        INSERT INTO stock_count_items (
          stock_count_id,
          product_id,
          warehouse_id,
          expected_quantity,
          counted_quantity,
          difference_quantity
        )
        SELECT
          $1,
          stock_levels.product_id,
          stock_levels.warehouse_id,
          stock_levels.quantity,
          stock_levels.quantity,
          0
        FROM stock_levels
        INNER JOIN products ON products.id = stock_levels.product_id
        WHERE stock_levels.warehouse_id = $2
          AND products.is_active = TRUE
      `,
      [stockCount.id, warehouseId],
    )

    await client.query('COMMIT')
    req.auditContext = {
      action: 'STOCK_COUNT_CREATE',
      entityType: 'STOCK_COUNT',
      entityId: String(stockCount.id),
      description: `Created stock count #${stockCount.id}`,
    }
    return res.status(201).json(stockCount)
  } catch (error) {
    await client.query('ROLLBACK')
    return res.status(500).json({ message: 'Failed to create stock count.', error: error.message })
  } finally {
    client.release()
  }
})

router.get('/:id', async (req, res) => {
  try {
    const [countResult, itemResult] = await Promise.all([
      query(
        `
          SELECT
            stock_counts.*,
            warehouses.name AS warehouse_name,
            creators.full_name AS created_by_name,
            completers.full_name AS completed_by_name,
            appliers.full_name AS applied_by_name
          FROM stock_counts
          INNER JOIN warehouses ON warehouses.id = stock_counts.warehouse_id
          LEFT JOIN users AS creators ON creators.id = stock_counts.created_by
          LEFT JOIN users AS completers ON completers.id = stock_counts.completed_by
          LEFT JOIN users AS appliers ON appliers.id = stock_counts.applied_by
          WHERE stock_counts.id = $1
        `,
        [req.params.id],
      ),
      query(
        `
          SELECT
            stock_count_items.id,
            stock_count_items.product_id,
            stock_count_items.warehouse_id,
            stock_count_items.expected_quantity,
            stock_count_items.counted_quantity,
            stock_count_items.difference_quantity,
            stock_count_items.notes,
            products.name AS product_name,
            products.sku,
            products.unit
          FROM stock_count_items
          INNER JOIN products ON products.id = stock_count_items.product_id
          WHERE stock_count_items.stock_count_id = $1
          ORDER BY products.name ASC
        `,
        [req.params.id],
      ),
    ])

    if (!countResult.rows[0]) {
      return res.status(404).json({ message: 'Stock count not found.' })
    }

    return res.json({
      ...countResult.rows[0],
      items: itemResult.rows,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch stock count.', error: error.message })
  }
})

router.put('/:id/items', async (req, res) => {
  const { items = [] } = req.body

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items array is required.' })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const statusResult = await client.query('SELECT status FROM stock_counts WHERE id = $1', [req.params.id])

    if (!statusResult.rows[0]) {
      throw new Error('Stock count not found.')
    }

    if (statusResult.rows[0].status !== 'OPEN') {
      throw new Error('Only OPEN stock counts can be edited.')
    }

    for (const item of items) {
      await client.query(
        `
          UPDATE stock_count_items
          SET
            counted_quantity = $2,
            difference_quantity = COALESCE($2, expected_quantity) - expected_quantity,
            notes = $3
          WHERE id = $1 AND stock_count_id = $4
        `,
        [item.id, Number(item.countedQuantity), item.notes || null, req.params.id],
      )
    }

    await client.query('COMMIT')
    req.auditContext = {
      action: 'STOCK_COUNT_SAVE',
      entityType: 'STOCK_COUNT',
      entityId: String(req.params.id),
      description: `Saved stock count #${req.params.id}`,
    }
    return res.success({ saved: true })
  } catch (error) {
    await client.query('ROLLBACK')
    return res.status(500).json({ message: 'Failed to save stock count items.', error: error.message })
  } finally {
    client.release()
  }
})

router.post('/:id/complete', async (req, res) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const countResult = await client.query('SELECT status FROM stock_counts WHERE id = $1 FOR UPDATE', [req.params.id])

    if (!countResult.rows[0]) {
      throw new Error('Stock count not found.')
    }

    if (countResult.rows[0].status !== 'OPEN') {
      throw new Error('Only OPEN stock counts can be completed.')
    }

    await client.query(
      `
        UPDATE stock_count_items
        SET
          counted_quantity = COALESCE(counted_quantity, expected_quantity),
          difference_quantity = COALESCE(counted_quantity, expected_quantity) - expected_quantity
        WHERE stock_count_id = $1
      `,
      [req.params.id],
    )

    const result = await client.query(
      `
        UPDATE stock_counts
        SET status = 'COMPLETED', completed_by = $2, completed_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
      [req.params.id, req.user.id],
    )

    await client.query('COMMIT')
    req.auditContext = {
      action: 'STOCK_COUNT_COMPLETE',
      entityType: 'STOCK_COUNT',
      entityId: String(req.params.id),
      description: `Completed stock count #${req.params.id}`,
    }
    return res.json(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    return res.status(500).json({ message: 'Failed to complete stock count.', error: error.message })
  } finally {
    client.release()
  }
})

router.post('/:id/apply', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const countResult = await client.query(
      'SELECT id, warehouse_id, status FROM stock_counts WHERE id = $1 FOR UPDATE',
      [req.params.id],
    )

    if (!countResult.rows[0]) {
      throw new Error('Stock count not found.')
    }

    if (countResult.rows[0].status !== 'COMPLETED') {
      throw new Error('Only COMPLETED stock counts can be applied.')
    }

    const itemResult = await client.query(
      `
        SELECT id, product_id, warehouse_id, counted_quantity
        FROM stock_count_items
        WHERE stock_count_id = $1
      `,
      [req.params.id],
    )

    for (const item of itemResult.rows) {
      const currentStockResult = await client.query(
        `
          SELECT quantity
          FROM stock_levels
          WHERE product_id = $1 AND warehouse_id = $2
          FOR UPDATE
        `,
        [item.product_id, item.warehouse_id],
      )

      const currentQuantity = Number(currentStockResult.rows[0]?.quantity || 0)
      const targetQuantity = Number(item.counted_quantity || 0)
      const delta = targetQuantity - currentQuantity

      await client.query(
        `
          UPDATE stock_levels
          SET quantity = $3, updated_at = CURRENT_TIMESTAMP
          WHERE product_id = $1 AND warehouse_id = $2
        `,
        [item.product_id, item.warehouse_id, targetQuantity],
      )

      if (delta !== 0) {
        await client.query(
          `
            INSERT INTO stock_movements (
              movement_type,
              product_id,
              source_warehouse_id,
              destination_warehouse_id,
              quantity,
              reference_no,
              notes,
              created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            delta > 0 ? 'IN' : 'OUT',
            item.product_id,
            delta > 0 ? null : item.warehouse_id,
            delta > 0 ? item.warehouse_id : null,
            Math.abs(delta),
            `COUNT-${req.params.id}`,
            `Stock count adjustment #${req.params.id}`,
            req.user.id,
          ],
        )
      }
    }

    const result = await client.query(
      `
        UPDATE stock_counts
        SET status = 'APPLIED', applied_by = $2, applied_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
      [req.params.id, req.user.id],
    )

    await client.query('COMMIT')
    req.auditContext = {
      action: 'STOCK_COUNT_APPLY',
      entityType: 'STOCK_COUNT',
      entityId: String(req.params.id),
      description: `Applied stock count #${req.params.id}`,
    }
    return res.json(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    return res.status(500).json({ message: 'Failed to apply stock count.', error: error.message })
  } finally {
    client.release()
  }
})

module.exports = router
