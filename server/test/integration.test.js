const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const bcrypt = require('bcryptjs')

const app = require('../src/app')
const { query } = require('../src/config/db')

const shouldRunDbTests = process.env.RUN_DB_TESTS === 'true'

function randomSuffix() {
  return Math.random().toString(16).slice(2)
}

async function createAdminUser() {
  const email = `test-admin-${randomSuffix()}@example.com`
  const password = `Passw0rd!${randomSuffix()}`
  const passwordHash = await bcrypt.hash(password, 10)
  const result = await query(
    `
      INSERT INTO users (full_name, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, 'ADMIN', TRUE)
      RETURNING id, email
    `,
    ['Test Admin', email, passwordHash],
  )
  return { id: result.rows[0].id, email, password }
}

async function login({ email, password }) {
  const res = await request(app).post('/api/auth/login').send({ email, password })
  assert.equal(res.statusCode, 200)
  assert.ok(res.body.success)
  assert.ok(res.body.data?.token)
  return res.body.data.token
}

test('integration: supplier CRUD and product supplier assignment', { skip: !shouldRunDbTests }, async () => {
  const user = await createAdminUser()
  const token = await login(user)

  let supplierId = null
  let productId = null

  try {
    const supplierRes = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Supplier', contactName: 'Alice', phone: '123', leadTimeDays: 3, isActive: true })
    assert.equal(supplierRes.statusCode, 201)
    supplierId = supplierRes.body.data.id

    const productRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Product',
        sku: `SKU-${randomSuffix()}`,
        skuType: 'SINGLE',
        categoryId: null,
        unit: 'pcs',
        costPrice: 10,
        sellingPrice: 20,
        reorderLevel: 5,
        isActive: true,
        primarySupplierId: supplierId,
      })
    assert.equal(productRes.statusCode, 201)
    productId = productRes.body.data.id

    const detailRes = await request(app).get(`/api/products/${productId}`).set('Authorization', `Bearer ${token}`)
    assert.equal(detailRes.statusCode, 200)
    assert.equal(detailRes.body.data.supplier.id, supplierId)

    const supplierDetailRes = await request(app).get(`/api/suppliers/${supplierId}`).set('Authorization', `Bearer ${token}`)
    assert.equal(supplierDetailRes.statusCode, 200)
    assert.ok(Array.isArray(supplierDetailRes.body.data.products))
  } finally {
    if (productId) {
      await query('DELETE FROM products WHERE id = $1', [productId])
    }
    if (supplierId) {
      await query('DELETE FROM suppliers WHERE id = $1', [supplierId])
    }
    await query('DELETE FROM users WHERE id = $1', [user.id])
  }
})

test('integration: cost price history and notifications', { skip: !shouldRunDbTests }, async () => {
  const user = await createAdminUser()
  const token = await login(user)

  let productId = null

  try {
    const productRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Price History Product',
        sku: `SKU-${randomSuffix()}`,
        skuType: 'SINGLE',
        unit: 'pcs',
        costPrice: 10,
        sellingPrice: 20,
        reorderLevel: 1,
        isActive: true,
      })
    assert.equal(productRes.statusCode, 201)
    productId = productRes.body.data.id

    const unlockRes = await request(app)
      .post('/api/products/cost-access')
      .set('Authorization', `Bearer ${token}`)
      .send({ passcode: user.password })
    assert.equal(unlockRes.statusCode, 200)
    const costToken = unlockRes.body.data.token
    assert.ok(costToken)

    const updateRes = await request(app)
      .put(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-cost-access-token', costToken)
      .send({
        name: 'Price History Product',
        sku: `SKU-${randomSuffix()}`,
        skuType: 'SINGLE',
        unit: 'pcs',
        costPrice: 12,
        sellingPrice: 20,
        markupPercentage: 30,
        reorderLevel: 1,
        isActive: true,
        pricingRules: [],
        bundleItems: [],
        costChangeReason: 'Supplier increased price',
      })
    assert.equal(updateRes.statusCode, 200)

    const historyRes = await request(app)
      .get(`/api/products/${productId}/cost-price-history`)
      .set('Authorization', `Bearer ${token}`)
    assert.equal(historyRes.statusCode, 200)
    assert.ok(Array.isArray(historyRes.body.data.items))
    assert.ok(historyRes.body.data.items.length >= 1)

    const notificationsRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`)
      .query({ type: 'PRICE_CHANGE', unreadOnly: 'false', page: 1, pageSize: 10 })
    assert.equal(notificationsRes.statusCode, 200)
    assert.ok(Array.isArray(notificationsRes.body.data.items))
  } finally {
    if (productId) {
      await query('DELETE FROM products WHERE id = $1', [productId])
    }
    await query("DELETE FROM system_notifications WHERE created_by = $1 AND notification_type = 'PRICE_CHANGE'", [user.id])
    await query('DELETE FROM users WHERE id = $1', [user.id])
  }
})

