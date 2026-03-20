import { query } from '../../../lib/database/db.js';
import type { InvoiceRow, InvoiceLineRow } from '../domain/invoice.entity.js';

export interface InvoiceWithLines extends InvoiceRow {
  lines: InvoiceLineRow[];
}

export async function findInvoicesByQuote(input: {
  teamId: string;
  quoteId: string;
  invoiceType?: string;
}): Promise<InvoiceWithLines[]> {
  const params: unknown[] = [input.teamId, input.quoteId];
  let typeFilter = '';
  if (input.invoiceType) {
    params.push(input.invoiceType);
    typeFilter = ` AND invoice_type = $${params.length}`;
  }

  const result = await query<InvoiceRow>(
    `SELECT id, team_id, created_by, client_id, quote_id, number, title, total_ht, total_ttc, status, invoice_type, source_invoice_id, situation_number, avoir_id, pdf_url, pdp_id, pdp_status, sent_at, paid_at, cancelled_at, due_date, prestation_date, created_at
     FROM invoices
     WHERE team_id = $1 AND quote_id = $2${typeFilter} AND status NOT IN ('cancelled', 'draft')
     ORDER BY created_at ASC`,
    params,
  );

  const invoices: InvoiceWithLines[] = [];
  for (const row of result.rows) {
    const linesResult = await query<InvoiceLineRow>(
      'SELECT id, invoice_id, prestation_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht FROM invoice_lines WHERE invoice_id = $1 ORDER BY sort_order ASC',
      [row.id],
    );
    invoices.push({ ...row, lines: linesResult.rows });
  }

  return invoices;
}
