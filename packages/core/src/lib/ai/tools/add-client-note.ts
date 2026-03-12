import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { addClientNote } from '../../../modules/clients/index.js';

export const addClientNoteTool = defineTool({
  name: 'add_client_note',
  description:
    `Add a note to a client. Takes a client ref.
When adding notes for multiple clients: add the note for the first client, then add for the next. One at a time.
Use type 'warning' for safety or access information (gate code, dangerous animal, difficult access).`,
  schema: z.object({
    ref: z.string().describe('Client ref (from current conversation tool results only, e.g. c0, c1)'),
    content: z.string().min(1).max(2000).describe('Note content'),
    type: z.enum(['note', 'warning']).default('note').describe("'warning' for safety/access, 'note' otherwise"),
  }),
  handler: async (args, ctx) => {
    const clientId = ctx.resolveRef(args.ref, 'client');
    await addClientNote({
      teamId: ctx.teamId,
      clientId,
      content: args.content,
      type: args.type,
    });
    return { result: { ref: args.ref, note: args.content } };
  },
});
