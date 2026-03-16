import { query } from '../../../lib/database/db.js';

export async function findInvoiceTeamId(input: {
  invoiceId: string;
}): Promise<string | null> {
  const result = await query<{ team_id: string }>(
    'SELECT team_id FROM invoices WHERE id = $1 LIMIT 1',
    [input.invoiceId],
  );
  return result.rows[0]?.team_id ?? null;
}
