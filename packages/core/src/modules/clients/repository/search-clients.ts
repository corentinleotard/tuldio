import { query } from '../../../lib/database/db.js';
import type { ClientRow } from '../domain/client.entity.js';

export async function searchClients(input: {
  teamId: string;
  search: string;
}): Promise<ClientRow[]> {
  const result = await query<ClientRow>(
    `SELECT *, similarity(name, $1) as score
     FROM clients
     WHERE team_id = $2
       AND (name ILIKE '%' || $1 || '%' OR similarity(name, $1) > 0.3)
     ORDER BY score DESC
     LIMIT 5`,
    [input.search, input.teamId],
  );

  return result.rows;
}
