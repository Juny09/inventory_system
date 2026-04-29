const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { query, pool } = require('../config/db')
const { authenticateToken } = require('../middleware/auth')
const { createRateLimiter } = require('../middleware/rateLimit')

const router = express.Router()

const loginRateLimit = createRateLimiter({
  namespace: 'auth-login',
  windowMs: 60 * 1000,
  max: 10,
})

const registerRateLimit = createRateLimiter({
  namespace: 'auth-register',
  windowMs: 60 * 60 * 1000, // 每小时
  max: 5, // 防止恶意批量注册
})

// 登录：支持 tenant_code（新）或不传（fallback 到 DEFAULT 租户，兼容老客户端）
router.post('/login', loginRateLimit, async (req, res) => {
  const { email, password } = req.body
  const tenantCode = (req.body.tenantCode || req.body.tenant_code || 'DEFAULT').trim().toUpperCase()

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' })
  }

  try {
    // 1. 先根据 tenant_code 找租户
    const tenantResult = await query(
      'SELECT id, code, name, status FROM tenants WHERE UPPER(code) = $1',
      [tenantCode],
    )
    const tenant = tenantResult.rows[0]

    if (!tenant) {
      return res.status(401).json({ message: 'Invalid company code, email or password.' })
    }

    if (tenant.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Company account is suspended.' })
    }

    // 2. 在该租户下找用户
    const result = await query(
      `SELECT id, full_name, email, password_hash, role, is_active, preferred_currency, tenant_id
       FROM users
       WHERE email = $1 AND tenant_id = $2`,
      [email, tenant.id],
    )
    const user = result.rows[0]

    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Invalid company code, email or password.' })
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash)

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid company code, email or password.' })
    }

    // 3. 签发 token（包含 tenantId）
    const token = jwt.sign(
      { userId: user.id, role: user.role, tenantId: user.tenant_id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' },
    )

    req.auditUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    }

    return res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        preferred_currency: user.preferred_currency || 'MYR',
        tenant_id: user.tenant_id,
      },
      tenant: {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Login failed.', error: error.message })
  }
})

// 注册新公司（租户）+ 初始管理员
router.post('/register-tenant', registerRateLimit, async (req, res) => {
  const { tenantCode, tenantName, adminName, adminEmail, password, contactPhone } = req.body

  if (!tenantCode || !tenantName || !adminName || !adminEmail || !password) {
    return res.status(400).json({
      message: 'tenantCode, tenantName, adminName, adminEmail, password are required.',
    })
  }

  const code = String(tenantCode).trim().toUpperCase()
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    return res.status(400).json({
      message: 'Company code must be 3-40 chars, A-Z, 0-9, _ or -.',
    })
  }

  if (String(password).length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 检查公司代码是否已存在
    const exists = await client.query('SELECT id FROM tenants WHERE UPPER(code) = $1', [code])
    if (exists.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'Company code already taken.' })
    }

    // 创建租户
    const tenantResult = await client.query(
      `INSERT INTO tenants (code, name, status, plan, max_users, contact_email, contact_phone)
       VALUES ($1, $2, 'ACTIVE', 'FREE', 5, $3, $4)
       RETURNING id, code, name`,
      [code, tenantName, adminEmail, contactPhone || null],
    )
    const tenant = tenantResult.rows[0]

    // 创建管理员账号
    const passwordHash = await bcrypt.hash(password, 10)
    const userResult = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, tenant_id)
       VALUES ($1, $2, $3, 'ADMIN', $4)
       RETURNING id, full_name, email, role, preferred_currency, tenant_id`,
      [adminName, adminEmail, passwordHash, tenant.id],
    )
    const user = userResult.rows[0]

    await client.query('COMMIT')

    // 签发 token 自动登录
    const token = jwt.sign(
      { userId: user.id, role: user.role, tenantId: user.tenant_id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' },
    )

    return res.status(201).json({
      token,
      user,
      tenant,
      message: 'Company registered successfully.',
    })
  } catch (error) {
    await client.query('ROLLBACK')
    return res.status(500).json({ message: 'Registration failed.', error: error.message })
  } finally {
    client.release()
  }
})

// 刷新页面时可通过该接口恢复登录态
router.get('/me', authenticateToken, async (req, res) => {
  return res.json({ user: req.user, tenant: req.tenant })
})

module.exports = router
