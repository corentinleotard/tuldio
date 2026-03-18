import { query } from '../../../lib/database/db.js';

export async function updateInvoiceStatus(input: {
  teamId: string;
  invoiceId: string;
  status: string;
}): Promise<void> {
  let extraSets = '';
  if (input.status === 'sent') {
    extraSets = ', sent_at = NOW()';
  } else if (input.status === 'paid') {
    extraSets = ', paid_at = NOW()';
  } else if (input.status === 'cancelled') {
    extraSets = ', cancelled_at = NOW()';
  }

  await query(
    `UPDATE invoices
     SET status = $1${extraSets}
     WHERE id = $2 AND team_id = $3`,
    [input.status, input.invoiceId, input.teamId],
  );
}
