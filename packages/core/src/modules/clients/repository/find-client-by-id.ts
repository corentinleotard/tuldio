import { query } from '../../../lib/database/db.js';
import type { ClientRow } from '../domain/client.entity.js';

export async function findClientById(input: {
  teamId: string;
  clientId: string;
}): Promise<ClientRow | null> {
  const result = await query<ClientRow>(
    'SELECT * FROM clients WHERE id = $1 AND team_id = $2 LIMIT 1',
    [input.clientId, input.teamId],
  );

  return result.rows[0] ?? null;
}
