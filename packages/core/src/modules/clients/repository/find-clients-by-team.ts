import { query } from '../../../lib/database/db.js';
import type { ClientRow } from '../domain/client.entity.js';

export async function findClientsByTeam(input: {
  teamId: string;
  limit?: number;
}): Promise<ClientRow[]> {
  const limit = input.limit ?? 1000;
  const result = await query<ClientRow>(
    'SELECT id, team_id, first_name, last_name, company_name, siret, tva_number, email, phone, address, notes, created_at FROM clients WHERE team_id = $1 ORDER BY COALESCE(company_name, last_name) ASC, first_name ASC LIMIT $2',
    [input.teamId, limit],
  );

  return result.rows;
}
