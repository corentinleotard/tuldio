import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { addClientNote } from '../../../modules/clients/index.js';

export const addClientNoteTool = defineTool({
  name: 'add_client_note',
  description:
    `Add a note to a client. Use type 'warning' for safety/access info (dangerous animal, gate code, difficult access, site precautions). Default is 'note'.`,
  schema: z.object({
    clientId: z.string().uuid().describe('Client ID (from current conversation tool results only)'),
    content: z.string().min(1).max(2000).describe('Note content'),
    type: z.enum(['note', 'warning']).default('note').describe("'warning' for safety/access, 'note' otherwise"),
  }),
  handler: async (args, ctx) => {
    await addClientNote({
      teamId: ctx.teamId,
      clientId: args.clientId,
      content: args.content,
      type: args.type,
    });
    return { result: { success: true } };
  },
});
