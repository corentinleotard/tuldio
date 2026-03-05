import { query } from '../../../lib/database/db.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';

export async function updateInvoiceStatus(input: {
  teamId: string;
  invoiceId: string;
  status: string;
}): Promise<InvoiceRow> {
  let extraSets = '';
  if (input.status === 'sent') {
    extraSets = ', sent_at = NOW()';
  } else if (input.status === 'paid') {
    extraSets = ', paid_at = NOW()';
  }

  const result = await query<InvoiceRow>(
    `UPDATE invoices
     SET status = $1${extraSets}
     WHERE id = $2 AND team_id = $3
     RETURNING *`,
    [input.status, input.invoiceId, input.teamId],
  );

  return result.rows[0]!;
}
