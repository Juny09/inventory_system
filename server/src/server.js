const app = require('./app')
const { pool } = require('./config/db')
const { runMigrations } = require('./utils/runMigrations')

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

    // 中文说明：服务启动前执行数据库 migrations（001... 升序），
    // 已执行的通过 migrations_meta 表跳过，保证本地/Docker/K8s 三种环境都能自动补齐索引和结构变更。
    const shouldRunMigrations = String(process.env.RUN_MIGRATIONS_ON_STARTUP || '1') !== '0'
    if (shouldRunMigrations) {
      const migrationResult = await runMigrations({
        skipOnError: process.env.NODE_ENV === 'production',
      })
      if (migrationResult.failed.length && process.env.NODE_ENV === 'production') {
        // 生产环境：migration 失败不要让进程继续对外接流量，避免写入结构不一致的数据。
        // 但也不要直接 exit(1)：让你先通过 kubectl exec 手动修，保留现场。
        console.error('[startup] migrations failed in production; refusing to serve traffic.', migrationResult.failed)
        server.close(() => process.exit(2))
        return
      }
    }
  } catch (error) {
    const connectionString = String(process.env.DATABASE_URL || '')
    const safeConnectionString = connectionString.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@')

    console.error('Failed to connect database on startup:', {
      message: error?.message,
      code: error?.code,
      errno: error?.errno,
      syscall: error?.syscall,
      address: error?.address,
      port: error?.port,
      safeConnectionString,
      stack: error?.stack,
      raw: error,
    })

    server.close(() => process.exit(1))
  }
}

startServer()
