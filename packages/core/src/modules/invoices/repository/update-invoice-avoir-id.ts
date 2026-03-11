import { query } from '../../../lib/database/db.js';

export async function updateInvoiceAvoirId(input: {
  teamId: string;
  invoiceId: string;
  avoirId: string | null;
}): Promise<void> {
  await query(
    'UPDATE invoices SET avoir_id = $1 WHERE id = $2 AND team_id = $3',
    [input.avoirId, input.invoiceId, input.teamId],
  );
}
