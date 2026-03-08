import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { createClient } from '../../../modules/clients/index.js';
import { shouldWipeDocument } from '../should-wipe-document.js';

export const createClientTool = defineTool({
  name: 'create_client',
  description:
    `Create a new client. Requires first name and last name.
NEVER create a client without first searching for duplicates.
After creation, encourage the user to provide email/phone if missing: "Tu as son email ou telephone ? C'est utile pour le retrouver facilement."`,
  schema: z.object({
    firstName: z.string().min(1).max(100).describe('Client first name'),
    lastName: z.string().min(1).max(100).describe('Client last name'),
    email: z.string().email().optional().describe('Client email'),
    phone: z.string().max(30).optional().describe('Client phone'),
    address: z.string().max(500).optional().describe('Client full address'),
  }),
  handler: async (args, ctx) => {
    const client = await createClient({
      teamId: ctx.teamId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      address: args.address,
    });
    return { result: client };
  },
  stateUpdate: (result, ctx) => {
    const wipe = shouldWipeDocument({
      document: ctx.demandState.document,
      currentClientId: ctx.demandState.client?.id ?? null,
      newClientId: result.id,
      intent: 'new',
    });
    return {
      client: { id: result.id, name: `${result.firstName} ${result.lastName}` },
      ...(wipe ? { document: null } : {}),
    };
  },
});
