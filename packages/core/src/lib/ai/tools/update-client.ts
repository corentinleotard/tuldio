import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { updateClientUc } from '../../../modules/clients/index.js';

export const updateClientTool = defineTool({
  name: 'update_client',
  description:
    `Update an existing client's information (email, phone, address, name).
Use when the user provides missing contact info (e.g. after a document email flow fails because the client has no email).`,
  schema: z.object({
    clientId: z.string().uuid().describe('Client ID (from current conversation tool results only)'),
    firstName: z.string().min(1).max(100).optional().describe('New first name'),
    lastName: z.string().min(1).max(100).optional().describe('New last name'),
    email: z.string().email().optional().describe('New email'),
    phone: z.string().max(30).optional().describe('New phone'),
    address: z.string().max(500).optional().describe('New address'),
  }),
  handler: async (args, ctx) => {
    const client = await updateClientUc({
      teamId: ctx.teamId,
      clientId: args.clientId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      address: args.address,
    });
    return { result: client };
  },
});
