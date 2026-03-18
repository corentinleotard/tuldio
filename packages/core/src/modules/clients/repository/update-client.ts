import { query } from '../../../lib/database/db.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';

export async function updateClient(input: {
  teamId: string;
  clientId: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  siret?: string;
  tvaNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<void> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const updatableKeys = ['firstName', 'lastName', 'companyName', 'siret', 'tvaNumber', 'email', 'phone', 'address'] as const;
  const hasUpdate = updatableKeys.some((k) => input[k] !== undefined);

  if (!hasUpdate) {
    return;
  }

  if (input.firstName !== undefined) {
    fields.push(`first_name = $${idx++}`);
    params.push(input.firstName);
  }
  if (input.lastName !== undefined) {
    fields.push(`last_name = $${idx++}`);
    params.push(input.lastName);
  }
  if (input.companyName !== undefined) {
    fields.push(`company_name = $${idx++}`);
    params.push(input.companyName);
  }
  if (input.siret !== undefined) {
    fields.push(`siret = $${idx++}`);
    params.push(input.siret);
  }
  if (input.tvaNumber !== undefined) {
    fields.push(`tva_number = $${idx++}`);
    params.push(input.tvaNumber);
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

  try {
    await query(
      `UPDATE clients SET ${fields.join(', ')}
       WHERE id = $${clientIdIdx} AND team_id = $${teamIdIdx}`,
      params,
    );
  } catch (err: unknown) {
    const pgError = err as { code?: string; constraint?: string };
    if (pgError.code === '23505') {
      if (pgError.constraint === 'idx_clients_team_email') {
        throw new HandledError(errorCodes.clientDuplicateEmail);
      }
      if (pgError.constraint === 'idx_clients_team_phone') {
        throw new HandledError(errorCodes.clientDuplicatePhone);
      }
      if (pgError.constraint === 'idx_clients_team_siret') {
        throw new HandledError(errorCodes.clientDuplicateSiret);
      }
    }
    throw err;
  }
}
