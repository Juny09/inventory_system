const { Pool } = require('pg')

function shouldUseSsl(connectionString) {
  const value = String(connectionString || '')
  if (!value) return false
  // 显式关闭 SSL
  if (process.env.DB_SSL === 'false' || process.env.PGSSLMODE === 'disable') return false
  // 内网/Docker 网络无需 SSL
  if (value.includes('localhost') || value.includes('127.0.0.1') || value.includes('@db:')) return false
  // 显式启用 SSL
  if (value.includes('sslmode=require') || value.includes('ssl=true')) return true
  if (process.env.PGSSLMODE === 'require') return true
  if (process.env.DB_SSL === 'true') return true
  return false
}

const connectionString = process.env.DATABASE_URL

const pool = new Pool({
  connectionString,
  ...(shouldUseSsl(connectionString) ? { ssl: { rejectUnauthorized: false } } : {}),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000),
})

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
}
