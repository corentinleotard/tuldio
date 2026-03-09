import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { resolveClient } from '../../../modules/clients/index.js';
import { findClientById } from '../../../modules/clients/repository/find-client-by-id.js';

export const resolveClientTool = defineTool({
  name: 'resolve_client',
  description:
    `Search for an existing client by name, email, or phone. Must be called every time the user mentions a client.
Use clientId to pick a specific client from pending candidates (after disambiguation).
Returns: exact_match (proceed), ambiguous (client picker or ask user to clarify), or no_match (propose creation).`,
  schema: z.object({
    search: z.string().min(1).max(200).describe('Client name to search for'),
    clientId: z.string().uuid().optional().describe('Pick a client directly by ID (from pending candidates only)'),
    email: z.string().email().optional().describe('Client email if mentioned'),
    phone: z.string().max(30).optional().describe('Client phone if mentioned'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    // Direct pick by ID (from pending candidates)
    if (args.clientId) {
      const client = await findClientById({ teamId: ctx.teamId, clientId: args.clientId });
      if (!client) {
        return {
          result: { status: 'no_match', error: 'Client not found' },
          stateUpdate: { pendingCandidates: null },
        };
      }
      const clientChanged = ctx.demandState.client?.id !== client.id;
      return {
        result: { status: 'exact_match', client: { id: client.id, firstName: client.first_name, lastName: client.last_name, email: client.email, phone: client.phone } },
        stateUpdate: {
          client: { id: client.id, name: `${client.first_name} ${client.last_name}` },
          pendingCandidates: null,
          ...(clientChanged ? { document: null } : {}),
        },
      };
    }

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
          pendingCandidates: null,
          ...(clientChanged ? { document: null } : {}),
        },
      };
    }

    if (resolution.status === 'ambiguous') {
      const candidates = resolution.candidates.map((c: { id: string; firstName: string; lastName: string }) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
      }));

      if (resolution.candidates.length <= 3) {
        return {
          result: resolution,
          richCard: { type: 'client_picker', data: resolution.candidates },
          stateUpdate: { pendingCandidates: candidates },
        };
      }

      return {
        result: resolution,
        stateUpdate: { pendingCandidates: candidates },
      };
    }

    if (resolution.status === 'no_match') {
      return { result: resolution, stateUpdate: { pendingCandidates: null }, quickReplies: ['Oui, crée-le'] };
    }

    return { result: resolution };
  },
});
