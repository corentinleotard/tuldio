import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { insertClient } from '../repository/insert-client.js';
import { findClientByEmail } from '../repository/find-client-by-email.js';
import { findClientByPhone } from '../repository/find-client-by-phone.js';
import { toClientView, type ClientView } from '../domain/client.view.js';
import { normalizeEmail, isValidEmail } from '../domain/normalize-email.js';

export async function createClient(input: {
  teamId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<ClientView> {
  const { teamId, phone } = input;
  const email = input.email ? normalizeEmail(input.email) : undefined;

  if (email && !isValidEmail(email)) {
    throw new HandledError(errorCodes.invalidEmail);
  }

  // Dedup guard: email uniqueness
  if (email) {
    const existing = await findClientByEmail({ teamId, email });
    if (existing) {
      throw new HandledError(errorCodes.clientDuplicateEmail);
    }
  }

  // Dedup guard: phone uniqueness
  if (phone) {
    const existing = await findClientByPhone({ teamId, phone });
    if (existing) {
      throw new HandledError(errorCodes.clientDuplicatePhone);
    }
  }

  const client = await insertClient({ ...input, email });

  logger.info('client.created', { teamId: input.teamId, clientId: client.id });

  return toClientView(client);
}
