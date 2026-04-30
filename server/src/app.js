require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const { auditTrail } = require('./middleware/auditTrail')
const { responseMiddleware } = require('./middleware/response')
const authRoutes = require('./routes/authRoutes')
const masterRoutes = require('./routes/masterRoutes')
const inventoryRoutes = require('./routes/inventoryRoutes')
const dashboardRoutes = require('./routes/dashboardRoutes')
const reportRoutes = require('./routes/reportRoutes')
const alertsRoutes = require('./routes/alertsRoutes')
const auditRoutes = require('./routes/auditRoutes')
const stockCountRoutes = require('./routes/stockCountRoutes')
const marketplaceRoutes = require('./routes/marketplaceRoutes')
const orderRoutes = require('./routes/orderRoutes')
const shippingRoutes = require('./routes/shippingRoutes')
const supplierRoutes = require('./routes/supplierRoutes')
const notificationRoutes = require('./routes/notificationRoutes')
const settingsRoutes = require('./routes/settingsRoutes')
const bankStatementRoutes = require('./routes/bankStatementRoutes')
const supplierPaymentRoutes = require('./routes/supplierPaymentRoutes')
const adminRoutes = require('./routes/adminRoutes')
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes')
const supplierInvoiceRoutes = require('./routes/supplierInvoiceRoutes')
const supplierReturnRoutes = require('./routes/supplierReturnRoutes')

const app = express()

// CORS 白名单：只允许指定的前端域名访问 API
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const corsOptions = {
  origin(origin, callback) {
    // 允许无 origin 的请求（如 Postman / 同源请求）
    if (!origin) return callback(null, true)
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}

// 基础中间件：安全头、跨域、日志、JSON 解析
app.use(
  helmet({
    contentSecurityPolicy: false, // 前端是 SPA，CSP 在 nginx 层处理
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
)
app.use(cors(corsOptions))
app.use(express.json({ limit: '8mb' }))
app.use(responseMiddleware)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(auditTrail)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/bank-statements', bankStatementRoutes)
app.use('/api', masterRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/alerts', alertsRoutes)
app.use('/api/audit-logs', auditRoutes)
app.use('/api/stock-counts', stockCountRoutes)
app.use('/api/marketplace', marketplaceRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/shipping', shippingRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/supplier-payments', supplierPaymentRoutes)
app.use('/api/purchase-orders', purchaseOrderRoutes)
app.use('/api/supplier-invoices', supplierInvoiceRoutes)
app.use('/api/supplier-returns', supplierReturnRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/settings', settingsRoutes)

// 统一兜底错误，避免服务端直接暴露堆栈给前端
app.use((error, _req, res, _next) => {
  if (res.fail) {
    return res.fail('INTERNAL_SERVER_ERROR', 'Internal server error.', { error: error.message }, 500)
  }

  return res.status(500).json({ message: 'Internal server error.', error: error.message })
})

module.exports = app
