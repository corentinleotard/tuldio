import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { addClientNote } from '../../../modules/clients/index.js';

export const addClientNoteTool = defineTool({
  name: 'add_client_note',
  description:
    `Add a note to the active client. Requires an active client (via resolve_client or detect_client).
When adding notes for multiple clients: add the note for the current active client FIRST, then resolve_client for the next one, then add their note. One at a time.
Use type 'warning' for safety or access information (gate code, dangerous animal, difficult access).`,
  schema: z.object({
    content: z.string().min(1).max(2000).describe('Note content'),
    type: z.enum(['note', 'warning']).default('note').describe("'warning' for safety/access, 'note' otherwise"),
  }),
  handler: async (args, ctx) => {
    if (!ctx.demandState.client) {
      throw new HandledError(errorCodes.noActiveClient);
    }
    await addClientNote({
      teamId: ctx.teamId,
      clientId: ctx.demandState.client.id,
      content: args.content,
      type: args.type,
    });
    return { result: { success: true } };
  },
});
