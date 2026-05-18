const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool, query } = require('../config/db')
const { postItemsToStock } = require('../utils/inventoryService')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getPaginationParams, buildPagination } = require('../utils/pagination')
const { encodeCostToCode } = require('../utils/costCode')
const { getTenantId } = require('../utils/tenant')

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

function normalizeSkuType(value) {
  return String(value || 'SINGLE').toUpperCase() === 'COMBO' ? 'COMBO' : 'SINGLE'
}

function buildDefaultPricingRules(costPrice, markupPercentage, suggestedPrice) {
  return [
    {
      ruleName: 'Retail',
      channelKey: 'retail',
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
    channelKey: String(rule.channelKey || rule.channel_key || rule.channel || rule.ruleKey || '').trim() || String(rule.ruleName || rule.name || `rule-${index + 1}`).trim().toLowerCase(),
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

function resolveActivePricingRule(pricingRules, pricingChannel) {
  if (!pricingRules.length) {
    return null
  }

  const normalizedChannel = String(pricingChannel || '').trim().toLowerCase()

  if (normalizedChannel) {
    const matched =
      pricingRules.find((rule) => String(rule.channel_key || '').toLowerCase() === normalizedChannel) ||
      pricingRules.find((rule) => String(rule.rule_name || '').toLowerCase() === normalizedChannel)

    if (matched) {
      return matched
    }
  }

  return pricingRules.find((rule) => rule.is_default) || pricingRules[0]
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
    cost_code: encodeCostToCode(product.cost_price),
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

function normalizePercentChange(oldValue, newValue) {
  const oldNumber = Number(oldValue || 0)
  const newNumber = Number(newValue || 0)

  if (!Number.isFinite(oldNumber) || !Number.isFinite(newNumber)) {
    return 0
  }

  if (oldNumber === 0) {
    return newNumber === 0 ? 0 : 100
  }

  return Number((((newNumber - oldNumber) / oldNumber) * 100).toFixed(4))
}

async function getSettingValue(settingKey, tenantId) {
  const result = await query('SELECT setting_value FROM system_settings WHERE setting_key = $1 AND tenant_id = $2', [settingKey, tenantId])
  return result.rows[0]?.setting_value ?? null
}

async function resolvePriceChangeThresholdPercent(tenantId) {
  const stored = await getSettingValue('PRICE_CHANGE_ALERT_THRESHOLD_PERCENT', tenantId)
  const value = stored ?? process.env.PRICE_CHANGE_ALERT_THRESHOLD_PERCENT ?? '10'
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 10
}

function normalizeRoles(value) {
  const allowed = new Set(['ADMIN', 'MANAGER', 'STAFF'])
  const roles = Array.isArray(value) ? value : String(value || '').split(',')
  const normalized = roles
    .map((role) => String(role || '').trim().toUpperCase())
    .filter((role) => allowed.has(role))
  return Array.from(new Set(normalized))
}

function normalizeBoolean(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue
  }
  if (typeof value === 'boolean') {
    return value
  }
  const lowered = String(value).trim().toLowerCase()
  if (lowered === 'true') return true
  if (lowered === 'false') return false
  return defaultValue
}

async function resolvePriceChangeNotificationPolicy(tenantId) {
  const [enabledValue, rolesValue] = await Promise.all([
    getSettingValue('PRICE_CHANGE_NOTIFICATIONS_ENABLED', tenantId),
    getSettingValue('PRICE_CHANGE_NOTIFY_ROLES', tenantId),
  ])

  const enabled = normalizeBoolean(enabledValue ?? 'true', true)
  const roles = normalizeRoles(rolesValue ?? 'ADMIN,MANAGER')
  return { enabled, roles }
}

async function createPriceChangeNotifications({ productId, productName, oldCostPrice, newCostPrice, percentChange, reason, userId, roles, tenantId }) {
  const title = `Cost price changed: ${productName}`
  const direction = percentChange >= 0 ? 'increased' : 'decreased'
  const message = `Cost price ${direction} by ${Math.abs(percentChange).toFixed(2)}% (${oldCostPrice} -> ${newCostPrice})`
  const metadata = {
    productId,
    oldCostPrice,
    newCostPrice,
    percentChange,
    reason: reason || null,
  }

  const targets = Array.isArray(roles) ? roles : []
  if (!targets.length) {
    return
  }

  const values = []
  const params = []
  let index = 1

  targets.forEach((role) => {
    values.push(`($${index++}, 'PRICE_CHANGE', $${index++}, $${index++}, $${index++}::jsonb, $${index++}, $${index++})`)
    params.push(tenantId, title, message, JSON.stringify(metadata), role, userId)
  })

  await query(
    `
      INSERT INTO system_notifications (tenant_id, notification_type, title, message, metadata, target_role, created_by)
      VALUES ${values.join(',')}
    `,
    params,
  )
}

async function recordCostPriceHistory({ productId, oldCostPrice, newCostPrice, reason, userId, tenantId }) {
  const percentChange = normalizePercentChange(oldCostPrice, newCostPrice)
  const result = await query(
    `
      INSERT INTO product_cost_price_histories (
        tenant_id, product_id, old_cost_price, new_cost_price, percent_change, reason, changed_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [tenantId, productId, normalizePrice(oldCostPrice), normalizePrice(newCostPrice), percentChange, reason || null, userId || null],
  )

  await query(
    `
      DELETE FROM product_cost_price_histories
      WHERE id IN (
        SELECT id
        FROM product_cost_price_histories
        WHERE product_id = $1 AND tenant_id = $2
        ORDER BY changed_at DESC
        OFFSET 5
      )
    `,
    [productId, tenantId],
  )

  const threshold = await resolvePriceChangeThresholdPercent(tenantId)
  if (Math.abs(percentChange) >= threshold) {
    const policy = await resolvePriceChangeNotificationPolicy(tenantId)
    if (!policy.enabled) {
      return result.rows[0]
    }
    const productResult = await query('SELECT name FROM products WHERE id = $1 AND tenant_id = $2', [productId, tenantId])
    await createPriceChangeNotifications({
      productId,
      productName: productResult.rows[0]?.name || `#${productId}`,
      oldCostPrice: normalizePrice(oldCostPrice),
      newCostPrice: normalizePrice(newCostPrice),
      percentChange,
      reason,
      userId,
      roles: policy.roles,
      tenantId,
    })
  }

  return result.rows[0]
}

async function setPrimarySupplier({ productId, supplierId, userId, tenantId }) {
  if (!supplierId) {
    await query('UPDATE product_suppliers SET is_primary = FALSE WHERE product_id = $1 AND tenant_id = $2', [productId, tenantId])
    return
  }

  await query('UPDATE product_suppliers SET is_primary = FALSE WHERE product_id = $1 AND tenant_id = $2', [productId, tenantId])
  await query(
    `
      INSERT INTO product_suppliers (tenant_id, product_id, supplier_id, is_primary, created_by)
      VALUES ($1, $2, $3, TRUE, $4)
      ON CONFLICT (product_id, supplier_id)
      DO UPDATE SET is_primary = TRUE
    `,
    [tenantId, productId, supplierId, userId || null],
  )
}

async function loadProductImagesMap(productIds, tenantId) {
  if (!productIds.length) {
    return new Map()
  }

  const result = await query(
    `
      SELECT id, product_id, image_data, sort_order, is_primary, created_at
      FROM product_images
      WHERE product_id = ANY($1::int[]) AND tenant_id = $2
      ORDER BY is_primary DESC, sort_order ASC, created_at ASC
    `,
    [productIds, tenantId],
  )

  return result.rows.reduce((map, row) => {
    const currentItems = map.get(row.product_id) || []
    currentItems.push(row)
    map.set(row.product_id, currentItems)
    return map
  }, new Map())
}

async function loadPricingRulesMap(productIds, tenantId) {
  if (!productIds.length) {
    return new Map()
  }

  const result = await query(
    `
      SELECT id, product_id, rule_name, channel_key, markup_percentage, suggested_price, is_default, sort_order, created_at
      FROM product_pricing_rules
      WHERE product_id = ANY($1::int[]) AND tenant_id = $2
      ORDER BY sort_order ASC, created_at ASC
    `,
    [productIds, tenantId],
  )

  return result.rows.reduce((map, row) => {
    const currentItems = map.get(row.product_id) || []
    currentItems.push(row)
    map.set(row.product_id, currentItems)
    return map
  }, new Map())
}

async function loadBundleItemsMap(productIds, tenantId) {
  if (!productIds.length) {
    return new Map()
  }

  const result = await query(
    `
      SELECT
        product_bundle_items.id,
        product_bundle_items.combo_product_id,
        product_bundle_items.item_product_id,
        product_bundle_items.item_quantity,
        products.name AS item_product_name,
        products.sku AS item_product_sku
      FROM product_bundle_items
      INNER JOIN products ON products.id = product_bundle_items.item_product_id
        AND products.tenant_id = product_bundle_items.tenant_id
      WHERE product_bundle_items.combo_product_id = ANY($1::int[])
        AND product_bundle_items.tenant_id = $2
      ORDER BY product_bundle_items.id ASC
    `,
    [productIds, tenantId],
  )

  return result.rows.reduce((map, row) => {
    const currentItems = map.get(row.combo_product_id) || []
    currentItems.push(row)
    map.set(row.combo_product_id, currentItems)
    return map
  }, new Map())
}

async function saveProductImages(productId, images, tenantId) {
  await query('DELETE FROM product_images WHERE product_id = $1 AND tenant_id = $2', [productId, tenantId])

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
        INSERT INTO product_images (tenant_id, product_id, image_data, sort_order, is_primary)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [tenantId, productId, item.imageData, item.sortOrder, item.isPrimary],
    )

    insertedItems.push(result.rows[0])
  }

  return insertedItems
}

async function savePricingRules(productId, pricingRules, costPrice, markupPercentage, suggestedPrice, tenantId) {
  await query('DELETE FROM product_pricing_rules WHERE product_id = $1 AND tenant_id = $2', [productId, tenantId])

  const normalizedRules = normalizePricingRules(pricingRules, costPrice, markupPercentage, suggestedPrice)

  const insertedItems = []

  for (const rule of normalizedRules) {
    const result = await query(
      `
        INSERT INTO product_pricing_rules (tenant_id, product_id, rule_name, channel_key, markup_percentage, suggested_price, is_default, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [tenantId, productId, rule.ruleName, rule.channelKey, rule.markupPercentage, rule.suggestedPrice, rule.isDefault, rule.sortOrder],
    )

    insertedItems.push(result.rows[0])
  }

  return insertedItems
}

async function saveBundleItems(productId, skuType, bundleItems, tenantId) {
  await query('DELETE FROM product_bundle_items WHERE combo_product_id = $1 AND tenant_id = $2', [productId, tenantId])

  if (normalizeSkuType(skuType) !== 'COMBO') {
    return []
  }

  const normalizedItems = (Array.isArray(bundleItems) ? bundleItems : [])
    .map((item) => ({
      itemProductId: Number(item.itemProductId || item.item_product_id || item.productId),
      itemQuantity: Number(item.itemQuantity || item.item_quantity || item.quantity || 0),
    }))
    .filter((item) => item.itemProductId && item.itemQuantity > 0)

  const insertedItems = []

  for (const item of normalizedItems) {
    const result = await query(
      `
        INSERT INTO product_bundle_items (tenant_id, combo_product_id, item_product_id, item_quantity)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [tenantId, productId, item.itemProductId, item.itemQuantity],
    )

    insertedItems.push(result.rows[0])
  }

  return insertedItems
}

async function attachProductRelations(products, options = {}) {
  const productIds = products.map((item) => item.id)
  const tenantId = options.tenantId
  const [imagesMap, pricingRulesMap, bundleItemsMap] = await Promise.all([
    loadProductImagesMap(productIds, tenantId),
    loadPricingRulesMap(productIds, tenantId),
    loadBundleItemsMap(productIds, tenantId),
  ])

  return products.map((product) => {
    const images = imagesMap.get(product.id) || []
    const pricingRules = pricingRulesMap.get(product.id) || []
    const bundleItems = bundleItemsMap.get(product.id) || []
    const primaryImage = images.find((item) => item.is_primary) || images[0]
    const activePricingRule = resolveActivePricingRule(pricingRules, options.pricingChannel)
    const resolvedCost = Number(product.cost_price || 0)
    const resolvedMarkup = Number(activePricingRule?.markup_percentage ?? product.markup_percentage ?? 0)
    const storedActiveSuggested = Number(activePricingRule?.suggested_price || 0)
    const computedActiveSuggested = Number((resolvedCost * (1 + resolvedMarkup / 100)).toFixed(2)) || 0
    const resolvedActiveSuggested = storedActiveSuggested > 0 ? storedActiveSuggested : computedActiveSuggested

    return {
      ...maskProductCosts(product, options.allowCostAccess),
      image_data: primaryImage?.image_data || product.image_data || null,
      images,
      bundle_items: bundleItems,
      pricing_rules: maskPricingRules(pricingRules, options.allowCostAccess),
      active_pricing_rule: activePricingRule || null,
      active_suggested_price: activePricingRule ? resolvedActiveSuggested : product.suggested_price,
    }
  })
}

// 用户列表支持搜索和分页，避免账号多了以后一次性全拉
router.get('/users', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { search = '', all = 'false' } = req.query
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const searchPattern = getSearchPattern(search)
  const tenantId = getTenantId(req)

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT id, full_name, email, role, is_active, created_at
          FROM users
          WHERE tenant_id = $2
            AND (
              $1 = '%%'
              OR full_name ILIKE $1
              OR email ILIKE $1
              OR role ILIKE $1
            )
          ORDER BY created_at DESC
        `,
        [searchPattern, tenantId],
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
          WHERE tenant_id = $4
            AND (
              $1 = '%%'
              OR full_name ILIKE $1
              OR email ILIKE $1
              OR role ILIKE $1
            )
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `,
        [searchPattern, pageSize, offset, tenantId],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM users
          WHERE tenant_id = $2
            AND (
              $1 = '%%'
              OR full_name ILIKE $1
              OR email ILIKE $1
              OR role ILIKE $1
            )
        `,
        [searchPattern, tenantId],
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
    const tenantId = getTenantId(req)
    const passwordHash = await bcrypt.hash(password, 10)
    const result = await query(
      `
        INSERT INTO users (tenant_id, full_name, email, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, full_name, email, role, is_active, created_at
      `,
      [tenantId, fullName, email, passwordHash, role],
    )

    return res.status(201).json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create user.', error: error.message })
  }
})

router.put('/users/:id', authorizeRoles('ADMIN'), async (req, res) => {
  const { id } = req.params
  const { fullName, email, role, isActive, password } = req.body

  if (!fullName || !email || !role) {
    return res.status(400).json({ message: 'fullName, email and role are required.' })
  }

  try {
    const tenantId = getTenantId(req)
    const currentResult = await query('SELECT id FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId])
    if (!currentResult.rows[0]) {
      return res.status(404).json({ message: 'User not found.' })
    }

    let passwordHashClause = ''
    const params = [id, fullName, email, role, isActive ?? true, tenantId]

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10)
      params.push(passwordHash)
      passwordHashClause = ', password_hash = $7'
    }

    const result = await query(
      `
        UPDATE users
        SET
          full_name = $2,
          email = $3,
          role = $4,
          is_active = $5
          ${passwordHashClause}
        WHERE id = $1 AND tenant_id = $6
        RETURNING id, full_name, email, role, is_active, created_at
      `,
      params,
    )

    req.auditContext = {
      action: 'USERS_UPDATE',
      entityType: 'USERS',
      entityId: String(id),
      description: `Updated user #${id}`,
    }
    return res.json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update user.', error: error.message })
  }
})

router.delete('/users/:id', authorizeRoles('ADMIN'), async (req, res) => {
  const { id } = req.params

  if (Number(id) === Number(req.user.id)) {
    return res.status(400).json({ message: 'Cannot delete current login user.' })
  }

  try {
    const tenantId = getTenantId(req)
    const result = await query('DELETE FROM users WHERE id = $1 AND tenant_id = $2 RETURNING id', [id, tenantId])

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User not found.' })
    }

    req.auditContext = {
      action: 'USERS_DELETE',
      entityType: 'USERS',
      entityId: String(id),
      description: `Deleted user #${id}`,
    }
    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete user.', error: error.message })
  }
})

// 分类接口支持搜索和分页，同时保留 all=true 供下拉框取全量
router.get('/categories', async (req, res) => {
  const { search = '', all = 'false' } = req.query
  const searchPattern = getSearchPattern(search)
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const tenantId = getTenantId(req)

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT id, name, description, created_at
          FROM categories
          WHERE tenant_id = $2
            AND ($1 = '%%' OR name ILIKE $1 OR description ILIKE $1)
          ORDER BY name ASC
        `,
        [searchPattern, tenantId],
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
          WHERE tenant_id = $4
            AND ($1 = '%%' OR name ILIKE $1 OR description ILIKE $1)
          ORDER BY name ASC
          LIMIT $2 OFFSET $3
        `,
        [searchPattern, pageSize, offset, tenantId],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM categories
          WHERE tenant_id = $2
            AND ($1 = '%%' OR name ILIKE $1 OR description ILIKE $1)
        `,
        [searchPattern, tenantId],
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
    const tenantId = getTenantId(req)
    const result = await query(
      `
        INSERT INTO categories (tenant_id, name, description)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [tenantId, name, description || null],
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
    const tenantId = getTenantId(req)
    const result = await query(
      `
        UPDATE categories
        SET name = $2, description = $3
        WHERE id = $1 AND tenant_id = $4
        RETURNING *
      `,
      [id, name, description || null, tenantId],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Category not found.' })
    }
    return res.json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update category.', error: error.message })
  }
})

router.delete('/categories/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const tenantId = getTenantId(req)
    await query('DELETE FROM categories WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId])
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
  const tenantId = getTenantId(req)

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT id, name, code, address, manager_name, is_active, created_at
          FROM warehouses
          WHERE tenant_id = $3
            AND ($1 = '%%' OR name ILIKE $1 OR code ILIKE $1 OR address ILIKE $1 OR manager_name ILIKE $1)
            AND ($2 = FALSE OR is_active = TRUE)
          ORDER BY name ASC
        `,
        [searchPattern, onlyActive, tenantId],
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
          WHERE tenant_id = $5
            AND ($1 = '%%' OR name ILIKE $1 OR code ILIKE $1 OR address ILIKE $1 OR manager_name ILIKE $1)
            AND ($2 = FALSE OR is_active = TRUE)
          ORDER BY name ASC
          LIMIT $3 OFFSET $4
        `,
        [searchPattern, onlyActive, pageSize, offset, tenantId],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM warehouses
          WHERE tenant_id = $3
            AND ($1 = '%%' OR name ILIKE $1 OR code ILIKE $1 OR address ILIKE $1 OR manager_name ILIKE $1)
            AND ($2 = FALSE OR is_active = TRUE)
        `,
        [searchPattern, onlyActive, tenantId],
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
    const tenantId = getTenantId(req)
    const result = await query(
      `
        INSERT INTO warehouses (tenant_id, name, code, address, manager_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [tenantId, name, code, address || null, managerName || null, isActive ?? true],
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
    const tenantId = getTenantId(req)
    const result = await query(
      `
        UPDATE warehouses
        SET name = $2, code = $3, address = $4, manager_name = $5, is_active = $6
        WHERE id = $1 AND tenant_id = $7
        RETURNING *
      `,
      [id, name, code, address || null, managerName || null, isActive ?? true, tenantId],
    )

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Warehouse not found.' })
    }
    return res.json(result.rows[0])
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update warehouse.', error: error.message })
  }
})

router.delete('/warehouses/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const tenantId = getTenantId(req)
    await query('DELETE FROM warehouses WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId])
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
    pricingChannel = '',
    sort = 'created_at',
    order = 'desc',
  } = req.query
  const searchPattern = getSearchPattern(search)
  const resolvedStatus = status === 'all' ? (activeOnly === 'true' ? 'active' : 'all') : status
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const allowCostAccess = canViewCost(req)
  const tenantId = getTenantId(req)

  const safeOrder = String(order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const sortKey = String(sort || 'created_at').trim().toLowerCase()
  const sortColumnMap = {
    name: 'products.name',
    sku: 'products.sku',
    created_at: 'products.created_at',
    updated_at: 'products.updated_at',
    cost_price: 'products.cost_price',
    selling_price: 'products.selling_price',
    suggested_price: 'products.suggested_price',
  }
  const sortColumn = sortColumnMap[sortKey] || 'products.created_at'
  const orderClause = `ORDER BY ${sortColumn} ${safeOrder}, products.id DESC`

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT
            products.*,
            categories.name AS category_name,
            brands.name AS brand_name
          FROM products
          LEFT JOIN categories ON categories.id = products.category_id AND categories.tenant_id = products.tenant_id
          LEFT JOIN brands ON brands.id = products.brand_id AND brands.tenant_id = products.tenant_id
          WHERE products.tenant_id = $5
            AND (
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
          ${orderClause}
        `,
        [searchPattern, categoryId || null, resolvedStatus, hasBarcode, tenantId],
      )

      const items = await attachProductRelations(result.rows, { allowCostAccess, pricingChannel, tenantId })

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
            categories.name AS category_name,
            brands.name AS brand_name
          FROM products
          LEFT JOIN categories ON categories.id = products.category_id AND categories.tenant_id = products.tenant_id
          LEFT JOIN brands ON brands.id = products.brand_id AND brands.tenant_id = products.tenant_id
          WHERE products.tenant_id = $7
            AND (
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
          ${orderClause}
          LIMIT $5 OFFSET $6
        `,
        [searchPattern, categoryId || null, resolvedStatus, hasBarcode, pageSize, offset, tenantId],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM products
          LEFT JOIN categories ON categories.id = products.category_id AND categories.tenant_id = products.tenant_id
          WHERE products.tenant_id = $5
            AND (
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
        [searchPattern, categoryId || null, resolvedStatus, hasBarcode, tenantId],
      ),
    ])

    const items = await attachProductRelations(itemsResult.rows, { allowCostAccess, pricingChannel, tenantId })

    return res.json({
      items,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch products.', error: error.message })
  }
})

// 产品变体列表：用于库存/盘点等选择 SKU（变体级）
router.get('/product-variants', async (req, res) => {
  const { search = '', activeOnly = 'false', all = 'false', status = 'all' } = req.query
  const searchPattern = getSearchPattern(search)
  const resolvedStatus = status === 'all' ? (activeOnly === 'true' ? 'active' : 'all') : status
  const loadAll = all === 'true'
  const { page, pageSize, offset } = getPaginationParams(req.query)
  const tenantId = getTenantId(req)

  try {
    if (loadAll) {
      const result = await query(
        `
          SELECT
            product_variants.id,
            product_variants.product_id,
            product_variants.variant_label,
            product_variants.sku,
            product_variants.barcode,
            product_variants.reorder_level,
            product_variants.is_active,
            products.name AS product_name,
            products.unit,
            categories.name AS category_name
          FROM product_variants
          INNER JOIN products ON products.id = product_variants.product_id AND products.tenant_id = product_variants.tenant_id
          LEFT JOIN categories ON categories.id = products.category_id AND categories.tenant_id = products.tenant_id
          WHERE product_variants.tenant_id = $3
            AND (
              $1 = '%%'
              OR products.name ILIKE $1
              OR product_variants.sku ILIKE $1
              OR COALESCE(product_variants.variant_label, '') ILIKE $1
              OR COALESCE(product_variants.barcode, '') ILIKE $1
              OR COALESCE(categories.name, '') ILIKE $1
            )
            AND (
              $2 = 'all'
              OR ($2 = 'active' AND product_variants.is_active = TRUE)
              OR ($2 = 'inactive' AND product_variants.is_active = FALSE)
            )
          ORDER BY products.name ASC, product_variants.variant_label ASC
        `,
        [searchPattern, resolvedStatus, tenantId],
      )

      return res.json({
        items: result.rows,
        pagination: buildPagination(result.rows.length, 1, result.rows.length || 1),
      })
    }

    const [itemsResult, totalResult] = await Promise.all([
      query(
        `
          SELECT
            product_variants.id,
            product_variants.product_id,
            product_variants.variant_label,
            product_variants.sku,
            product_variants.barcode,
            product_variants.reorder_level,
            product_variants.is_active,
            products.name AS product_name,
            products.unit,
            categories.name AS category_name
          FROM product_variants
          INNER JOIN products ON products.id = product_variants.product_id AND products.tenant_id = product_variants.tenant_id
          LEFT JOIN categories ON categories.id = products.category_id AND categories.tenant_id = products.tenant_id
          WHERE product_variants.tenant_id = $5
            AND (
              $1 = '%%'
              OR products.name ILIKE $1
              OR product_variants.sku ILIKE $1
              OR COALESCE(product_variants.variant_label, '') ILIKE $1
              OR COALESCE(product_variants.barcode, '') ILIKE $1
              OR COALESCE(categories.name, '') ILIKE $1
            )
            AND (
              $2 = 'all'
              OR ($2 = 'active' AND product_variants.is_active = TRUE)
              OR ($2 = 'inactive' AND product_variants.is_active = FALSE)
            )
          ORDER BY products.name ASC, product_variants.variant_label ASC
          LIMIT $3 OFFSET $4
        `,
        [searchPattern, resolvedStatus, pageSize, offset, tenantId],
      ),
      query(
        `
          SELECT COUNT(*)::int AS total
          FROM product_variants
          INNER JOIN products ON products.id = product_variants.product_id AND products.tenant_id = product_variants.tenant_id
          LEFT JOIN categories ON categories.id = products.category_id AND categories.tenant_id = products.tenant_id
          WHERE product_variants.tenant_id = $3
            AND (
              $1 = '%%'
              OR products.name ILIKE $1
              OR product_variants.sku ILIKE $1
              OR COALESCE(product_variants.variant_label, '') ILIKE $1
              OR COALESCE(product_variants.barcode, '') ILIKE $1
              OR COALESCE(categories.name, '') ILIKE $1
            )
            AND (
              $2 = 'all'
              OR ($2 = 'active' AND product_variants.is_active = TRUE)
              OR ($2 = 'inactive' AND product_variants.is_active = FALSE)
            )
        `,
        [searchPattern, resolvedStatus, tenantId],
      ),
    ])

    return res.json({
      items: itemsResult.rows,
      pagination: buildPagination(totalResult.rows[0].total, page, pageSize),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch product variants.', error: error.message })
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

    return res.success({ token })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify passcode.', error: error.message })
  }
})

router.get('/products/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const allowCostAccess = canViewCost(req)
    const pricingChannel = req.query.pricingChannel || ''
    const tenantId = getTenantId(req)
    const [productResult, variantsResult, stockResult, movementResult, alertResult, imagesMap, pricingRulesMap, supplierResult, costHistoryResult] = await Promise.all([
      query(
        `
          SELECT
            products.*,
            categories.name AS category_name,
            brands.name AS brand_name
          FROM products
          LEFT JOIN categories ON categories.id = products.category_id AND categories.tenant_id = products.tenant_id
          LEFT JOIN brands ON brands.id = products.brand_id AND brands.tenant_id = products.tenant_id
          WHERE products.id = $1 AND products.tenant_id = $2
        `,
        [req.params.id, tenantId],
      ),
      query(
        `
          SELECT
            id,
            variant_label,
            sku,
            barcode,
            attributes,
            reorder_level,
            is_active,
            created_at,
            updated_at
          FROM product_variants
          WHERE product_id = $1 AND tenant_id = $2
          ORDER BY CASE WHEN variant_label = 'DEFAULT' THEN 0 ELSE 1 END, variant_label ASC, id ASC
        `,
        [req.params.id, tenantId],
      ),
      query(
        `
          SELECT
            stock_levels.id,
            stock_levels.quantity AS on_hand_quantity,
            stock_levels.allocated_quantity AS order_allocated_quantity,
            GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) AS warehouse_available_quantity,
            stock_levels.updated_at,
            warehouses.id AS warehouse_id,
            warehouses.name AS warehouse_name,
            warehouses.code AS warehouse_code
          FROM stock_levels
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id AND warehouses.tenant_id = stock_levels.tenant_id
          WHERE stock_levels.product_id = $1 AND stock_levels.tenant_id = $2
          ORDER BY warehouses.name ASC
        `,
        [req.params.id, tenantId],
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
          WHERE stock_movements.product_id = $1 AND stock_movements.tenant_id = $2
          ORDER BY stock_movements.created_at DESC
          LIMIT 10
        `,
        [req.params.id, tenantId],
      ),
      query(
        `
          SELECT
            warehouses.id AS warehouse_id,
            warehouses.name AS warehouse_name,
            stock_levels.quantity AS on_hand_quantity,
            stock_levels.allocated_quantity AS order_allocated_quantity,
            GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) AS warehouse_available_quantity,
            products.reorder_level,
            GREATEST(products.reorder_level - GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0), 0) AS shortage,
            COALESCE(low_stock_alert_states.status, 'OPEN') AS alert_status,
            assignees.full_name AS assigned_to_name
          FROM stock_levels
          INNER JOIN products ON products.id = stock_levels.product_id AND products.tenant_id = stock_levels.tenant_id
          INNER JOIN warehouses ON warehouses.id = stock_levels.warehouse_id AND warehouses.tenant_id = stock_levels.tenant_id
          LEFT JOIN low_stock_alert_states ON low_stock_alert_states.product_id = stock_levels.product_id
            AND low_stock_alert_states.warehouse_id = stock_levels.warehouse_id
            AND low_stock_alert_states.tenant_id = stock_levels.tenant_id
          LEFT JOIN users AS assignees ON assignees.id = low_stock_alert_states.assigned_to
          WHERE stock_levels.product_id = $1
            AND stock_levels.tenant_id = $2
            AND GREATEST(stock_levels.quantity - stock_levels.allocated_quantity, 0) <= products.reorder_level
          ORDER BY shortage DESC, warehouses.name ASC
        `,
        [req.params.id, tenantId],
      ),
      loadProductImagesMap([Number(req.params.id)], tenantId),
      loadPricingRulesMap([Number(req.params.id)], tenantId),
      query(
        `
          SELECT
            suppliers.id,
            suppliers.name,
            suppliers.contact_name,
            suppliers.phone,
            suppliers.email,
            suppliers.lead_time_days,
            suppliers.payment_terms,
            suppliers.is_active
          FROM product_suppliers
          INNER JOIN suppliers ON suppliers.id = product_suppliers.supplier_id AND suppliers.tenant_id = product_suppliers.tenant_id
          WHERE product_suppliers.product_id = $1
            AND product_suppliers.tenant_id = $2
            AND product_suppliers.is_primary = TRUE
          LIMIT 1
        `,
        [req.params.id, tenantId],
      ),
      query(
        `
          SELECT
            id,
            old_cost_price,
            new_cost_price,
            percent_change,
            reason,
            changed_by,
            changed_at
          FROM product_cost_price_histories
          WHERE product_id = $1 AND tenant_id = $2
          ORDER BY changed_at DESC
          LIMIT 5
        `,
        [req.params.id, tenantId],
      ),
    ])

    if (!productResult.rows[0]) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    const resolvedProduct = (await attachProductRelations([productResult.rows[0]], { allowCostAccess, pricingChannel, tenantId }))[0]

    return res.json({
      product: resolvedProduct,
      variants: variantsResult.rows,
      images: imagesMap.get(Number(req.params.id)) || resolvedProduct.images || [],
      pricingRules: maskPricingRules(pricingRulesMap.get(Number(req.params.id)) || [], allowCostAccess),
      stockLevels: stockResult.rows,
      recentMovements: movementResult.rows,
      alerts: alertResult.rows,
      supplier: supplierResult.rows[0] || null,
      costPriceHistory: costHistoryResult.rows,
      summary: {
        totalOnHand: stockResult.rows.reduce((sum, item) => sum + Number(item.on_hand_quantity), 0),
        totalAllocated: stockResult.rows.reduce((sum, item) => sum + Number(item.order_allocated_quantity), 0),
        totalAvailable: stockResult.rows.reduce((sum, item) => sum + Number(item.warehouse_available_quantity), 0),
        warehouseCount: stockResult.rows.length,
        lowStockCount: alertResult.rows.length,
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch product detail.', error: error.message })
  }
})

router.get('/products/:id/cost-price-history', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const tenantId = getTenantId(req)
    const result = await query(
      `
        SELECT
          id,
          old_cost_price,
          new_cost_price,
          percent_change,
          reason,
          changed_by,
          changed_at
        FROM product_cost_price_histories
        WHERE product_id = $1 AND tenant_id = $2
        ORDER BY changed_at DESC
        LIMIT 5
      `,
      [req.params.id, tenantId],
    )

    return res.json({ items: result.rows })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch cost price history.', error: error.message })
  }
})

router.put('/products/:id/primary-supplier', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { supplierId } = req.body

  try {
    const tenantId = getTenantId(req)
    const productExists = await query('SELECT id FROM products WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId])
    if (!productExists.rows[0]) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    if (supplierId) {
      const supplierResult = await query('SELECT id FROM suppliers WHERE id = $1 AND tenant_id = $2', [supplierId, tenantId])
      if (!supplierResult.rows[0]) {
        return res.status(400).json({ message: 'Supplier not found.' })
      }
    }

    await setPrimarySupplier({
      productId: Number(req.params.id),
      supplierId: supplierId ? Number(supplierId) : null,
      userId: req.user.id,
      tenantId,
    })

    req.auditContext = {
      action: 'PRODUCT_SUPPLIER_UPDATE',
      entityType: 'PRODUCT',
      entityId: String(req.params.id),
      description: `Updated primary supplier for product ${req.params.id}`,
    }

    return res.json({ updated: true })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update primary supplier.', error: error.message })
  }
})

router.post('/products/bulk', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { base, sizes, colors } = req.body || {}

  if (!base?.name || !base?.sku) {
    return res.status(400).json({ message: 'Product name and SKU are required.' })
  }

  function normalizeSizeToken(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .toUpperCase()
  }

  try {
    const tenantId = getTenantId(req)
    const normalizedSkuType = normalizeSkuType(base.skuType)

    if (normalizedSkuType !== 'SINGLE') {
      return res.status(400).json({ message: 'Bulk sizes only supports SINGLE SKU type.' })
    }

    const uniqSizes = []
    const sizeSeen = new Set()
    for (const raw of Array.isArray(sizes) ? sizes : []) {
      const trimmed = String(raw || '').trim()
      if (!trimmed) continue
      const token = normalizeSizeToken(trimmed)
      if (!token) continue
      if (sizeSeen.has(token)) continue
      sizeSeen.add(token)
      uniqSizes.push({ raw: trimmed, token })
    }

    const uniqColors = []
    const colorSeen = new Set()
    for (const raw of Array.isArray(colors) ? colors : []) {
      const trimmed = String(raw || '').trim()
      if (!trimmed) continue
      const token = normalizeSizeToken(trimmed)
      if (!token) continue
      if (colorSeen.has(token)) continue
      colorSeen.add(token)
      uniqColors.push({ raw: trimmed, token })
    }

    if (uniqSizes.length === 0 && uniqColors.length === 0) {
      return res.status(400).json({ message: 'Sizes or colors are required.' })
    }

    const comboCount = uniqSizes.length && uniqColors.length ? uniqSizes.length * uniqColors.length : uniqSizes.length || uniqColors.length
    if (comboCount > 100) {
      return res.status(400).json({ message: 'Too many variants. Max is 100.' })
    }

    const defaultPricingRule = getDefaultPricingRule(
      base.pricingRules,
      base.costPrice,
      base.markupPercentage,
      base.suggestedPrice ?? base.sellingPrice,
    )

    const primaryImage = (Array.isArray(base.images) && base.images[0]?.imageData) || base.imageData || null

    const result = await query(
      `
        INSERT INTO products (
          tenant_id,
          name,
          sku,
          sku_type,
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
          is_active,
          brand_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `,
      [
        tenantId,
        String(base.name).trim(),
        String(base.sku).trim(),
        normalizedSkuType,
        base.productCode || generateProductCode(),
        base.barcode || null,
        primaryImage,
        base.description || null,
        base.usageGuide || null,
        base.pros || null,
        base.cons || null,
        base.categoryId || null,
        base.unit || 'pcs',
        normalizePrice(base.costPrice),
        normalizePrice(base.sellingPrice),
        Number(defaultPricingRule.markupPercentage || 0),
        normalizePrice(defaultPricingRule.suggestedPrice),
        Number(base.reorderLevel || 0),
        base.isActive ?? true,
        base.brandId ? Number(base.brandId) : null,
      ],
    )

    const productId = result.rows[0].id

    await Promise.all([
      saveProductImages(productId, Array.isArray(base.images) && base.images.length ? base.images : primaryImage ? [primaryImage] : [], tenantId),
      savePricingRules(
        productId,
        base.pricingRules,
        base.costPrice,
        defaultPricingRule.markupPercentage,
        defaultPricingRule.suggestedPrice,
        tenantId,
      ),
      saveBundleItems(productId, normalizedSkuType, base.bundleItems, tenantId),
    ])

    if (base.primarySupplierId) {
      await setPrimarySupplier({ productId, supplierId: Number(base.primarySupplierId), userId: req.user.id, tenantId })
    }

    const variantsToCreate = [{ variantLabel: 'DEFAULT', sku: String(base.sku).trim(), barcode: base.barcode || null, attributes: {} }]

    if (uniqSizes.length && uniqColors.length) {
      for (const c of uniqColors) {
        for (const s of uniqSizes) {
          variantsToCreate.push({
            variantLabel: `${c.raw} / ${s.raw}`,
            sku: `${String(base.sku).trim()}-${c.token}-${s.token}`,
            barcode: null,
            attributes: { color: c.raw, size: s.raw },
          })
        }
      }
    } else if (uniqSizes.length) {
      for (const s of uniqSizes) {
        variantsToCreate.push({
          variantLabel: s.raw,
          sku: `${String(base.sku).trim()}-${s.token}`,
          barcode: null,
          attributes: { size: s.raw },
        })
      }
    } else {
      for (const c of uniqColors) {
        variantsToCreate.push({
          variantLabel: c.raw,
          sku: `${String(base.sku).trim()}-${c.token}`,
          barcode: null,
          attributes: { color: c.raw },
        })
      }
    }

    const skuCheck = await query('SELECT sku FROM product_variants WHERE tenant_id = $1 AND sku = ANY($2::text[])', [
      tenantId,
      variantsToCreate.map((v) => v.sku),
    ])
    if (skuCheck.rows.length) {
      const list = skuCheck.rows.map((r) => r.sku).slice(0, 10).join(', ')
      return res.status(400).json({ message: `Variant SKU already exists: ${list}` })
    }

    const createdVariants = []
    for (const v of variantsToCreate) {
      const created = await query(
        `
          INSERT INTO product_variants (
            tenant_id,
            product_id,
            variant_label,
            sku,
            barcode,
            attributes,
            reorder_level,
            is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
          ON CONFLICT (tenant_id, product_id, variant_label)
          DO UPDATE SET sku = EXCLUDED.sku, barcode = EXCLUDED.barcode, attributes = EXCLUDED.attributes, reorder_level = EXCLUDED.reorder_level, is_active = EXCLUDED.is_active, updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `,
        [tenantId, productId, v.variantLabel, v.sku, v.barcode, JSON.stringify(v.attributes || {}), base.reorderLevel ?? null, base.isActive ?? true],
      )
      createdVariants.push(created.rows[0])
    }

    const shouldAddStock = base.addToInventory === true && base.warehouseId && Number(base.initialQuantity) > 0
    if (shouldAddStock && createdVariants.length) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await postItemsToStock(client, {
          tenantId,
          warehouseId: Number(base.warehouseId),
          items: createdVariants.map((v) => ({ variant_id: v.id, quantity: Number(base.initialQuantity) })),
          direction: 1,
          referenceNo: 'Initial Stock - Variants',
          notes: 'Initial stock on product creation',
          userId: req.user.id,
        })
        await client.query('COMMIT')
      } catch (stockError) {
        await client.query('ROLLBACK')
        console.error('Failed to add initial stock:', stockError.message)
      } finally {
        client.release()
      }
    }

    const createdProduct = (await attachProductRelations([result.rows[0]], { allowCostAccess: canViewCost(req), tenantId }))[0]
    return res.status(201).json({ product: createdProduct, variants: createdVariants })
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(400).json({ message: 'SKU / product code / barcode already exists.' })
    }
    return res.status(500).json({ message: 'Failed to create product variants.', error: error.message })
  }
})

router.post('/products', authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const {
    name,
    sku,
    skuType,
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
    bundleItems,
    reorderLevel,
    isActive,
    primarySupplierId,
    brandId,
    addToInventory,
    warehouseId,
    initialQuantity,
  } = req.body

  if (!name || !sku) {
    return res.status(400).json({ message: 'Product name and SKU are required.' })
  }

  try {
    const tenantId = getTenantId(req)
    const defaultPricingRule = getDefaultPricingRule(pricingRules, costPrice, markupPercentage, suggestedPrice ?? sellingPrice)
    const primaryImage = (Array.isArray(images) && images[0]?.imageData) || imageData || null
    const result = await query(
      `
        INSERT INTO products (
          tenant_id,
          name,
          sku,
          sku_type,
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
          is_active,
          brand_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `,
      [
        tenantId,
        name,
        sku,
        normalizeSkuType(skuType),
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
        brandId ? Number(brandId) : null,
      ],
    )

    await Promise.all([
      saveProductImages(result.rows[0].id, Array.isArray(images) && images.length ? images : primaryImage ? [primaryImage] : [], tenantId),
      savePricingRules(
        result.rows[0].id,
        pricingRules,
        costPrice,
        defaultPricingRule.markupPercentage,
        defaultPricingRule.suggestedPrice,
        tenantId,
      ),
      saveBundleItems(result.rows[0].id, skuType, bundleItems, tenantId),
    ])

    await query(
      `
        INSERT INTO product_variants (
          tenant_id,
          product_id,
          variant_label,
          sku,
          barcode,
          attributes,
          reorder_level,
          is_active
        )
        VALUES ($1, $2, 'DEFAULT', $3, $4, '{}'::jsonb, $5, $6)
        ON CONFLICT (tenant_id, product_id, variant_label)
        DO UPDATE SET sku = EXCLUDED.sku, barcode = EXCLUDED.barcode, reorder_level = EXCLUDED.reorder_level, is_active = EXCLUDED.is_active, updated_at = CURRENT_TIMESTAMP
      `,
      [tenantId, result.rows[0].id, String(sku).trim(), barcode || null, Number(reorderLevel || 0), isActive ?? true],
    )

    if (primarySupplierId) {
      await setPrimarySupplier({ productId: result.rows[0].id, supplierId: Number(primarySupplierId), userId: req.user.id, tenantId })
    }

    const shouldAddStock = addToInventory === true && warehouseId && Number(initialQuantity) > 0
    const initialStockReferenceNo = ['Initial Stock', result.rows[0].sku].filter(Boolean).join(' - ')
    if (shouldAddStock) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await postItemsToStock(client, {
          tenantId,
          warehouseId: Number(warehouseId),
          items: [{ product_id: result.rows[0].id, quantity: Number(initialQuantity) }],
          direction: 1,
          referenceNo: initialStockReferenceNo,
          notes: 'Initial stock on product creation',
          userId: req.user.id,
        })
        await client.query('COMMIT')
      } catch (stockError) {
        await client.query('ROLLBACK')
        console.error('Failed to add initial stock:', stockError.message)
      } finally {
        client.release()
      }
    }

    const product = (await attachProductRelations([result.rows[0]], { allowCostAccess: canViewCost(req), tenantId }))[0]

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
    skuType,
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
    bundleItems,
    reorderLevel,
    isActive,
    primarySupplierId,
    costChangeReason,
    brandId,
  } = req.body

  if (!name || !sku) {
    return res.status(400).json({ message: 'Product name and SKU are required.' })
  }

  try {
    const tenantId = getTenantId(req)
    const existingResult = await query('SELECT cost_price FROM products WHERE id = $1 AND tenant_id = $2', [id, tenantId])
    if (!existingResult.rows[0]) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    const oldCostPrice = normalizePrice(existingResult.rows[0].cost_price)
    const hasCostPrice = !(costPrice === undefined || costPrice === null || costPrice === '')
    const newCostPrice = hasCostPrice ? normalizePrice(costPrice) : oldCostPrice
    const costChanged = oldCostPrice !== newCostPrice
    const allowCostAccess = canViewCost(req)

    if (costChanged && !allowCostAccess) {
      return res.status(403).json({ message: 'Cost access is required to change cost price.' })
    }

    if (costChanged && !String(costChangeReason || '').trim()) {
      return res.status(400).json({ message: 'Cost change reason is required when updating cost price.' })
    }

    const defaultPricingRule = getDefaultPricingRule(pricingRules, newCostPrice, markupPercentage, suggestedPrice ?? sellingPrice)
    const primaryImage = (Array.isArray(images) && images[0]?.imageData) || imageData || null
    const result = await query(
      `
        UPDATE products
        SET
          name = $2,
          sku = $3,
          sku_type = $4,
          product_code = $5,
          barcode = $6,
          image_data = $7,
          description = $8,
          usage_guide = $9,
          pros = $10,
          cons = $11,
          category_id = $12,
          unit = $13,
          cost_price = $14,
          selling_price = $15,
          markup_percentage = $16,
          suggested_price = $17,
          reorder_level = $18,
          is_active = $19,
          brand_id = $21,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND tenant_id = $20
        RETURNING *
      `,
      [
        id,
        name,
        sku,
        normalizeSkuType(skuType),
        productCode || generateProductCode(),
        barcode || null,
        primaryImage,
        description || null,
        usageGuide || null,
        pros || null,
        cons || null,
        categoryId || null,
        unit || 'pcs',
        newCostPrice,
        normalizePrice(sellingPrice),
        Number(defaultPricingRule.markupPercentage || 0),
        normalizePrice(defaultPricingRule.suggestedPrice),
        Number(reorderLevel || 0),
        isActive ?? true,
        tenantId,
        brandId === undefined ? null : (brandId ? Number(brandId) : null),
      ],
    )

    await Promise.all([
      saveProductImages(result.rows[0].id, Array.isArray(images) && images.length ? images : primaryImage ? [primaryImage] : [], tenantId),
      savePricingRules(
        result.rows[0].id,
        pricingRules,
        newCostPrice,
        defaultPricingRule.markupPercentage,
        defaultPricingRule.suggestedPrice,
        tenantId,
      ),
      saveBundleItems(result.rows[0].id, skuType, bundleItems, tenantId),
    ])

    await query(
      `
        INSERT INTO product_variants (
          tenant_id,
          product_id,
          variant_label,
          sku,
          barcode,
          attributes,
          reorder_level,
          is_active
        )
        VALUES ($1, $2, 'DEFAULT', $3, $4, '{}'::jsonb, $5, $6)
        ON CONFLICT (tenant_id, product_id, variant_label)
        DO UPDATE SET sku = EXCLUDED.sku, barcode = EXCLUDED.barcode, reorder_level = EXCLUDED.reorder_level, is_active = EXCLUDED.is_active, updated_at = CURRENT_TIMESTAMP
      `,
      [tenantId, result.rows[0].id, String(sku).trim(), barcode || null, Number(reorderLevel || 0), isActive ?? true],
    )

    if (primarySupplierId !== undefined) {
      await setPrimarySupplier({
        productId: result.rows[0].id,
        supplierId: primarySupplierId ? Number(primarySupplierId) : null,
        userId: req.user.id,
        tenantId,
      })
    }

    if (costChanged) {
      await recordCostPriceHistory({
        productId: result.rows[0].id,
        oldCostPrice,
        newCostPrice,
        reason: String(costChangeReason || '').trim(),
        userId: req.user.id,
        tenantId,
      })
    }

    const product = (await attachProductRelations([result.rows[0]], { allowCostAccess: canViewCost(req), tenantId }))[0]

    return res.json(product)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update product.', error: error.message })
  }
})

router.delete('/products/:id', authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const tenantId = getTenantId(req)
    await query('DELETE FROM products WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId])
    return res.status(204).send()
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete product.', error: error.message })
  }
})

module.exports = router
