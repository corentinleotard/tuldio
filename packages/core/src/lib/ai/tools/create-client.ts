import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { createClient } from '../../../modules/clients/index.js';

export const createClientTool = defineTool({
  name: 'create_client',
  description:
    `Create a new client after resolve_client returned no_match and user confirmed.
Requires first name and last name. Sets as active client and clears any active document.`,
  schema: z.object({
    firstName: z.string().min(1).max(100).describe('Client first name'),
    lastName: z.string().min(1).max(100).describe('Client last name'),
    email: z.string().email().optional().describe('Client email'),
    phone: z.string().max(30).optional().describe('Client phone'),
    address: z.string().max(500).optional().describe('Client full address'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    const client = await createClient({
      teamId: ctx.teamId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      address: args.address,
    });
    return {
      result: client,
      stateUpdate: {
        client: { id: client.id, name: `${client.firstName} ${client.lastName}` },
        document: null,
      },
    };
  },
});
