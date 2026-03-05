import { query } from '../../../lib/database/db.js';
import type { QuoteRow } from '../domain/quote.entity.js';

export interface QuoteWithClient extends QuoteRow {
  client_name: string;
}

export async function findQuotesByTeam(
  teamId: string,
): Promise<QuoteWithClient[]> {
  const result = await query<QuoteWithClient>(
    `SELECT q.*, c.name AS client_name
     FROM quotes q
     JOIN clients c ON c.id = q.client_id
     WHERE q.team_id = $1
     ORDER BY q.created_at DESC`,
    [teamId],
  );

  return result.rows;
}
