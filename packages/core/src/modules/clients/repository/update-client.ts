import { query } from '../../../lib/database/db.js';
import type { ClientRow } from '../domain/client.entity.js';

export async function updateClient(input: {
  teamId: string;
  clientId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<ClientRow> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (
    input.firstName === undefined &&
    input.lastName === undefined &&
    input.email === undefined &&
    input.phone === undefined &&
    input.address === undefined
  ) {
    const result = await query<ClientRow>(
      `SELECT * FROM clients WHERE id = $1 AND team_id = $2`,
      [input.clientId, input.teamId],
    );
    return result.rows[0]!;
  }

  if (input.firstName !== undefined) {
    fields.push(`first_name = $${idx++}`);
    params.push(input.firstName);
  }
  if (input.lastName !== undefined) {
    fields.push(`last_name = $${idx++}`);
    params.push(input.lastName);
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
