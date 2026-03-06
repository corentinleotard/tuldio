import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findClientById } from '../repository/find-client-by-id.js';
import { updateClientNotes } from '../repository/update-client-notes.js';

export async function addClientNote(input: {
  teamId: string;
  clientId: string;
  content: string;
  type?: 'note' | 'warning';
}): Promise<void> {
  const client = await findClientById({
    teamId: input.teamId,
    clientId: input.clientId,
  });
  if (!client) {
    throw new HandledError(errorCodes.clientNotFound);
  }

  const notes = [
    ...client.notes,
    { content: input.content, type: input.type ?? 'note', createdAt: new Date().toISOString() },
  ];

  await updateClientNotes({
    teamId: input.teamId,
    clientId: input.clientId,
    notes,
  });
}
