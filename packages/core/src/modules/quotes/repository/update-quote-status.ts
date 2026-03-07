import { query } from '../../../lib/database/db.js';
import type { QuoteRow } from '../domain/quote.entity.js';

export async function updateQuoteStatus(input: {
  teamId: string;
  quoteId: string;
  status: string;
}): Promise<QuoteRow> {
  const isSent = input.status === 'sent';

  const result = await query<QuoteRow>(
    isSent
      ? `UPDATE quotes SET status = $1, sent_at = NOW() WHERE id = $2 AND team_id = $3 RETURNING id, team_id, created_by, client_id, number, title, total_ht, total_ttc, status, pdf_url, valid_until, sent_at, created_at`
      : `UPDATE quotes SET status = $1 WHERE id = $2 AND team_id = $3 RETURNING id, team_id, created_by, client_id, number, title, total_ht, total_ttc, status, pdf_url, valid_until, sent_at, created_at`,
    [input.status, input.quoteId, input.teamId],
  );

  return result.rows[0]!;
}
