import { query } from '../../../lib/database/db.js';
import type { ClientRow } from '../domain/client.entity.js';

export async function searchClients(input: {
  teamId: string;
  search: string;
}): Promise<(ClientRow & { score: number })[]> {
  const result = await query<ClientRow & { score: number }>(
    `SELECT *,
       GREATEST(
         similarity(first_name || ' ' || last_name, $1),
         similarity(last_name || ' ' || first_name, $1),
         similarity(last_name, $1),
         similarity(first_name, $1)
       ) as score
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
     LIMIT 5`,
    [input.search, input.teamId],
  );

  return result.rows;
}
