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

test('integration: supplier stats aggregates invoices and top suppliers', { skip: !shouldRunDbTests }, async () => {
  const user = await createAdminUser()
  const token = await login(user)

  const tenantId = 1
  const startDate = '2099-01-01'
  const endDate = '2099-01-31'

  let supplierAId = null
  let supplierBId = null
  const deliveryOrderIds = []
  const invoiceIds = []

  try {
    const supplierA = await query(
      `INSERT INTO suppliers (tenant_id, name, company_name, is_active) VALUES ($1, $2, $3, TRUE) RETURNING id`,
      [tenantId, `Stats Supplier A ${randomSuffix()}`, 'Supplier A Co'],
    )
    supplierAId = supplierA.rows[0].id

    const supplierB = await query(
      `INSERT INTO suppliers (tenant_id, name, company_name, is_active) VALUES ($1, $2, $3, TRUE) RETURNING id`,
      [tenantId, `Stats Supplier B ${randomSuffix()}`, 'Supplier B Co'],
    )
    supplierBId = supplierB.rows[0].id

    const doA1 = await query(
      `INSERT INTO delivery_orders (tenant_id, supplier_id, do_no, do_date, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, supplierAId, `DO-A1-${randomSuffix()}`, '2099-01-10', user.id],
    )
    deliveryOrderIds.push(doA1.rows[0].id)

    const doA2 = await query(
      `INSERT INTO delivery_orders (tenant_id, supplier_id, do_no, do_date, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, supplierAId, `DO-A2-${randomSuffix()}`, '2099-01-11', user.id],
    )
    deliveryOrderIds.push(doA2.rows[0].id)

    const doB1 = await query(
      `INSERT INTO delivery_orders (tenant_id, supplier_id, do_no, do_date, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, supplierBId, `DO-B1-${randomSuffix()}`, '2099-01-12', user.id],
    )
    deliveryOrderIds.push(doB1.rows[0].id)

    const invA = await query(
      `INSERT INTO supplier_invoices (tenant_id, supplier_id, do_id, invoice_no, invoice_date, total_amount, total_quantity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7)
       RETURNING id`,
      [tenantId, supplierAId, doA1.rows[0].id, `INV-A-${randomSuffix()}`, '2099-01-15', 100.5, user.id],
    )
    invoiceIds.push(invA.rows[0].id)

    const invB = await query(
      `INSERT INTO supplier_invoices (tenant_id, supplier_id, do_id, invoice_no, invoice_date, total_amount, total_quantity, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7)
       RETURNING id`,
      [tenantId, supplierBId, doB1.rows[0].id, `INV-B-${randomSuffix()}`, '2099-01-16', 50, user.id],
    )
    invoiceIds.push(invB.rows[0].id)

    const res = await request(app)
      .get('/api/supplier-stats')
      .set('Authorization', `Bearer ${token}`)
      .query({ startDate, endDate, topN: 10 })

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.period.startDate, startDate)
    assert.equal(res.body.period.endDate, endDate)
    assert.equal(res.body.globalInvoiceTotal, 150.5)

    assert.ok(Array.isArray(res.body.totalsBySupplier))
    const totalsA = res.body.totalsBySupplier.find((x) => x.supplierId === supplierAId)
    const totalsB = res.body.totalsBySupplier.find((x) => x.supplierId === supplierBId)
    assert.equal(totalsA.totalAmount, 100.5)
    assert.equal(totalsA.invoiceCount, 1)
    assert.equal(totalsB.totalAmount, 50)
    assert.equal(totalsB.invoiceCount, 1)

    assert.ok(Array.isArray(res.body.topSuppliersByPurchaseCount))
    assert.equal(res.body.topSuppliersByPurchaseCount[0].supplierId, supplierAId)
    assert.equal(res.body.topSuppliersByPurchaseCount[0].orderCount, 2)
  } finally {
    if (invoiceIds.length) {
      await query('DELETE FROM supplier_invoices WHERE id = ANY($1)', [invoiceIds])
    }
    if (deliveryOrderIds.length) {
      await query('DELETE FROM delivery_orders WHERE id = ANY($1)', [deliveryOrderIds])
    }
    if (supplierAId) {
      await query('DELETE FROM suppliers WHERE id = $1', [supplierAId])
    }
    if (supplierBId) {
      await query('DELETE FROM suppliers WHERE id = $1', [supplierBId])
    }
    await query('DELETE FROM users WHERE id = $1', [user.id])
  }
})

test('integration: company monthly costs prevent duplicate category per month', { skip: !shouldRunDbTests }, async () => {
  const user = await createAdminUser()
  const token = await login(user)

  let createdId = null

  try {
    const exists = await query(`SELECT to_regclass('public.company_monthly_costs') AS name`)
    if (!exists.rows[0]?.name) {
      return
    }

    const payload = {
      periodYear: 2099,
      periodMonth: 2,
      categoryLabel: `rental_${randomSuffix()}`,
      amount: 1234.56,
      occurredDate: '2099-02-01',
      notes: 'Test monthly cost',
    }

    const createRes = await request(app)
      .post('/api/company-costs')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
    assert.equal(createRes.statusCode, 201)
    createdId = createRes.body.item.id

    const dupRes = await request(app)
      .post('/api/company-costs')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
    assert.equal(dupRes.statusCode, 409)
  } finally {
    if (createdId) {
      await query('DELETE FROM company_monthly_costs WHERE id = $1', [createdId])
    }
    await query('DELETE FROM users WHERE id = $1', [user.id])
  }
})

test('integration: customer monthly bill calculates total and supports status update', { skip: !shouldRunDbTests }, async () => {
  const user = await createAdminUser()
  const token = await login(user)

  let customerId = null
  let billId = null

  try {
    const exists = await query(`SELECT to_regclass('public.customers') AS customers, to_regclass('public.customer_bills') AS bills`)
    if (!exists.rows[0]?.customers || !exists.rows[0]?.bills) {
      return
    }

    const customerRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Billing Customer ${randomSuffix()}`,
        companyName: 'Billing Co',
        contactName: 'Alice',
        phone: '123',
        isActive: true,
      })
    assert.equal(customerRes.statusCode, 201)
    customerId = customerRes.body.data.id

    const billRes = await request(app)
      .post('/api/customer-bills')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId,
        periodYear: 2099,
        periodMonth: 3,
        dueDate: '2099-04-10',
        status: 'PENDING',
        currency: 'MYR',
        items: [
          { description: 'Service fee', quantity: 1, unitPrice: 200 },
          { description: 'Delivery', quantity: 2, unitPrice: 20 },
        ],
      })
    assert.equal(billRes.statusCode, 201)
    billId = billRes.body.bill.id
    assert.equal(billRes.body.bill.totalAmount, 240)
    assert.equal(billRes.body.bill.items.length, 2)

    const listRes = await request(app)
      .get('/api/customer-bills')
      .set('Authorization', `Bearer ${token}`)
      .query({ customerId, year: 2099, month: 3, page: 1, pageSize: 10 })
    assert.equal(listRes.statusCode, 200)
    assert.ok(Array.isArray(listRes.body.items))
    assert.ok(listRes.body.items.find((x) => x.id === billId))

    const statusRes = await request(app)
      .patch(`/api/customer-bills/${billId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'PAID' })
    assert.equal(statusRes.statusCode, 200)
    assert.equal(statusRes.body.status, 'PAID')

    const detailRes = await request(app)
      .get(`/api/customer-bills/${billId}`)
      .set('Authorization', `Bearer ${token}`)
    assert.equal(detailRes.statusCode, 200)
    assert.equal(detailRes.body.bill.status, 'PAID')
  } finally {
    if (billId) {
      await query('DELETE FROM customer_bills WHERE id = $1', [billId])
    }
    if (customerId) {
      await query('DELETE FROM customers WHERE id = $1', [customerId])
    }
    await query('DELETE FROM users WHERE id = $1', [user.id])
  }
})
