import { query } from '../../../lib/database/db.js';

export async function updateQuotePdfUrl(input: {
  teamId: string;
  quoteId: string;
  pdfUrl: string;
}): Promise<void> {
  await query(
    'UPDATE quotes SET pdf_url = $1 WHERE id = $2 AND team_id = $3',
    [input.pdfUrl, input.quoteId, input.teamId],
  );
}
