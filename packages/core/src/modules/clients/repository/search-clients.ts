import { query } from '../../../lib/database/db.js';
import type { ClientRow } from '../domain/client.entity.js';

export async function searchClients(input: {
  teamId: string;
  search: string;
  limit?: number;
}): Promise<(ClientRow & { score: number; full_name_score: number })[]> {
  const limit = input.limit ?? 1000;
  const result = await query<ClientRow & { score: number; full_name_score: number }>(
    `SELECT id, team_id, first_name, last_name, email, phone, address, notes, created_at,
       GREATEST(
         similarity(first_name || ' ' || last_name, $1),
         similarity(last_name || ' ' || first_name, $1),
         similarity(last_name, $1),
         similarity(first_name, $1)
       ) as score,
       GREATEST(
         similarity(first_name || ' ' || last_name, $1),
         similarity(last_name || ' ' || first_name, $1)
       ) as full_name_score
     FROM clients
     WHERE team_id = $2
       AND (
         similarity(first_name || ' ' || last_name, $1) > 0.25
         OR similarity(last_name, $1) > 0.35
         OR similarity(first_name, $1) > 0.35
         OR first_name ILIKE '%' || $1 || '%'
         OR last_name ILIKE '%' || $1 || '%'
       )
     ORDER BY score DESC
     LIMIT $3`,
    [input.search, input.teamId, limit],
  );

  return result.rows;
}
