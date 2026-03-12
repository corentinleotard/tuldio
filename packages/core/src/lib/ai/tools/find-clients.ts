import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { resolveClient } from '../../../modules/clients/index.js';

export const findClientsTool = defineTool({
  name: 'find_clients',
  description:
    `Search for clients by name (fuzzy matching). Returns a list of matches with refs.
Use this to find a client before performing actions on them. If the user mentions a client name, call this first to get the ref.
If exactly one match is found, proceed with the action. If multiple matches, ask the user to pick.
If no match is found and the user's intent is clear (e.g. "crée un devis pour X"), create the client directly with create_client and continue — do not ask for confirmation.`,
  schema: z.object({
    search: z.string().min(1).max(200).describe('Client name or search term'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    const resolution = await resolveClient({ teamId: ctx.teamId, search: args.search });

    if (resolution.status === 'exact_match' && resolution.client) {
      const ref = ctx.registerRef('client', resolution.client.id);
      return {
        result: {
          clients: [{
            ref,
            name: `${resolution.client.firstName} ${resolution.client.lastName}`,
            email: resolution.client.email,
            phone: resolution.client.phone,
          }],
        },
      };
    }

    if (resolution.status === 'ambiguous' && resolution.candidates) {
      const clients = resolution.candidates.map((c: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null }) => {
        const ref = ctx.registerRef('client', c.id);
        return {
          ref,
          name: `${c.firstName} ${c.lastName}`,
          email: c.email,
          phone: c.phone,
        };
      });

      return {
        result: { clients },
        ...(clients.length <= 3 ? {
          richCard: { type: 'client_picker', data: resolution.candidates },
        } : {}),
      };
    }

    return { result: { clients: [] } };
  },
});
