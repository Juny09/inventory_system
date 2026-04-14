require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const { auditTrail } = require('./middleware/auditTrail')
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

const app = express()

// 基础中间件：安全头、跨域、日志、JSON 解析
app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '8mb' }))
app.use(morgan('dev'))
app.use(auditTrail)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
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

// 统一兜底错误，避免服务端直接暴露堆栈给前端
app.use((error, _req, res, _next) => {
  return res.status(500).json({
    message: 'Internal server error.',
    error: error.message,
  })
})

module.exports = app
