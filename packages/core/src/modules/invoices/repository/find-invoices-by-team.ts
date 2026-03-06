import { query } from '../../../lib/database/db.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';

export interface InvoiceWithClient extends InvoiceRow {
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
}

export async function findInvoicesByTeam(
  teamId: string,
): Promise<InvoiceWithClient[]> {
  const result = await query<InvoiceWithClient>(
    `SELECT i.*, c.first_name || ' ' || c.last_name AS client_name, c.email AS client_email, c.phone AS client_phone
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.team_id = $1
     ORDER BY i.created_at DESC
     LIMIT 200`,
    [teamId],
  );

  return result.rows;
}
