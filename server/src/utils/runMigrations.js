const fs = require('fs')
const path = require('path')
const { pool } = require('../config/db')

// 中文说明：读取 database/migrations 目录下所有 .sql 文件，
// 按文件名前缀编号 001、002、… 升序执行，保证迁移顺序稳定。
// 为保证幂等：
// 1) 每个 SQL 建议使用 IF NOT EXISTS；
// 2) 整个应用启动时我们先创建 migrations_meta 表记录已执行版本号，
//    已经执行过的文件直接跳过，不会重复跑。
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'database', 'migrations')
const META_TABLE = 'migrations_meta'

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return []
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      fileName: name,
      version: String(path.basename(name, '.sql').split('_')[0] || path.basename(name, '.sql')),
      fullPath: path.join(MIGRATIONS_DIR, name),
    }))
}

async function ensureMetaTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${META_TABLE} (
      version TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

async function appliedVersions(client) {
  const rows = (await client.query(`SELECT version FROM ${META_TABLE}`)).rows
  return new Set(rows.map((r) => String(r.version)))
}

async function markApplied(client, version, fileName) {
  await client.query(
    `INSERT INTO ${META_TABLE} (version, file_name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING`,
    [version, fileName]
  )
}

async function runMigrations({ skipOnError = false, verbose = true } = {}) {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    if (verbose) console.warn('[migrations] directory not found, skip:', MIGRATIONS_DIR)
    return { applied: 0, skipped: 0, failed: [] }
  }

  const files = listMigrationFiles()
  const client = await pool.connect()
  const failed = []
  let applied = 0
  let skipped = 0

  try {
    await ensureMetaTable(client)
    const done = await appliedVersions(client)

    for (const file of files) {
      if (done.has(file.version)) {
        skipped += 1
        continue
      }

      const sql = fs.readFileSync(file.fullPath, 'utf8').trim()
      if (!sql) {
        skipped += 1
        continue
      }

      try {
        await client.query('BEGIN')
        await client.query(sql)
        await markApplied(client, file.version, file.fileName)
        await client.query('COMMIT')
        applied += 1
        if (verbose) console.log(`[migrations] applied: ${file.fileName}`)
      } catch (error) {
        await client.query('ROLLBACK')
        if (verbose) {
          console.error(`[migrations] FAILED: ${file.fileName}`, {
            message: error.message,
            code: error.code,
            where: error.where,
          })
        }
        failed.push({ fileName: file.fileName, version: file.version, message: error.message })
        if (!skipOnError) break
      }
    }
  } finally {
    client.release()
  }

  if (verbose) {
    console.log(`[migrations] done: applied=${applied}, skipped=${skipped}, failed=${failed.length}`)
  }
  return { applied, skipped, failed }
}

module.exports = {
  runMigrations,
}
