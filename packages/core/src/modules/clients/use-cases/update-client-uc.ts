import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findClientById } from '../repository/find-client-by-id.js';
import { updateClient } from '../repository/update-client.js';
import { toClientView, type ClientView } from '../domain/client.view.js';

export async function updateClientUc(input: {
  teamId: string;
  clientId: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<ClientView> {
  const existing = await findClientById({
    teamId: input.teamId,
    clientId: input.clientId,
  });
  if (!existing) {
    throw new HandledError(errorCodes.clientNotFound);
  }

  const updated = await updateClient(input);

  return toClientView(updated);
}
