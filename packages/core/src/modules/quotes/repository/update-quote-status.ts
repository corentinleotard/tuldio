import { query } from '../../../lib/database/db.js';
import type { QuoteRow } from '../domain/quote.entity.js';

export async function updateQuoteStatus(input: {
  teamId: string;
  quoteId: string;
  status: string;
}): Promise<QuoteRow> {
  const timestampSetMap: Record<string, string> = {
    sent: ', sent_at = NOW()',
    accepted: ', accepted_at = NOW()',
    refused: ', refused_at = NOW()',
    cancelled: ', cancelled_at = NOW()',
  };
  const extraSets = timestampSetMap[input.status] ?? '';

  const result = await query<QuoteRow>(
    `UPDATE quotes SET status = $1${extraSets} WHERE id = $2 AND team_id = $3 RETURNING id, team_id, created_by, client_id, number, title, total_ht, total_ttc, status, pdf_url, valid_until, sent_at, accepted_at, refused_at, cancelled_at, created_at`,
    [input.status, input.quoteId, input.teamId],
  );

  return result.rows[0]!;
}
