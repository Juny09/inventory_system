const express = require('express')
const { query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')

const router = express.Router()

router.use(authenticateToken)

function normalizeBoolean(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue
  }
  if (typeof value === 'boolean') {
    return value
  }
  const lowered = String(value).trim().toLowerCase()
  if (lowered === 'true') return true
  if (lowered === 'false') return false
  return defaultValue
}

function normalizeRoles(value) {
  const allowed = new Set(['ADMIN', 'MANAGER', 'STAFF'])
  const roles = Array.isArray(value) ? value : String(value || '').split(',')
  const normalized = roles
    .map((role) => String(role || '').trim().toUpperCase())
    .filter((role) => allowed.has(role))
  return Array.from(new Set(normalized))
}

function normalizeCurrency(value) {
  const allowed = new Set(['MYR', 'USD'])
  const normalized = String(value || '').trim().toUpperCase()
  return allowed.has(normalized) ? normalized : null
}

async function getSetting(settingKey) {
  const result = await query('SELECT setting_value FROM system_settings WHERE setting_key = $1', [settingKey])
  return result.rows[0]?.setting_value ?? null
}

async function upsertSetting(settingKey, settingValue, userId) {
  await query(
    `
      INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (setting_key)
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
    `,
    [settingKey, String(settingValue), userId || null],
  )
}

router.get('/preferences', async (req, res) => {
  try {
    const result = await query('SELECT preferred_currency FROM users WHERE id = $1', [req.user.id])
    return res.json({
      currency: result.rows[0]?.preferred_currency || 'MYR',
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch preferences.', error: error.message })
  }
})

router.put('/preferences', async (req, res) => {
  const currency = normalizeCurrency(req.body?.currency)
  if (!currency) {
    return res.status(400).json({ message: 'currency must be MYR or USD.' })
  }

  try {
    await query('UPDATE users SET preferred_currency = $2 WHERE id = $1', [req.user.id, currency])
    req.auditContext = {
      action: 'SETTINGS_UPDATE',
      entityType: 'USER_PREFERENCES',
      entityId: String(req.user.id),
      description: 'Updated currency preference',
    }
    return res.json({ updated: true, currency })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update preferences.', error: error.message })
  }
})

router.get('/price-change', authorizeRoles('ADMIN'), async (_req, res) => {
  try {
    const [thresholdValue, enabledValue, rolesValue] = await Promise.all([
      getSetting('PRICE_CHANGE_ALERT_THRESHOLD_PERCENT'),
      getSetting('PRICE_CHANGE_NOTIFICATIONS_ENABLED'),
      getSetting('PRICE_CHANGE_NOTIFY_ROLES'),
    ])

    const threshold = Number(thresholdValue ?? process.env.PRICE_CHANGE_ALERT_THRESHOLD_PERCENT ?? '10')
    const normalizedThreshold = Number.isFinite(threshold) ? threshold : 10
    const enabled = normalizeBoolean(enabledValue ?? 'true', true)
    const roles = normalizeRoles(rolesValue ?? 'ADMIN,MANAGER')

    return res.json({
      thresholdPercent: normalizedThreshold,
      enabled,
      roles,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch settings.', error: error.message })
  }
})

router.put('/price-change', authorizeRoles('ADMIN'), async (req, res) => {
  const { thresholdPercent, enabled, roles } = req.body
  const parsedThreshold = Number(thresholdPercent)

  if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 1000) {
    return res.status(400).json({ message: 'thresholdPercent must be a number between 0 and 1000.' })
  }

  const normalizedEnabled = normalizeBoolean(enabled, true)
  const normalizedRoles = normalizeRoles(roles)

  if (normalizedEnabled && normalizedRoles.length === 0) {
    return res.status(400).json({ message: 'At least one role is required when notifications are enabled.' })
  }

  try {
    await Promise.all([
      upsertSetting('PRICE_CHANGE_ALERT_THRESHOLD_PERCENT', parsedThreshold, req.user.id),
      upsertSetting('PRICE_CHANGE_NOTIFICATIONS_ENABLED', normalizedEnabled ? 'true' : 'false', req.user.id),
      upsertSetting('PRICE_CHANGE_NOTIFY_ROLES', normalizedRoles.join(','), req.user.id),
    ])

    req.auditContext = {
      action: 'SETTINGS_UPDATE',
      entityType: 'SETTINGS',
      entityId: 'PRICE_CHANGE',
      description: 'Updated price change notification settings',
    }

    return res.json({ updated: true })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update settings.', error: error.message })
  }
})

module.exports = router
