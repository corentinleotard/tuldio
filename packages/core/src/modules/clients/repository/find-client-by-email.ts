import { query } from '../../../lib/database/db.js';
import type { ClientRow } from '../domain/client.entity.js';

export async function findClientByEmail(input: {
  teamId: string;
  email: string;
}): Promise<ClientRow | null> {
  const result = await query<ClientRow>(
    `SELECT id, team_id, first_name, last_name, company_name, siret, tva_number, email, phone, address, notes, created_at FROM clients WHERE team_id = $1 AND email = $2 LIMIT 1`,
    [input.teamId, input.email],
  );

  return result.rows[0] ?? null;
}
