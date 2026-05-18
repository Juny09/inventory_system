const express = require('express')
const { pool, query } = require('../config/db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { getTenantId } = require('../utils/tenant')

const router = express.Router()
router.use(authenticateToken)

/**
 * GET /api/prompts
 * 列出当前租户的所有 prompts
 */
router.get('/', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const result = await query(
      `SELECT id, name, is_default, created_at, updated_at
       FROM document_prompts
       WHERE tenant_id = $1
       ORDER BY is_default DESC, updated_at DESC`,
      [tenantId],
    )
    res.json({ prompts: result.rows })
  } catch (error) {
    console.error('List prompts error:', error)
    res.status(500).json({ message: 'Failed to list prompts.' })
  }
})

/**
 * GET /api/prompts/:id
 * 获取单个 prompt 详情
 */
router.get('/:id', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  const tenantId = getTenantId(req)
  const { id } = req.params
  try {
    const result = await query(
      `SELECT id, name, content, is_default, created_at, updated_at
       FROM document_prompts
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    )
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Prompt not found.' })
    }
    res.json(result.rows[0])
  } catch (error) {
    console.error('Get prompt error:', error)
    res.status(500).json({ message: 'Failed to get prompt.' })
  }
})

/**
 * GET /api/prompts/default/content
 * 获取当前租户的默认 prompt 内容
 */
router.get('/default/content', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  const tenantId = getTenantId(req)
  try {
    const result = await query(
      `SELECT id, name, content FROM document_prompts
       WHERE tenant_id = $1 AND is_default = TRUE
       LIMIT 1`,
      [tenantId],
    )
    if (result.rows[0]) {
      return res.json({ found: true, prompt: result.rows[0] })
    }
    // fallback to system default if no tenant default set
    const fallback = await query(
      `SELECT id, name, content FROM document_prompts
       WHERE tenant_id = 1 AND is_default = TRUE
       LIMIT 1`,
    )
    if (fallback.rows[0]) {
      return res.json({ found: true, prompt: fallback.rows[0], fallback: true })
    }
    return res.json({ found: false, prompt: null })
  } catch (error) {
    console.error('Get default prompt error:', error)
    res.status(500).json({ message: 'Failed to get default prompt.' })
  }
})

/**
 * POST /api/prompts
 * 创建新 prompt
 */
router.post('/', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  const tenantId = getTenantId(req)
  const { name, content, is_default } = req.body

  if (!name || !content) {
    return res.status(400).json({ message: 'Name and content are required.' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 如果设为 default，先取消其他 default
    if (is_default) {
      await client.query(
        `UPDATE document_prompts SET is_default = FALSE, updated_at = NOW()
         WHERE tenant_id = $1 AND is_default = TRUE`,
        [tenantId],
      )
    }

    const result = await client.query(
      `INSERT INTO document_prompts (tenant_id, name, content, is_default, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, name, content, is_default || false, req.user.id],
    )

    await client.query('COMMIT')
    res.status(201).json(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.message.includes('unique constraint') || error.message.includes('duplicate')) {
      return res.status(409).json({ message: 'A prompt with this name already exists.' })
    }
    console.error('Create prompt error:', error)
    res.status(500).json({ message: 'Failed to create prompt.' })
  } finally {
    client.release()
  }
})

/**
 * PUT /api/prompts/:id
 * 更新 prompt
 */
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  const tenantId = getTenantId(req)
  const { id } = req.params
  const { name, content, is_default } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (is_default) {
      await client.query(
        `UPDATE document_prompts SET is_default = FALSE, updated_at = NOW()
         WHERE tenant_id = $1 AND is_default = TRUE AND id <> $2`,
        [tenantId, id],
      )
    }

    const result = await client.query(
      `UPDATE document_prompts
       SET name = COALESCE($1, name),
           content = COALESCE($2, content),
           is_default = COALESCE($3, is_default),
           updated_at = NOW()
       WHERE tenant_id = $4 AND id = $5
       RETURNING *`,
      [name, content, is_default !== undefined ? is_default : null, tenantId, id],
    )

    await client.query('COMMIT')

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Prompt not found.' })
    }
    res.json(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.message.includes('unique constraint') || error.message.includes('duplicate')) {
      return res.status(409).json({ message: 'A prompt with this name already exists.' })
    }
    console.error('Update prompt error:', error)
    res.status(500).json({ message: 'Failed to update prompt.' })
  } finally {
    client.release()
  }
})

/**
 * DELETE /api/prompts/:id
 * 删除 prompt
 */
router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), async (req, res) => {
  const tenantId = getTenantId(req)
  const { id } = req.params
  try {
    const result = await query(
      `DELETE FROM document_prompts
       WHERE tenant_id = $1 AND id = $2
       RETURNING id`,
      [tenantId, id],
    )
    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Prompt not found.' })
    }
    res.json({ message: 'Prompt deleted.' })
  } catch (error) {
    console.error('Delete prompt error:', error)
    res.status(500).json({ message: 'Failed to delete prompt.' })
  }
})

module.exports = router
