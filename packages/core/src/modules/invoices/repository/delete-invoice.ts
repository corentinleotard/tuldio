import { query } from '../../../lib/database/db.js';

export async function deleteInvoice(input: {
  teamId: string;
  invoiceId: string;
}): Promise<boolean> {
  const result = await query(
    'DELETE FROM invoices WHERE id = $1 AND team_id = $2 AND status = $3',
    [input.invoiceId, input.teamId, 'draft'],
  );

  return (result.rowCount ?? 0) > 0;
}
