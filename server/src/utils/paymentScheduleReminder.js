const { query } = require('../config/db')

/**
 * On-demand reminder materialization for supplier payment schedules.
 * Converts eligible schedules into `system_notifications` entries so that
 * the existing top bar bell picks them up. Invoked at:
 *   - GET /api/notifications (main bell fetch)
 *   - GET /api/supplier-payment-schedules/upcoming
 *   - GET /api/supplier-payment-schedules/overdue
 *
 * Also performs lightweight status maintenance: any PENDING/PARTIAL schedule
 * whose due_date < today is flipped to OVERDUE.
 */
async function materializeReminders(tenantId) {
  if (!tenantId) return

  // 1. Flip expired pending/partial schedules to OVERDUE so downstream queries are consistent
  await query(
    `UPDATE supplier_payment_schedules
     SET status = 'OVERDUE', updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1
       AND status IN ('PENDING', 'PARTIAL')
       AND due_date < CURRENT_DATE
       AND amount_paid < amount_due`,
    [tenantId],
  )

  // 2. DUE reminders: schedules within `remind_days_before` window, not yet reminded, still unpaid
  const dueResult = await query(
    `SELECT sps.id, sps.period_month, sps.period_year, sps.due_date,
            sps.amount_due, sps.amount_paid, sps.remind_days_before,
            s.name AS supplier_name, s.company_name AS supplier_branch
     FROM supplier_payment_schedules sps
     INNER JOIN suppliers s ON s.id = sps.supplier_id AND s.tenant_id = sps.tenant_id
     WHERE sps.tenant_id = $1
       AND sps.reminder_sent = FALSE
       AND sps.status IN ('PENDING', 'PARTIAL')
       AND sps.due_date - sps.remind_days_before <= CURRENT_DATE
       AND sps.due_date >= CURRENT_DATE`,
    [tenantId],
  )

  for (const row of dueResult.rows) {
    const supplierLabel = row.supplier_branch
      ? `${row.supplier_name} (${row.supplier_branch})`
      : row.supplier_name
    const period = `${row.period_year}-${String(row.period_month).padStart(2, '0')}`
    const remaining = Number(row.amount_due) - Number(row.amount_paid)
    await query(
      `INSERT INTO system_notifications
         (tenant_id, notification_type, title, message, metadata, target_role, created_by)
       VALUES ($1, 'PAYMENT_DUE', $2, $3, $4, 'MANAGER', NULL)`,
      [
        tenantId,
        `Payment due: ${supplierLabel} — ${period}`,
        `A supplier payment of ${remaining.toFixed(2)} is due on ${String(row.due_date).slice(0, 10)}.`,
        JSON.stringify({ schedule_id: row.id, supplier_name: supplierLabel, period, due_date: String(row.due_date).slice(0, 10), amount: remaining }),
      ],
    )
    await query(
      `UPDATE supplier_payment_schedules SET reminder_sent = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [row.id],
    )
  }

  // 3. OVERDUE reminders: re-check rows flagged OVERDUE whose last overdue reminder wasn't today
  const overdueResult = await query(
    `SELECT sps.id, sps.period_month, sps.period_year, sps.due_date,
            sps.amount_due, sps.amount_paid,
            s.name AS supplier_name, s.company_name AS supplier_branch
     FROM supplier_payment_schedules sps
     INNER JOIN suppliers s ON s.id = sps.supplier_id AND s.tenant_id = sps.tenant_id
     WHERE sps.tenant_id = $1
       AND sps.status = 'OVERDUE'
       AND (sps.overdue_reminded_date IS NULL OR sps.overdue_reminded_date < CURRENT_DATE)`,
    [tenantId],
  )

  for (const row of overdueResult.rows) {
    const supplierLabel = row.supplier_branch
      ? `${row.supplier_name} (${row.supplier_branch})`
      : row.supplier_name
    const period = `${row.period_year}-${String(row.period_month).padStart(2, '0')}`
    const remaining = Number(row.amount_due) - Number(row.amount_paid)
    await query(
      `INSERT INTO system_notifications
         (tenant_id, notification_type, title, message, metadata, target_role, created_by)
       VALUES ($1, 'PAYMENT_OVERDUE', $2, $3, $4, 'MANAGER', NULL)`,
      [
        tenantId,
        `Payment OVERDUE: ${supplierLabel} — ${period}`,
        `Payment of ${remaining.toFixed(2)} was due on ${String(row.due_date).slice(0, 10)} and is still unpaid.`,
        JSON.stringify({ schedule_id: row.id, supplier_name: supplierLabel, period, due_date: String(row.due_date).slice(0, 10), amount: remaining }),
      ],
    )
    await query(
      `UPDATE supplier_payment_schedules SET overdue_reminded_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [row.id],
    )
  }
}

module.exports = { materializeReminders }
