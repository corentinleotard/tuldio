import { query } from '../../../lib/database/db.js';
import type { ClientRow } from '../domain/client.entity.js';

export async function searchClients(input: {
  teamId: string;
  search: string;
  limit?: number;
}): Promise<(ClientRow & { score: number; full_name_score: number })[]> {
  const limit = input.limit ?? 1000;
  const result = await query<ClientRow & { score: number; full_name_score: number }>(
    `SELECT id, team_id, first_name, last_name, company_name, siret, tva_number, email, phone, address, notes, created_at,
       GREATEST(
         similarity(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''), $1),
         similarity(COALESCE(last_name, '') || ' ' || COALESCE(first_name, ''), $1),
         similarity(COALESCE(last_name, ''), $1),
         similarity(COALESCE(first_name, ''), $1),
         similarity(COALESCE(company_name, ''), $1)
       ) as score,
       GREATEST(
         similarity(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''), $1),
         similarity(COALESCE(last_name, '') || ' ' || COALESCE(first_name, ''), $1),
         similarity(COALESCE(company_name, ''), $1)
       ) as full_name_score
     FROM clients
     WHERE team_id = $2
       AND (
         similarity(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''), $1) > 0.25
         OR similarity(COALESCE(last_name, ''), $1) > 0.35
         OR similarity(COALESCE(first_name, ''), $1) > 0.35
         OR similarity(COALESCE(company_name, ''), $1) > 0.3
         OR COALESCE(first_name, '') ILIKE '%' || $1 || '%'
         OR COALESCE(last_name, '') ILIKE '%' || $1 || '%'
         OR COALESCE(company_name, '') ILIKE '%' || $1 || '%'
       )
     ORDER BY score DESC
     LIMIT $3`,
    [input.search, input.teamId, limit],
  );

  return result.rows;
}
