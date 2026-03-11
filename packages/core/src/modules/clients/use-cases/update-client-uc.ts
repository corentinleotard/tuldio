import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { findClientById } from '../repository/find-client-by-id.js';
import { updateClient } from '../repository/update-client.js';
import { toClientView, type ClientView } from '../domain/client.view.js';
import { normalizeEmail, isValidEmail } from '../domain/normalize-email.js';

export async function updateClientUc(input: {
  teamId: string;
  clientId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<ClientView> {
  const email = input.email ? normalizeEmail(input.email) : input.email;

  if (email && !isValidEmail(email)) {
    throw new HandledError(errorCodes.invalidEmail);
  }

  const existing = await findClientById({
    teamId: input.teamId,
    clientId: input.clientId,
  });
  if (!existing) {
    throw new HandledError(errorCodes.clientNotFound);
  }

  const updated = await updateClient({ ...input, email });

  logger.info('client.updated', { teamId: input.teamId, clientId: input.clientId });

  return toClientView(updated);
}
