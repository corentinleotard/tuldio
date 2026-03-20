import { query } from '../../../lib/database/db.js';

export async function updateInvoicePdpStatus(input: {
  teamId: string;
  invoiceId: string;
  pdpId: string | null;
  pdpStatus: string | null;
}): Promise<void> {
  await query(
    `UPDATE invoices SET pdp_id = $1, pdp_status = $2 WHERE id = $3 AND team_id = $4`,
    [input.pdpId, input.pdpStatus, input.invoiceId, input.teamId],
  );
}
