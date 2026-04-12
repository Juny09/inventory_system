const app = require('./app')
const { pool } = require('./config/db')

const port = process.env.PORT || 4000

// 启动前先验证数据库连接，方便快速发现环境配置问题
async function startServer() {
  try {
    await pool.query('SELECT NOW()')
    app.listen(port, () => {
      console.log(`Inventory API is running on http://localhost:${port}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error.message)
    process.exit(1)
  }
}

startServer()
