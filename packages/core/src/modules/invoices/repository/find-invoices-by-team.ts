import { query } from '../../../lib/database/db.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';

export interface InvoiceWithClient extends InvoiceRow {
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
}

export async function findInvoicesByTeam(input: {
  teamId: string;
  clientId?: string | null;
  limit?: number;
}): Promise<InvoiceWithClient[]> {
  const limit = input.limit ?? 1000;
  const params: unknown[] = [input.teamId];
  let where = 'WHERE i.team_id = $1';

  if (input.clientId) {
    params.push(input.clientId);
    where += ` AND i.client_id = $${params.length}`;
  }

  params.push(limit);

  const result = await query<InvoiceWithClient>(
    `SELECT i.id, i.team_id, i.created_by, i.client_id, i.quote_id, i.number, i.title, i.total_ht, i.total_ttc, i.status, i.invoice_type, i.source_invoice_id, i.situation_number, i.avoir_id, i.pdf_url, i.sent_at, i.paid_at, i.cancelled_at, i.due_date, i.prestation_date, i.created_at, c.first_name || ' ' || c.last_name AS client_name, c.email AS client_email, c.phone AS client_phone
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     ${where}
     ORDER BY i.created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  return result.rows;
}
