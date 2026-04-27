const { Pool } = require('pg')

function shouldUseSsl(connectionString) {
  const value = String(connectionString || '')
  if (!value) return false
  if (value.includes('localhost') || value.includes('127.0.0.1')) return false
  if (value.includes('sslmode=require') || value.includes('ssl=true')) return true
  if (process.env.PGSSLMODE === 'require') return true
  if (process.env.NODE_ENV === 'production') return true
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
