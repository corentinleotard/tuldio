import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { insertClient } from '../repository/insert-client.js';
import { findClientByEmail } from '../repository/find-client-by-email.js';
import { findClientByPhone } from '../repository/find-client-by-phone.js';
import { findClientBySiret } from '../repository/find-client-by-siret.js';
import { toClientView, type ClientView } from '../domain/client.view.js';
import { normalizeEmail, isValidEmail } from '../domain/normalize-email.js';

export async function createClient(input: {
  teamId: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  siret?: string;
  tvaNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<ClientView> {
  const { teamId, phone } = input;
  const email = input.email ? normalizeEmail(input.email) : undefined;

  // Must have either a name or a company
  if (!input.firstName && !input.lastName && !input.companyName) {
    throw new HandledError(errorCodes.invalidInput, 'Un nom ou une raison sociale est requis');
  }

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

  // Dedup guard: SIRET uniqueness (B2B)
  if (input.siret) {
    const existing = await findClientBySiret({ teamId, siret: input.siret });
    if (existing) {
      throw new HandledError(errorCodes.clientDuplicateSiret);
    }
  }

  const client = await insertClient({ ...input, email });

  logger.info('client.created', { teamId: input.teamId, clientId: client.id });

  return toClientView(client);
}
