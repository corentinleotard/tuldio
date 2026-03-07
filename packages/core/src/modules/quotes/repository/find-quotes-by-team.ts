import { query } from '../../../lib/database/db.js';
import type { QuoteRow } from '../domain/quote.entity.js';

export interface QuoteWithClient extends QuoteRow {
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
}

export async function findQuotesByTeam(input: {
  teamId: string;
  limit?: number;
}): Promise<QuoteWithClient[]> {
  const limit = input.limit ?? 1000;
  const result = await query<QuoteWithClient>(
    `SELECT q.id, q.team_id, q.created_by, q.client_id, q.number, q.title, q.total_ht, q.total_ttc, q.status, q.pdf_url, q.valid_until, q.sent_at, q.created_at, c.first_name || ' ' || c.last_name AS client_name, c.email AS client_email, c.phone AS client_phone
     FROM quotes q
     JOIN clients c ON c.id = q.client_id
     WHERE q.team_id = $1
     ORDER BY q.created_at DESC
     LIMIT $2`,
    [input.teamId, limit],
  );

  return result.rows;
}
