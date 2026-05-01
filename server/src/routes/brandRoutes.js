const express = require('express')
const { query, pool } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const { getTenantId } = require('../utils/tenant')

const router = express.Router()

router.use(authenticateToken)

function getSearchPattern(search) {
  return `%${String(search || '').trim()}%`
}

// GET /api/brands —— 支持搜索、分页、status 过滤，all=true 返回全量
router.get('/', async (req, res) => {
  const { search = '', all = 'false', status = 'all' } = req.query
  const searchPattern = getSearchPattern(search)
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const tenantId = getTenantId(req)

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT b.*,
                 (SELECT COUNT(*)::int FROM supplier_brands sb WHERE sb.brand_id = b.id) AS supplier_count,
                 (SELECT COUNT(*)::int FROM products p WHERE p.brand_id = b.id AND p.tenant_id = b.tenant_id) AS product_count
          FROM brands b
          WHERE b.tenant_id = $3
            AND ($1 = '%%' OR b.name ILIKE $1 OR COALESCE(b.description, '') ILIKE $1)
            AND (
              $2 = 'all'
              OR ($2 = 'active' AND b.is_active = TRUE)
              OR ($2 = 'inactive' AND b.is_active = FALSE)
            )
          ORDER BY b.name ASC
        `,
        [searchPattern, status, tenantId],
      )
      return res.json({
        items: result.rows,
        pagination: buildPagination(result.rows.length, 1, result.rows.length || 1),
      })
    }

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT b.*,
                 (SELECT COUNT(*)::int FROM supplier_brands sb WHERE sb.brand_id = b.id) AS supplier_count,
                 (SELECT COUNT(*)::int FROM products p WHERE p.brand_id = b.id AND p.tenant_id = b.tenant_id) AS product_count
          FROM brands b
          WHERE b.tenant_id = $5
            AND ($1 = '%%' OR b.name ILIKE $1 OR COALESCE(b.description, '') ILIKE $1)
            AND (
              $2 = 'all'
              OR ($2 = 'active' AND b.is_active = TRUE)
              OR ($2 = 'inactive' AND b.is_active = FALSE)
            )
          ORDER BY b.name ASC
          LIMIT $3 OFFSET $4
        `,
        [searchPattern, status, pageSize, offset, tenantId],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM brands b
          WHERE b.tenant_id = $3
            AND ($1 = '%%' OR b.name ILIKE $1 OR COALESCE(b.description, '') ILIKE $1)
            AND (
              $2 = 'all'
              OR ($2 = 'active' AND b.is_active = TRUE)
              OR ($2 = 'inactive' AND b.is_active = FALSE)
            )
        `,
        [searchPattern, status, tenantId],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch brands.', error: error.message })
  }
})

// GET /api/brands/:id —— 详情
router.get('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req)
    const result = await query(
      `
        SELECT b.*,
               (SELECT COUNT(*)::int FROM supplier_brands sb WHERE sb.brand_id = b.id) AS supplier_count,
               (SELECT COUNT(*)::int FROM products p WHERE p.brand_id = b.id AND p.tenant_id = b.tenant_id) AS product_count
        FROM brands b
        WHERE b.id = $1 AND b.tenant_id = $2
      `,
      [req.params.id, tenantId],
    )
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Brand not found.' })
    }
    const suppliersResult = await query(
      `
        SELECT s.id, s.name, s.branch
        FROM supplier_brands sb
        JOIN suppliers s ON s.id = sb.supplier_id AND s.tenant_id = sb.tenant_id
        WHERE sb.brand_id = $1 AND sb.tenant_id = $2
        ORDER BY s.name ASC
      `,
      [req.params.id, tenantId],
    )
    return res.json({ ...result.rows[0], suppliers: suppliersResult.rows })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch brand.', error: error.message })
  }
})

// POST /api/brands
router.post('/', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, description, isActive, supplierIds } = req.body

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Brand name is required.' })
  }

  const tenantId = getTenantId(req)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `
        INSERT INTO brands (tenant_id, name, description, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [tenantId, String(name).trim(), description || null, isActive ?? true],
    )
    const brand = result.rows[0]

    if (Array.isArray(supplierIds) && supplierIds.length) {
      const uniqueIds = Array.from(new Set(supplierIds.map(Number).filter(Number.isFinite)))
      for (const sid of uniqueIds) {
        await client.query(
          `INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [sid, brand.id, tenantId],
        )
      }
    }

    await client.query('COMMIT')

    req.auditContext = {
      action: 'BRAND_CREATE',
      entityType: 'BRAND',
      entityId: String(brand.id),
      description: `Created brand ${brand.name}`,
    }

    return res.status(201).json(brand)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Brand name already exists.' })
    }
    return res.status(500).json({ message: 'Failed to create brand.', error: error.message })
  } finally {
    client.release()
  }
})

// PUT /api/brands/:id
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, description, isActive, supplierIds } = req.body

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Brand name is required.' })
  }

  const tenantId = getTenantId(req)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query(
      `
        UPDATE brands
        SET name = $2,
            description = $3,
            is_active = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND tenant_id = $5
        RETURNING *
      `,
      [req.params.id, String(name).trim(), description || null, isActive ?? true, tenantId],
    )

    if (!result.rows[0]) {
      await client.query('ROLLBACK').catch(() => {})
      return res.status(404).json({ message: 'Brand not found.' })
    }

    if (Array.isArray(supplierIds)) {
      await client.query(
        `DELETE FROM supplier_brands WHERE brand_id = $1 AND tenant_id = $2`,
        [req.params.id, tenantId],
      )
      const uniqueIds = Array.from(new Set(supplierIds.map(Number).filter(Number.isFinite)))
      for (const sid of uniqueIds) {
        await client.query(
          `INSERT INTO supplier_brands (supplier_id, brand_id, tenant_id)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [sid, req.params.id, tenantId],
        )
      }
    }

    await client.query('COMMIT')

    req.auditContext = {
      action: 'BRAND_UPDATE',
      entityType: 'BRAND',
      entityId: String(req.params.id),
      description: `Updated brand ${result.rows[0].name}`,
    }

    return res.json(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Brand name already exists.' })
    }
    return res.status(500).json({ message: 'Failed to update brand.', error: error.message })
  } finally {
    client.release()
  }
})

// DELETE /api/brands/:id
router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const tenantId = getTenantId(req)
    const existing = await query(
      'SELECT id, name FROM brands WHERE id = $1 AND tenant_id = $2',
      [req.params.id, tenantId],
    )
    if (!existing.rows[0]) {
      return res.status(404).json({ message: 'Brand not found.' })
    }

    await query('DELETE FROM brands WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId])

    req.auditContext = {
      action: 'BRAND_DELETE',
      entityType: 'BRAND',
      entityId: String(req.params.id),
      description: `Deleted brand ${existing.rows[0].name}`,
    }

    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete brand.', error: error.message })
  }
})

module.exports = router
