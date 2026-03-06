import { query } from '../../../lib/database/db.js';

export async function updateInvoicePdfUrl(input: {
  teamId: string;
  invoiceId: string;
  pdfUrl: string;
}): Promise<void> {
  await query(
    'UPDATE invoices SET pdf_url = $1 WHERE id = $2 AND team_id = $3',
    [input.pdfUrl, input.invoiceId, input.teamId],
  );
}
