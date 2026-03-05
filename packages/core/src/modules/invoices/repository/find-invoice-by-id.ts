import { query } from '../../../lib/database/db.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';

export async function findInvoiceById(input: {
  teamId: string;
  invoiceId: string;
}): Promise<InvoiceRow | null> {
  const result = await query<InvoiceRow>(
    'SELECT * FROM invoices WHERE id = $1 AND team_id = $2 LIMIT 1',
    [input.invoiceId, input.teamId],
  );

  return result.rows[0] ?? null;
}
