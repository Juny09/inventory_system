async function writeAuditLog(executor, payload) {
  const metadata = payload.metadata ? JSON.stringify(payload.metadata) : '{}'

  await executor.query(
    `
      INSERT INTO audit_logs (
        user_id,
        user_email,
        user_role,
        action,
        entity_type,
        entity_id,
        method,
        path,
        description,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    `,
    [
      payload.userId || null,
      payload.userEmail || null,
      payload.userRole || null,
      payload.action,
      payload.entityType,
      payload.entityId || null,
      payload.method,
      payload.path,
      payload.description || null,
      metadata,
    ],
  )
}

module.exports = {
  writeAuditLog,
}
