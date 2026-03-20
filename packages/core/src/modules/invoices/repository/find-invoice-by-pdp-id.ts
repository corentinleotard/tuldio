import { query } from '../../../lib/database/db.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';

export async function findInvoiceByPdpId(input: {
  pdpId: string;
}): Promise<{ id: string; team_id: string; pdp_status: string | null } | null> {
  const result = await query<Pick<InvoiceRow, 'id' | 'team_id' | 'pdp_status'>>(
    'SELECT id, team_id, pdp_status FROM invoices WHERE pdp_id = $1 LIMIT 1',
    [input.pdpId],
  );
  return result.rows[0] ?? null;
}
