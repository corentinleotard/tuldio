import { query } from '../../../lib/database/db.js';
import { logger } from '../../../lib/infra/logger.js';

/**
 * Marks all sent invoices past their due_date as overdue.
 * Called by cron daily — no team scope (processes all teams).
 */
export async function markOverdueInvoices(): Promise<number> {
  const result = await query<{ id: string; team_id: string; number: string }>(
    `UPDATE invoices
     SET status = 'overdue'
     WHERE status = 'sent'
       AND due_date IS NOT NULL
       AND due_date < CURRENT_DATE
     RETURNING id, team_id, number`,
    [],
  );

  for (const row of result.rows) {
    logger.info('invoice.auto_overdue', { invoiceId: row.id, teamId: row.team_id, number: row.number });
  }

  return result.rows.length;
}
