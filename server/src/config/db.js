const { Pool } = require('pg')

// 统一管理数据库连接，方便后续扩展连接配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
}
