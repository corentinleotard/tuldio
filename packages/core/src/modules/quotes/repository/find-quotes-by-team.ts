import { query } from '../../../lib/database/db.js';
import type { QuoteRow } from '../domain/quote.entity.js';

export interface QuoteWithClient extends QuoteRow {
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
}

export async function findQuotesByTeam(
  teamId: string,
): Promise<QuoteWithClient[]> {
  const result = await query<QuoteWithClient>(
    `SELECT q.*, c.first_name || ' ' || c.last_name AS client_name, c.email AS client_email, c.phone AS client_phone
     FROM quotes q
     JOIN clients c ON c.id = q.client_id
     WHERE q.team_id = $1
     ORDER BY q.created_at DESC
     LIMIT 200`,
    [teamId],
  );

  return result.rows;
}
