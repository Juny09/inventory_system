const app = require('./app')
const { pool } = require('./config/db')

const port = process.env.PORT || 4000

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('DB connection timed out.')), timeoutMs)),
  ])
}

async function startServer() {
  const server = app.listen(port, () => {
    console.log(`Inventory API is running on http://localhost:${port}`)
  })

  try {
    const timeoutMs = Number(process.env.STARTUP_DB_TIMEOUT_MS || 8000)
    await withTimeout(pool.query('SELECT NOW()'), timeoutMs)
  } catch (error) {
    console.error('Failed to connect database on startup:', error.message)
    server.close(() => process.exit(1))
  }
}

startServer()
