const express = require('express')
const { query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')

const router = express.Router()

router.use(authenticateToken)

function getSearchPattern(search) {
  return `%${String(search || '').trim()}%`
}

function normalizeSort(sortBy) {
  const allowed = new Set(['name', 'created_at', 'updated_at', 'lead_time_days'])
  return allowed.has(sortBy) ? sortBy : 'updated_at'
}

function normalizeSortOrder(sortOrder) {
  return String(sortOrder || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
}

router.get('/', async (req, res) => {
  const { search = '', status = 'all', sortBy = 'updated_at', sortOrder = 'desc' } = req.query
  const searchPattern = getSearchPattern(search)
  const resolvedSortBy = normalizeSort(sortBy)
  const resolvedSortOrder = normalizeSortOrder(sortOrder)
  const { page, pageSize, offset } = getPaginationParams(req.query)

  try {
    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            suppliers.*,
            COUNT(product_suppliers.product_id)::int AS linked_product_count
          FROM suppliers
          LEFT JOIN product_suppliers ON product_suppliers.supplier_id = suppliers.id
          WHERE (
            $1 = '%%'
            OR suppliers.name ILIKE $1
            OR suppliers.company_name ILIKE $1
            OR suppliers.contact_name ILIKE $1
            OR suppliers.phone ILIKE $1
            OR suppliers.email ILIKE $1
          )
            AND (
              $2 = 'all'
              OR ($2 = 'active' AND suppliers.is_active = TRUE)
              OR ($2 = 'inactive' AND suppliers.is_active = FALSE)
            )
          GROUP BY suppliers.id
          ORDER BY
            CASE WHEN $3 = 'name' THEN COALESCE(suppliers.company_name, suppliers.name) END ${resolvedSortOrder},
            CASE WHEN $3 = 'created_at' THEN suppliers.created_at END ${resolvedSortOrder},
            CASE WHEN $3 = 'updated_at' THEN suppliers.updated_at END ${resolvedSortOrder},
            CASE WHEN $3 = 'lead_time_days' THEN suppliers.lead_time_days END ${resolvedSortOrder},
            suppliers.id DESC
          LIMIT $4 OFFSET $5
        `,
        [searchPattern, status, resolvedSortBy, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM suppliers
          WHERE (
            $1 = '%%'
            OR suppliers.name ILIKE $1
            OR suppliers.company_name ILIKE $1
            OR suppliers.contact_name ILIKE $1
            OR suppliers.phone ILIKE $1
            OR suppliers.email ILIKE $1
          )
            AND (
              $2 = 'all'
              OR ($2 = 'active' AND suppliers.is_active = TRUE)
              OR ($2 = 'inactive' AND suppliers.is_active = FALSE)
            )
        `,
        [searchPattern, status],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch suppliers.', error: error.message })
  }
})

router.post('/', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, companyName, contactName, phone, email, address, paymentTerms, leadTimeDays, notes, isActive } = req.body

  if (!name) {
    return res.status(400).json({ message: 'Supplier name is required.' })
  }

  try {
    const result = await query(
      `
        INSERT INTO suppliers (
          name,
          company_name,
          contact_name,
          phone,
          email,
          address,
          payment_terms,
          lead_time_days,
          notes,
          is_active,
          created_by,
          updated_by,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $11, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [
        name,
        companyName || name,
        contactName || null,
        phone || null,
        email || null,
        address || null,
        paymentTerms || null,
        Number(leadTimeDays || 0),
        notes || null,
        isActive ?? true,
        req.user.id,
      ],
    )

    req.auditContext = {
      action: 'SUPPLIER_CREATE',
      entityType: 'SUPPLIER',
      entityId: String(result.rows[0].id),
      description: `Created supplier ${result.rows[0].name}`,
    }

    return res.status(201).json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create supplier.', error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const [supplierResult, productsResult, recentPurchasesResult] = await Promise.all([
      query(`SELECT * FROM suppliers WHERE id = $1`, [req.params.id]),
      query(
        `
          SELECT
            products.id,
            products.name,
            products.sku,
            products.product_code,
            products.is_active,
            product_suppliers.is_primary,
            categories.name AS category_name
          FROM product_suppliers
          INNER JOIN products ON products.id = product_suppliers.product_id
          LEFT JOIN categories ON categories.id = products.category_id
          WHERE product_suppliers.supplier_id = $1
          ORDER BY product_suppliers.is_primary DESC, products.name ASC
        `,
        [req.params.id],
      ),
      query(
        `
          SELECT
            stock_movements.id,
            stock_movements.product_id,
            stock_movements.quantity,
            stock_movements.unit_cost,
            stock_movements.purchase_reason,
            stock_movements.reference_no,
            stock_movements.created_at,
            products.name AS product_name,
            products.sku,
            warehouses.name AS warehouse_name,
            users.full_name AS created_by_name
          FROM stock_movements
          INNER JOIN products ON products.id = stock_movements.product_id
          LEFT JOIN warehouses ON warehouses.id = stock_movements.destination_warehouse_id
          LEFT JOIN users ON users.id = stock_movements.created_by
          WHERE stock_movements.movement_type = 'IN'
            AND stock_movements.supplier_id = $1
          ORDER BY stock_movements.created_at DESC
          LIMIT 10
        `,
        [req.params.id],
      ),
    ])

    if (!supplierResult.rows[0]) {
      return res.status(404).json({ message: 'Supplier not found.' })
    }

    return res.json({
      supplier: supplierResult.rows[0],
      products: productsResult.rows,
      recentPurchases: recentPurchasesResult.rows,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch supplier detail.', error: error.message })
  }
})

router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, companyName, contactName, phone, email, address, paymentTerms, leadTimeDays, notes, isActive } = req.body

  if (!name) {
    return res.status(400).json({ message: 'Supplier name is required.' })
  }

  try {
    const result = await query(
      `
        UPDATE suppliers
        SET
          name = $2,
          company_name = $3,
          contact_name = $4,
          phone = $5,
          email = $6,
          address = $7,
          payment_terms = $8,
          lead_time_days = $9,
          notes = $10,
          is_active = $11,
          updated_by = $12,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
      [
        req.params.id,
        name,
        companyName || name,
        contactName || null,
        phone || null,
        email || null,
        address || null,
        paymentTerms || null,
        Number(leadTimeDays || 0),
        notes || null,
        isActive ?? true,
        req.user.id,
      ],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Supplier not found.' })
    }

    req.auditContext = {
      action: 'SUPPLIER_UPDATE',
      entityType: 'SUPPLIER',
      entityId: String(req.params.id),
      description: `Updated supplier ${result.rows[0].name}`,
    }

    return res.json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update supplier.', error: error.message })
  }
})

router.patch('/:id/status', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { isActive } = req.body

  try {
    const result = await query(
      `
        UPDATE suppliers
        SET is_active = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
      [req.params.id, Boolean(isActive), req.user.id],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Supplier not found.' })
    }

    req.auditContext = {
      action: 'SUPPLIER_STATUS_UPDATE',
      entityType: 'SUPPLIER',
      entityId: String(req.params.id),
      description: `Updated supplier status ${result.rows[0].name}`,
    }

    return res.json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update supplier status.', error: error.message })
  }
})

router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const existing = await query('SELECT id, name FROM suppliers WHERE id = $1', [req.params.id])
    const row = existing.rows[0]
    if (!row) {
      return res.status(404).json({ message: 'Supplier not found.' })
    }

    await query('DELETE FROM suppliers WHERE id = $1', [req.params.id])

    req.auditContext = {
      action: 'SUPPLIER_DELETE',
      entityType: 'SUPPLIER',
      entityId: String(req.params.id),
      description: `Deleted supplier ${row.name}`,
    }

    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete supplier.', error: error.message })
  }
})

module.exports = router
