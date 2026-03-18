import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { findClientById } from '../repository/find-client-by-id.js';
import { findClientByEmail } from '../repository/find-client-by-email.js';
import { findClientByPhone } from '../repository/find-client-by-phone.js';
import { findClientBySiret } from '../repository/find-client-by-siret.js';
import { updateClient } from '../repository/update-client.js';
import { toClientView, type ClientView } from '../domain/client.view.js';
import { normalizeEmail, isValidEmail } from '../domain/normalize-email.js';

export async function updateClientUc(input: {
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
}): Promise<ClientView> {
  const { teamId, clientId } = input;
  const email = input.email ? normalizeEmail(input.email) : input.email;

  if (email && !isValidEmail(email)) {
    throw new HandledError(errorCodes.invalidEmail);
  }

  const existing = await findClientById({ teamId, clientId });
  if (!existing) {
    throw new HandledError(errorCodes.clientNotFound);
  }

  // Dedup guards: only check if value is changing
  if (email && email !== existing.email) {
    const conflict = await findClientByEmail({ teamId, email });
    if (conflict) {
      throw new HandledError(errorCodes.clientDuplicateEmail);
    }
  }
  if (input.phone && input.phone !== existing.phone) {
    const conflict = await findClientByPhone({ teamId, phone: input.phone });
    if (conflict) {
      throw new HandledError(errorCodes.clientDuplicatePhone);
    }
  }
  if (input.siret && input.siret !== existing.siret) {
    const conflict = await findClientBySiret({ teamId, siret: input.siret });
    if (conflict) {
      throw new HandledError(errorCodes.clientDuplicateSiret);
    }
  }

  await updateClient({ ...input, email });

  logger.info('client.updated', { teamId: input.teamId, clientId: input.clientId });

  const updated = await findClientById({ teamId, clientId });

  return toClientView(updated!);
}
