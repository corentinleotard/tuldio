import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { resolveClient } from '../../../modules/clients/index.js';

export const resolveClientTool = defineTool({
  name: 'resolve_client',
  description:
    `Search for an existing client by name, email, or phone. Must be called before creating any document.
Returns: exact_match (proceed), ambiguous (client picker or ask user to clarify), or no_match (propose creation).`,
  schema: z.object({
    search: z.string().min(1).max(200).describe('Client name to search for'),
    email: z.string().email().optional().describe('Client email if mentioned'),
    phone: z.string().max(30).optional().describe('Client phone if mentioned'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    const resolution = await resolveClient({
      teamId: ctx.teamId,
      search: args.search,
      email: args.email,
      phone: args.phone,
    });

    if (resolution.status === 'exact_match' && resolution.client) {
      const clientChanged = ctx.demandState.client?.id !== resolution.client.id;
      return {
        result: resolution,
        stateUpdate: {
          client: { id: resolution.client.id, name: `${resolution.client.firstName} ${resolution.client.lastName}` },
          ...(clientChanged ? { document: null } : {}),
        },
      };
    }

    if (resolution.status === 'ambiguous' && resolution.candidates.length < 3) {
      return {
        result: resolution,
        richCard: { type: 'client_picker', data: resolution.candidates },
      };
    }

    if (resolution.status === 'no_match') {
      return { result: resolution, quickReplies: ['Oui, crée-le'] };
    }

    return { result: resolution };
  },
});
