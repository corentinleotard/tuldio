import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findClientById } from '../repository/find-client-by-id.js';
import { toClientView, type ClientView } from '../domain/client.view.js';

export async function getClient(input: {
  teamId: string;
  clientId: string;
}): Promise<ClientView> {
  const client = await findClientById(input);
  if (!client) {
    throw new HandledError(errorCodes.clientNotFound);
  }

  return toClientView(client);
}
