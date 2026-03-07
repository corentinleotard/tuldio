import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import type { ClientRow } from '../domain/client.entity.js';

const insertClientSchema = z.object({
  teamId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function insertClient(input: {
  teamId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<ClientRow> {
  const validated = insertClientSchema.parse(input);
  const id = generateId();

  try {
    const result = await query<ClientRow>(
      `INSERT INTO clients (id, team_id, first_name, last_name, email, phone, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, team_id, first_name, last_name, email, phone, address, notes, created_at`,
      [
        id,
        validated.teamId,
        validated.firstName,
        validated.lastName,
        validated.email ?? null,
        validated.phone ?? null,
        validated.address ?? null,
      ],
    );

    return result.rows[0]!;
  } catch (err: unknown) {
    const pgError = err as { code?: string; constraint?: string };
    if (pgError.code === '23505') {
      if (pgError.constraint === 'idx_clients_team_email') {
        throw new HandledError(errorCodes.clientDuplicateEmail);
      }
      if (pgError.constraint === 'idx_clients_team_phone') {
        throw new HandledError(errorCodes.clientDuplicatePhone);
      }
    }
    throw err;
  }
}
