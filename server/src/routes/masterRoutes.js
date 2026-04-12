const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')

const router = express.Router()
const COST_ACCESS_HEADER = 'x-cost-access-token'

router.use(authenticateToken)

function getSearchPattern(search) {
  return `%${String(search || '').trim()}%`
}

function generateProductCode() {
  return `PRD-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function normalizePrice(value) {
  return Number(Number(value || 0).toFixed(2))
}

function resolveSuggestedPrice(costPrice, markupPercentage, suggestedPrice) {
  const normalizedCost = normalizePrice(costPrice)
  const normalizedMarkup = Number(markupPercentage || 0)

  if (suggestedPrice !== undefined && suggestedPrice !== null && suggestedPrice !== '') {
    return normalizePrice(suggestedPrice)
  }

  return normalizePrice(normalizedCost * (1 + normalizedMarkup / 100))
}

function buildDefaultPricingRules(costPrice, markupPercentage, suggestedPrice) {
  return [
    {
      ruleName: 'Retail',
      markupPercentage: Number(markupPercentage || 0),
      suggestedPrice: resolveSuggestedPrice(costPrice, markupPercentage, suggestedPrice),
      isDefault: true,
      sortOrder: 0,
    },
  ]
}

function normalizePricingRules(rules, costPrice, markupPercentage, suggestedPrice) {
  const sourceRules =
    Array.isArray(rules) && rules.length > 0
      ? rules
      : buildDefaultPricingRules(costPrice, markupPercentage, suggestedPrice)

  return sourceRules.map((rule, index) => ({
    ruleName: String(rule.ruleName || rule.name || `Rule ${index + 1}`).trim(),
    markupPercentage: Number(rule.markupPercentage || 0),
    suggestedPrice: resolveSuggestedPrice(costPrice, rule.markupPercentage, rule.suggestedPrice),
    isDefault: Boolean(rule.isDefault) || index === 0,
    sortOrder: Number(rule.sortOrder ?? index),
  }))
}

function getDefaultPricingRule(pricingRules, costPrice, markupPercentage, suggestedPrice) {
  const normalizedRules = normalizePricingRules(pricingRules, costPrice, markupPercentage, suggestedPrice)
  return normalizedRules.find((rule) => rule.isDefault) || normalizedRules[0]
}

function getCostAccessToken(req) {
  const token = req.headers[COST_ACCESS_HEADER]

  if (!token || !['ADMIN', 'MANAGER'].includes(req.user?.role)) {
    return null
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    if (payload.purpose !== 'cost-access' || payload.userId !== req.user.id) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

function canViewCost(req) {
  return Boolean(getCostAccessToken(req))
}

function maskProductCosts(product, allowCostAccess) {
  if (!product) {
    return product
  }

  return {
    ...product,
    cost_price: allowCostAccess ? product.cost_price : null,
    can_view_cost: allowCostAccess,
  }
}

function maskPricingRules(pricingRules, allowCostAccess) {
  return pricingRules.map((rule) => ({
    ...rule,
    cost_price: allowCostAccess ? rule.cost_price : null,
  }))
}

async function loadProductImagesMap(productIds) {
  if (!productIds.length) {
    return new Map()
  }

  const result = await query(
    `
      SELECT id, product_id, image_data, sort_order, is_primary, created_at
      FROM product_images
      WHERE product_id = ANY($1::int[])
      ORDER BY is_primary DESC, sort_order ASC, created_at ASC
    `,
    [productIds],
  )

  return result.rows.reduce((map, row) => {
    const currentItems = map.get(row.product_id) || []
    currentItems.push(row)
    map.set(row.product_id, currentItems)
    return map
  }, new Map())
}

async function loadPricingRulesMap(productIds) {
  if (!productIds.length) {
    return new Map()
  }

  const result = await query(
    `
      SELECT id, product_id, rule_name, markup_percentage, suggested_price, is_default, sort_order, created_at
      FROM product_pricing_rules
      WHERE product_id = ANY($1::int[])
      ORDER BY sort_order ASC, created_at ASC
    `,
    [productIds],
  )

  return result.rows.reduce((map, row) => {
    const currentItems = map.get(row.product_id) || []
    currentItems.push(row)
    map.set(row.product_id, currentItems)
    return map
  }, new Map())
}

async function saveProductImages(productId, images) {
  await query('DELETE FROM product_images WHERE product_id = $1', [productId])

  const normalizedImages = (Array.isArray(images) ? images : [])
    .map((item, index) => ({
      imageData: item.imageData || item.image_data || item,
      isPrimary: Boolean(item.isPrimary || item.is_primary) || index === 0,
      sortOrder: Number(item.sortOrder ?? item.sort_order ?? index),
    }))
    .filter((item) => item.imageData)

  if (!normalizedImages.length) {
    return []
  }

  const insertedItems = []

  for (const item of normalizedImages) {
    const result = await query(
      `
        INSERT INTO product_images (product_id, image_data, sort_order, is_primary)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [productId, item.imageData, item.sortOrder, item.isPrimary],
    )

    insertedItems.push(result.rows[0])
  }

  return insertedItems
}

async function savePricingRules(productId, pricingRules, costPrice, markupPercentage, suggestedPrice) {
  await query('DELETE FROM product_pricing_rules WHERE product_id = $1', [productId])

  const normalizedRules = normalizePricingRules(pricingRules, costPrice, markupPercentage, suggestedPrice)

  const insertedItems = []

  for (const rule of normalizedRules) {
    const result = await query(
      `
        INSERT INTO product_pricing_rules (product_id, rule_name, markup_percentage, suggested_price, is_default, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [productId, rule.ruleName, rule.markupPercentage, rule.suggestedPrice, rule.isDefault, rule.sortOrder],
    )

    insertedItems.push(result.rows[0])
  }

  return insertedItems
}

async function attachProductRelations(products, options = {}) {
  const productIds = products.map((item) => item.id)
  const [imagesMap, pricingRulesMap] = await Promise.all([
    loadProductImagesMap(productIds),
    loadPricingRulesMap(productIds),
  ])

  return products.map((product) => {
    const images = imagesMap.get(product.id) || []
    const pricingRules = pricingRulesMap.get(product.id) || []
    const primaryImage = images.find((item) => item.is_primary) || images[0]

    return {
      ...maskProductCosts(product, options.allowCostAccess),
      image_data: primaryImage?.image_data || product.image_data || null,
      images,
      pricing_rules: maskPricingRules(pricingRules, options.allowCostAccess),
    }
  })
}

// 用户列表支持搜索和分页，避免账号多了以后一次性全拉
router.get('/users', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { search = '', all = 'false' } = req.query
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = getSearchPattern(search)

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT id, full_name, email, role, is_active, created_at
          FROM users
          WHERE (
            $1 = '%%'
            OR full_name ILIKE $1
            OR email ILIKE $1
            OR role ILIKE $1
          )
          ORDER BY created_at DESC
        `,
        [searchPattern],
      )

      return res.json({
        items: result.rows,
        pagination: buildPagination(result.rows.length, 1, result.rows.length || 1),
      })
    }

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT id, full_name, email, role, is_active, created_at
          FROM users
          WHERE (
            $1 = '%%'
            OR full_name ILIKE $1
            OR email ILIKE $1
            OR role ILIKE $1
          )
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `,
        [searchPattern, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM users
          WHERE (
            $1 = '%%'
            OR full_name ILIKE $1
            OR email ILIKE $1
            OR role ILIKE $1
          )
        `,
        [searchPattern],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch users.', error: error.message })
  }
})

// 只有管理员可以创建新用户，便于控制系统入口
router.post('/users', authorizeRoles('ADMIN'), async (req, res) => {
  const { fullName, email, password, role } = req.body

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ message: 'fullName, email, password and role are required.' })
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const result = await query(
      `
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, full_name, email, role, is_active, created_at
      `,
      [fullName, email, passwordHash, role],
    )

    return res.status(201).json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create user.', error: error.message })
  }
})

// 分类接口支持搜索和分页，同时保留 all=true 供下拉框取全量
router.get('/categories', async (req, res) => {
  const { search = '', all = 'false' } = req.query
  const searchPattern = getSearchPattern(search)
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT id, name, description, created_at
          FROM categories
          WHERE ($1 = '%%' OR name ILIKE $1 OR description ILIKE $1)
          ORDER BY name ASC
        `,
        [searchPattern],
      )

      return res.json({
        items: result.rows,
        pagination: buildPagination(result.rows.length, 1, result.rows.length || 1),
      })
    }

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT id, name, description, created_at
          FROM categories
          WHERE ($1 = '%%' OR name ILIKE $1 OR description ILIKE $1)
          ORDER BY name ASC
          LIMIT $2 OFFSET $3
        `,
        [searchPattern, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM categories
          WHERE ($1 = '%%' OR name ILIKE $1 OR description ILIKE $1)
        `,
        [searchPattern],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch categories.', error: error.message })
  }
})

router.post('/categories', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, description } = req.body

  if (!name) {
    return res.status(400).json({ message: 'Category name is required.' })
  }

  try {
    const result = await query(
      `
        INSERT INTO categories (name, description)
        VALUES ($1, $2)
        RETURNING *
      `,
      [name, description || null],
    )

    return res.status(201).json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create category.', error: error.message })
  }
})

router.put('/categories/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { id } = req.params
  const { name, description } = req.body

  if (!name) {
    return res.status(400).json({ message: 'Category name is required.' })
  }

  try {
    const result = await query(
      `
        UPDATE categories
        SET name = $2, description = $3
        WHERE id = $1
        RETURNING *
      `,
      [id, name, description || null],
    )

    return res.json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update category.', error: error.message })
  }
})

router.delete('/categories/:id', authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await query('DELETE FROM categories WHERE id = $1', [req.params.id])
    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete category.', error: error.message })
  }
})

// 仓库接口支持搜索、启用状态筛选和分页
router.get('/warehouses', async (req, res) => {
  const { search = '', activeOnly = 'false', all = 'false' } = req.query
  const searchPattern = getSearchPattern(search)
  const onlyActive = activeOnly === 'true'
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT id, name, code, address, manager_name, is_active, created_at
          FROM warehouses
          WHERE ($1 = '%%' OR name ILIKE $1 OR code ILIKE $1 OR address ILIKE $1 OR manager_name ILIKE $1)
            AND ($2 = FALSE OR is_active = TRUE)
          ORDER BY name ASC
        `,
        [searchPattern, onlyActive],
      )

      return res.json({
        items: result.rows,
        pagination: buildPagination(result.rows.length, 1, result.rows.length || 1),
      })
    }

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT id, name, code, address, manager_name, is_active, created_at
          FROM warehouses
          WHERE ($1 = '%%' OR name ILIKE $1 OR code ILIKE $1 OR address ILIKE $1 OR manager_name ILIKE $1)
            AND ($2 = FALSE OR is_active = TRUE)
          ORDER BY name ASC
          LIMIT $3 OFFSET $4
        `,
        [searchPattern, onlyActive, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM warehouses
          WHERE ($1 = '%%' OR name ILIKE $1 OR code ILIKE $1 OR address ILIKE $1 OR manager_name ILIKE $1)
            AND ($2 = FALSE OR is_active = TRUE)
        `,
        [searchPattern, onlyActive],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch warehouses.', error: error.message })
  }
})

router.post('/warehouses', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { name, code, address, managerName, isActive } = req.body

  if (!name || !code) {
    return res.status(400).json({ message: 'Warehouse name and code are required.' })
  }

  try {
    const result = await query(
      `
        INSERT INTO warehouses (name, code, address, manager_name, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [name, code, address || null, managerName || null, isActive ?? true],
    )

    return res.status(201).json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create warehouse.', error: error.message })
  }
})

router.put('/warehouses/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { id } = req.params
  const { name, code, address, managerName, isActive } = req.body

  if (!name || !code) {
    return res.status(400).json({ message: 'Warehouse name and code are required.' })
  }

  try {
    const result = await query(
      `
        UPDATE warehouses
        SET name = $2, code = $3, address = $4, manager_name = $5, is_active = $6
        WHERE id = $1
        RETURNING *
      `,
      [id, name, code, address || null, managerName || null, isActive ?? true],
    )

    return res.json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update warehouse.', error: error.message })
  }
})

router.delete('/warehouses/:id', authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await query('DELETE FROM warehouses WHERE id = $1', [req.params.id])
    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete warehouse.', error: error.message })
  }
})

// 商品接口支持搜索、分页和高级筛选，减少前端一次性加载量
router.get('/products', async (req, res) => {
  const {
    search = '',
    activeOnly = 'false',
    all = 'false',
    categoryId = '',
    status = 'all',
    hasBarcode = 'all',
  } = req.query
  const searchPattern = getSearchPattern(search)
  const resolvedStatus = status === 'all' ? (activeOnly === 'true' ? 'active' : 'all') : status
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const allowCostAccess = canViewCost(req)

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT
            products.*,
            categories.name AS category_name
          FROM products
          LEFT JOIN categories ON categories.id = products.category_id
          WHERE (
            $1 = '%%'
            OR products.name ILIKE $1
            OR products.sku ILIKE $1
            OR products.product_code ILIKE $1
            OR products.barcode ILIKE $1
            OR products.description ILIKE $1
            OR categories.name ILIKE $1
          )
            AND ($2::int IS NULL OR products.category_id = $2::int)
            AND (
              $3 = 'all'
              OR ($3 = 'active' AND products.is_active = TRUE)
              OR ($3 = 'inactive' AND products.is_active = FALSE)
            )
            AND (
              $4 = 'all'
              OR ($4 = 'yes' AND NULLIF(TRIM(COALESCE(products.barcode, '')), '') IS NOT NULL)
              OR ($4 = 'no' AND NULLIF(TRIM(COALESCE(products.barcode, '')), '') IS NULL)
            )
          ORDER BY products.created_at DESC
        `,
        [searchPattern, categoryId || null, resolvedStatus, hasBarcode],
      )

      const items = await attachProductRelations(result.rows, { allowCostAccess })

      return res.json({
        items,
        pagination: buildPagination(result.rows.length, 1, result.rows.length || 1),
      })
    }

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            products.*,
            categories.name AS category_name
          FROM products
          LEFT JOIN categories ON categories.id = products.category_id
          WHERE (
            $1 = '%%'
            OR products.name ILIKE $1
            OR products.sku ILIKE $1
            OR products.product_code ILIKE $1
            OR products.barcode ILIKE $1
            OR products.description ILIKE $1
            OR categories.name ILIKE $1
          )
            AND ($2::int IS NULL OR products.category_id = $2::int)
            AND (
              $3 = 'all'
              OR ($3 = 'active' AND products.is_active = TRUE)
              OR ($3 = 'inactive' AND products.is_active = FALSE)
            )
            AND (
              $4 = 'all'
              OR ($4 = 'yes' AND NULLIF(TRIM(COALESCE(products.barcode, '')), '') IS NOT NULL)
              OR ($4 = 'no' AND NULLIF(TRIM(COALESCE(products.barcode, '')), '') IS NULL)
            )
          ORDER BY products.created_at DESC
          LIMIT $5 OFFSET $6
        `,
        [searchPattern, categoryId || null, resolvedStatus, hasBarcode, pageSize, offset],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM products
          LEFT JOIN categories ON categories.id = products.category_id
          WHERE (
            $1 = '%%'
            OR products.name ILIKE $1
            OR products.sku ILIKE $1
            OR products.product_code ILIKE $1
            OR products.barcode ILIKE $1
            OR products.description ILIKE $1
            OR categories.name ILIKE $1
          )
            AND ($2::int IS NULL OR products.category_id = $2::int)
            AND (
              $3 = 'all'
              OR ($3 = 'active' AND products.is_active = TRUE)
              OR ($3 = 'inactive' AND products.is_active = FALSE)
            )
            AND (
              $4 = 'all'
              OR ($4 = 'yes' AND NULLIF(TRIM(COALESCE(products.barcode, '')), '') IS NOT NULL)
              OR ($4 = 'no' AND NULLIF(TRIM(COALESCE(products.barcode, '')), '') IS NULL)
            )
        `,
        [searchPattern, categoryId || null, resolvedStatus, hasBarcode],
      ),
    ])

    const items = await attachProductRelations(itemsResult.rows, { allowCostAccess })

    return res.json({
      items,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch products.', error: error.message })
  }
})

router.post('/products/cost-access', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { passcode = '' } = req.body

  if (!passcode) {
    return res.status(400).json({ message: 'Passcode is required.' })
  }

  try {
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
    const matched = await bcrypt.compare(passcode, result.rows[0]?.password_hash || '')

    if (!matched) {
      return res.status(401).json({ message: 'Invalid passcode.' })
    }

    const token = jwt.sign(
      {
        userId: req.user.id,
        purpose: 'cost-access',
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' },
    )

    return res.json({ success: true, token })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify passcode.', error: error.message })
  }
})

router.get('/products/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const allowCostAccess = canViewCost(req)
    const [productResult, stockResult, movementResult, alertResult, imagesMap, pricingRulesMap] = await Promise.all([
      query(
        `
          SELECT
            products.*,
            categories.name AS category_name
          FROM products
          LEFT JOIN categories ON categories.id = products.category_id
          WHERE products.id = $1
        `,
        [req.params.id],
      ),
      query(
        `
          SELECT
            stock_levels.id,
            stock_levels.quantity,
            stock_levels.updated_at,
            warehouses.id AS warehouse_id,
            warehouses.name AS warehouse_name,
            warehouses.code AS warehouse_code
          FROM stock_levels
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id
          WHERE stock_levels.product_id = $1
          ORDER BY warehouses.name ASC
        `,
        [req.params.id],
      ),
      query(
        `
          SELECT
            stock_movements.id,
            stock_movements.movement_type,
            stock_movements.quantity,
            stock_movements.reference_no,
            stock_movements.notes,
            stock_movements.created_at,
            source_warehouse.name AS source_warehouse_name,
            destination_warehouse.name AS destination_warehouse_name,
            users.full_name AS created_by_name
          FROM stock_movements
          LEFT JOIN warehouses AS source_warehouse ON source_warehouse.id = stock_movements.source_warehouse_id
          LEFT JOIN warehouses AS destination_warehouse ON destination_warehouse.id = stock_movements.destination_warehouse_id
          LEFT JOIN users ON users.id = stock_movements.created_by
          WHERE stock_movements.product_id = $1
          ORDER BY stock_movements.created_at DESC
          LIMIT 10
        `,
        [req.params.id],
      ),
      query(
        `
          SELECT
            warehouses.id AS warehouse_id,
            warehouses.name AS warehouse_name,
            stock_levels.quantity,
            products.reorder_level,
            GREATEST(products.reorder_level - stock_levels.quantity, 0) AS shortage,
            COALESCE(low_stock_alert_states.status, 'OPEN') AS alert_status,
            assignees.full_name AS assigned_to_name
          FROM stock_levels
          INNER JOIN products ON products.id = stock_levels.product_id
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id
          LEFT JOIN low_stock_alert_states ON low_stock_alert_states.product_id = stock_levels.product_id
            AND low_stock_alert_states.warehouse_id = stock_levels.warehouse_id
          LEFT JOIN users AS assignees ON assignees.id = low_stock_alert_states.assigned_to
          WHERE stock_levels.product_id = $1
            AND stock_levels.quantity <= products.reorder_level
          ORDER BY shortage DESC, warehouses.name ASC
        `,
        [req.params.id],
      ),
      loadProductImagesMap([Number(req.params.id)]),
      loadPricingRulesMap([Number(req.params.id)]),
    ])

    if (!productResult.rows[0]) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    const product = (await attachProductRelations([productResult.rows[0]], { allowCostAccess }))[0]

    return res.json({
      product,
      images: imagesMap.get(Number(req.params.id)) || product.images || [],
      pricingRules: maskPricingRules(pricingRulesMap.get(Number(req.params.id)) || [], allowCostAccess),
      stockLevels: stockResult.rows,
      recentMovements: movementResult.rows,
      alerts: alertResult.rows,
      summary: {
        totalOnHand: stockResult.rows.reduce((sum, item) => sum + Number(item.quantity), 0),
        warehouseCount: stockResult.rows.length,
        lowStockCount: alertResult.rows.length,
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch product detail.', error: error.message })
  }
})

router.post('/products', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const {
    name,
    sku,
    productCode,
    barcode,
    imageData,
    images,
    description,
    usageGuide,
    pros,
    cons,
    categoryId,
    unit,
    costPrice,
    sellingPrice,
    markupPercentage,
    suggestedPrice,
    pricingRules,
    reorderLevel,
    isActive,
  } = req.body

  if (!name || !sku) {
    return res.status(400).json({ message: 'Product name and SKU are required.' })
  }

  try {
    const defaultPricingRule = getDefaultPricingRule(pricingRules, costPrice, markupPercentage, suggestedPrice ?? sellingPrice)
    const primaryImage = (Array.isArray(images) && images[0]?.imageData) || imageData || null
    const result = await query(
      `
        INSERT INTO products (
          name,
          sku,
          product_code,
          barcode,
          image_data,
          description,
          usage_guide,
          pros,
          cons,
          category_id,
          unit,
          cost_price,
          selling_price,
          markup_percentage,
          suggested_price,
          reorder_level,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `,
      [
        name,
        sku,
        productCode || generateProductCode(),
        barcode || null,
        primaryImage,
        description || null,
        usageGuide || null,
        pros || null,
        cons || null,
        categoryId || null,
        unit || 'pcs',
        normalizePrice(costPrice),
        normalizePrice(sellingPrice),
        Number(defaultPricingRule.markupPercentage || 0),
        normalizePrice(defaultPricingRule.suggestedPrice),
        Number(reorderLevel || 0),
        isActive ?? true,
      ],
    )

    await Promise.all([
      saveProductImages(result.rows[0].id, Array.isArray(images) && images.length ? images : primaryImage ? [primaryImage] : []),
      savePricingRules(
        result.rows[0].id,
        pricingRules,
        costPrice,
        defaultPricingRule.markupPercentage,
        defaultPricingRule.suggestedPrice,
      ),
    ])

    const product = (await attachProductRelations([result.rows[0]], { allowCostAccess: canViewCost(req) }))[0]

    return res.status(201).json(product)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create product.', error: error.message })
  }
})

router.put('/products/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { id } = req.params
  const {
    name,
    sku,
    productCode,
    barcode,
    imageData,
    images,
    description,
    usageGuide,
    pros,
    cons,
    categoryId,
    unit,
    costPrice,
    sellingPrice,
    markupPercentage,
    suggestedPrice,
    pricingRules,
    reorderLevel,
    isActive,
  } = req.body

  if (!name || !sku) {
    return res.status(400).json({ message: 'Product name and SKU are required.' })
  }

  try {
    const defaultPricingRule = getDefaultPricingRule(pricingRules, costPrice, markupPercentage, suggestedPrice ?? sellingPrice)
    const primaryImage = (Array.isArray(images) && images[0]?.imageData) || imageData || null
    const result = await query(
      `
        UPDATE products
        SET
          name = $2,
          sku = $3,
          product_code = $4,
          barcode = $5,
          image_data = $6,
          description = $7,
          usage_guide = $8,
          pros = $9,
          cons = $10,
          category_id = $11,
          unit = $12,
          cost_price = $13,
          selling_price = $14,
          markup_percentage = $15,
          suggested_price = $16,
          reorder_level = $17,
          is_active = $18,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        name,
        sku,
        productCode || generateProductCode(),
        barcode || null,
        primaryImage,
        description || null,
        usageGuide || null,
        pros || null,
        cons || null,
        categoryId || null,
        unit || 'pcs',
        normalizePrice(costPrice),
        normalizePrice(sellingPrice),
        Number(defaultPricingRule.markupPercentage || 0),
        normalizePrice(defaultPricingRule.suggestedPrice),
        Number(reorderLevel || 0),
        isActive ?? true,
      ],
    )

    await Promise.all([
      saveProductImages(result.rows[0].id, Array.isArray(images) && images.length ? images : primaryImage ? [primaryImage] : []),
      savePricingRules(
        result.rows[0].id,
        pricingRules,
        costPrice,
        defaultPricingRule.markupPercentage,
        defaultPricingRule.suggestedPrice,
      ),
    ])

    const product = (await attachProductRelations([result.rows[0]], { allowCostAccess: canViewCost(req) }))[0]

    return res.json(product)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update product.', error: error.message })
  }
})

router.delete('/products/:id', authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await query('DELETE FROM products WHERE id = $1', [req.params.id])
    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete product.', error: error.message })
  }
})

module.exports = router
