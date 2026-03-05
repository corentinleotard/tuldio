import { query } from '../../../lib/database/db.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';

export async function findUnpaidInvoices(teamId: string): Promise<InvoiceRow[]> {
  const result = await query<InvoiceRow>(
    `SELECT * FROM invoices
     WHERE team_id = $1 AND status IN ('sent', 'overdue')
     ORDER BY due_date ASC`,
    [teamId],
  );

  return result.rows;
}
