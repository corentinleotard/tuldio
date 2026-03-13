import { query } from '../../../lib/database/db.js';
import type { QuoteRow } from '../domain/quote.entity.js';

export interface QuoteWithClient extends QuoteRow {
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
}

export async function findQuotesByTeam(input: {
  teamId: string;
  clientId?: string | null;
  limit?: number;
}): Promise<QuoteWithClient[]> {
  const limit = input.limit ?? 1000;
  const params: unknown[] = [input.teamId];
  let where = 'WHERE q.team_id = $1';

  if (input.clientId) {
    params.push(input.clientId);
    where += ` AND q.client_id = $${params.length}`;
  }

  params.push(limit);

  const result = await query<QuoteWithClient>(
    `SELECT q.id, q.team_id, q.created_by, q.client_id, q.number, q.title, q.total_ht, q.total_ttc, q.status, q.pdf_url, q.valid_until, q.sent_at, q.accepted_at, q.refused_at, q.cancelled_at, q.created_at, COALESCE(c.company_name, COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')) AS client_name, c.email AS client_email, c.phone AS client_phone
     FROM quotes q
     JOIN clients c ON c.id = q.client_id
     ${where}
     ORDER BY q.created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  return result.rows;
}
