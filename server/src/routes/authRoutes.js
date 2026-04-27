const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { query } = require('../config/db')
const { authenticateToken } = require('../middleware/auth')
const { createRateLimiter } = require('../middleware/rateLimit')

const router = express.Router()

const loginRateLimit = createRateLimiter({
  namespace: 'auth-login',
  windowMs: 60 * 1000,
  max: 10,
})

// 登录后返回 token 和当前用户信息，前端可直接保存到状态管理中
router.post('/login', loginRateLimit, async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' })
  }

  try {
    const result = await query(
      'SELECT id, full_name, email, password_hash, role, is_active, preferred_currency FROM users WHERE email = $1',
      [email],
    )
    const user = result.rows[0]

    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash)

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '8h',
    })

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
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Login failed.', error: error.message })
  }
})

// 刷新页面时可通过该接口恢复登录态
router.get('/me', authenticateToken, async (req, res) => {
  return res.json({ user: req.user })
})

module.exports = router
