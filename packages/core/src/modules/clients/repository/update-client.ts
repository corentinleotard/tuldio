import { query } from '../../../lib/database/db.js';
import type { ClientRow } from '../domain/client.entity.js';

export async function updateClient(input: {
  teamId: string;
  clientId: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<ClientRow> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${idx++}`);
    params.push(input.name);
  }
  if (input.email !== undefined) {
    fields.push(`email = $${idx++}`);
    params.push(input.email);
  }
  if (input.phone !== undefined) {
    fields.push(`phone = $${idx++}`);
    params.push(input.phone);
  }
  if (input.address !== undefined) {
    fields.push(`address = $${idx++}`);
    params.push(input.address);
  }

  params.push(input.clientId);
  const clientIdIdx = idx++;
  params.push(input.teamId);
  const teamIdIdx = idx;

  const result = await query<ClientRow>(
    `UPDATE clients SET ${fields.join(', ')}
     WHERE id = $${clientIdIdx} AND team_id = $${teamIdIdx}
     RETURNING *`,
    params,
  );

  return result.rows[0]!;
}
