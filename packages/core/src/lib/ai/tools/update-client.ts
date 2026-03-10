import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { updateClientUc } from '../../../modules/clients/index.js';

export const updateClientTool = defineTool({
  name: 'update_client',
  description:
    `Update the active client's contact information (name, email, phone, address).
Operates on the current active client from state. Only include fields that need to change — omitted fields remain unchanged.
Confirm changes with the user before calling when the update was not explicitly requested (e.g. inferred from context).
Name changes update both first name and last name independently.`,
  schema: z.object({
    firstName: z.string().min(1).max(100).optional().describe('New first name'),
    lastName: z.string().min(1).max(100).optional().describe('New last name'),
    email: z.string().email().optional().describe('New email'),
    phone: z.string().max(30).optional().describe('New phone'),
    address: z.string().max(500).optional().describe('New address'),
  }),
  handler: async (args, ctx) => {
    if (!ctx.demandState.client) {
      throw new HandledError(errorCodes.noActiveClient);
    }
    const client = await updateClientUc({
      teamId: ctx.teamId,
      clientId: ctx.demandState.client.id,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      address: args.address,
    });
    return { result: client };
  },
});
