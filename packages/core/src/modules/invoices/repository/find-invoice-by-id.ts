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
    'SELECT id, team_id, created_by, client_id, quote_id, number, title, total_ht, total_ttc, status, invoice_type, source_invoice_id, situation_number, avoir_id, pdf_url, sent_at, paid_at, cancelled_at, due_date, prestation_date, created_at FROM invoices WHERE id = $1 AND team_id = $2 LIMIT 1',
    [input.invoiceId, input.teamId],
  );

  const row = result.rows[0];
  if (!row) return null;

  const linesResult = await query<InvoiceLineRow>(
    'SELECT id, invoice_id, prestation_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht FROM invoice_lines WHERE invoice_id = $1 ORDER BY sort_order ASC',
    [input.invoiceId],
  );

  return { ...row, lines: linesResult.rows };
}
