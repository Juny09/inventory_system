/**
 * 租户隔离辅助工具
 * 用于快速给现有 SQL 加上 tenant_id 过滤，避免跨租户数据泄漏
 */

/**
 * 从 req 中获取当前租户 ID（必须在 authenticateToken 之后使用）
 */
function getTenantId(req) {
  if (!req.tenantId) {
    throw new Error('Tenant context missing. Ensure authenticateToken middleware is applied.')
  }
  return req.tenantId
}

/**
 * 构造带 tenant_id 的 WHERE 片段
 * @param {string} tableAlias 表别名，如 'p' 表示 products p
 * @param {number} paramIndex 参数序号（$N 中的 N）
 * @returns {string} 例如 "p.tenant_id = $3"
 */
function tenantWhere(tableAlias, paramIndex) {
  const prefix = tableAlias ? `${tableAlias}.` : ''
  return `${prefix}tenant_id = $${paramIndex}`
}

/**
 * 把 tenantId 追加到参数数组末尾，并返回新参数数组和占位符索引
 * @param {Array} params 现有参数数组
 * @param {number} tenantId 当前租户 ID
 * @returns {{ params: Array, index: number }}
 */
function appendTenant(params, tenantId) {
  const newParams = [...params, tenantId]
  return { params: newParams, index: newParams.length }
}

module.exports = {
  getTenantId,
  tenantWhere,
  appendTenant,
}
