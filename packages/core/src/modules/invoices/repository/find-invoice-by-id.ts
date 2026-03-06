import { query } from '../../../lib/database/db.js';
import type { InvoiceRow, InvoiceLineRow } from '../domain/invoice.entity.js';

export interface InvoiceWithLines extends InvoiceRow {
  lines: InvoiceLineRow[];
}

export async function findInvoiceById(input: {
  teamId: string;
  invoiceId: string;
}): Promise<InvoiceWithLines | null> {
  const result = await query<InvoiceRow>(
    'SELECT * FROM invoices WHERE id = $1 AND team_id = $2 LIMIT 1',
    [input.invoiceId, input.teamId],
  );

  const row = result.rows[0];
  if (!row) return null;

  const linesResult = await query<InvoiceLineRow>(
    'SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY sort_order ASC',
    [input.invoiceId],
  );

  return { ...row, lines: linesResult.rows };
}
