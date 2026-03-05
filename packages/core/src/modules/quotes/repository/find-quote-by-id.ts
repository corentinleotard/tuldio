import { query } from '../../../lib/database/db.js';
import type { QuoteRow } from '../domain/quote.entity.js';

export async function findQuoteById(input: {
  teamId: string;
  quoteId: string;
}): Promise<QuoteRow | null> {
  const result = await query<QuoteRow>(
    'SELECT * FROM quotes WHERE id = $1 AND team_id = $2 LIMIT 1',
    [input.quoteId, input.teamId],
  );

  return result.rows[0] ?? null;
}
