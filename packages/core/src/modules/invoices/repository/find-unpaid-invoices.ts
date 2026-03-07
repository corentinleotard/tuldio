import { query } from '../../../lib/database/db.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';

export async function findUnpaidInvoices(input: {
  teamId: string;
  limit?: number;
}): Promise<InvoiceRow[]> {
  const limit = input.limit ?? 1000;
  const result = await query<InvoiceRow>(
    `SELECT id, team_id, created_by, client_id, quote_id, number, title, total_ht, total_ttc, status, pdf_url, sent_at, paid_at, due_date, created_at FROM invoices
     WHERE team_id = $1 AND status IN ('sent', 'overdue')
     ORDER BY due_date ASC
     LIMIT $2`,
    [input.teamId, limit],
  );

  return result.rows;
}
