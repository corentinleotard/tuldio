import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { ClientRow } from '../domain/client.entity.js';

const insertClientSchema = z.object({
  teamId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function insertClient(input: {
  teamId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<ClientRow> {
  const validated = insertClientSchema.parse(input);
  const id = generateId();

  const result = await query<ClientRow>(
    `INSERT INTO clients (id, team_id, name, email, phone, address)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      id,
      validated.teamId,
      validated.name,
      validated.email ?? null,
      validated.phone ?? null,
      validated.address ?? null,
    ],
  );

  return result.rows[0]!;
}
