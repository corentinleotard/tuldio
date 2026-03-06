import { query } from '../../../lib/database/db.js';
import type { QuoteRow, QuoteLineRow } from '../domain/quote.entity.js';

export interface QuoteWithLines extends QuoteRow {
  lines: QuoteLineRow[];
}

export async function findQuoteById(input: {
  teamId: string;
  quoteId: string;
}): Promise<QuoteWithLines | null> {
  const result = await query<QuoteRow>(
    'SELECT * FROM quotes WHERE id = $1 AND team_id = $2 LIMIT 1',
    [input.quoteId, input.teamId],
  );

  const row = result.rows[0];
  if (!row) return null;

  const linesResult = await query<QuoteLineRow>(
    'SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY sort_order ASC',
    [input.quoteId],
  );

  return { ...row, lines: linesResult.rows };
}
