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
      ? `UPDATE quotes SET status = $1, sent_at = NOW() WHERE id = $2 AND team_id = $3 RETURNING *`
      : `UPDATE quotes SET status = $1 WHERE id = $2 AND team_id = $3 RETURNING *`,
    [input.status, input.quoteId, input.teamId],
  );

  return result.rows[0]!;
}
