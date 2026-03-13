import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { updateClientUc } from '../../../modules/clients/index.js';

export const updateClientTool = defineTool({
  name: 'update_client',
  description:
    `Update a client's contact information (name, email, phone, address, company details).
Takes a client ref. Only include fields that need to change — omitted fields remain unchanged.
Confirm changes with the user before calling when the update was not explicitly requested (e.g. inferred from context).
To convert a B2C client to B2B, set companyName. Contact person firstName/lastName are optional for B2B.`,
  schema: z.object({
    ref: z.string().describe('Client ref (from current conversation tool results only, e.g. c0, c1)'),
    firstName: z.string().min(1).max(100).optional().describe('New first name'),
    lastName: z.string().min(1).max(100).optional().describe('New last name'),
    companyName: z.string().min(1).max(255).optional().describe('Company name (B2B)'),
    siret: z.string().max(14).optional().describe('Company SIRET (B2B only)'),
    tvaNumber: z.string().max(20).optional().describe('Company TVA intracommunautaire (B2B only)'),
    email: z.string().email().optional().describe('New email'),
    phone: z.string().max(30).optional().describe('New phone'),
    address: z.string().max(500).optional().describe('New address'),
  }),
  handler: async (args, ctx) => {
    const clientId = ctx.resolveRef(args.ref, 'client');
    const client = await updateClientUc({
      teamId: ctx.teamId,
      clientId,
      firstName: args.firstName,
      lastName: args.lastName,
      companyName: args.companyName,
      siret: args.siret,
      tvaNumber: args.tvaNumber,
      email: args.email,
      phone: args.phone,
      address: args.address,
    });
    const name = client.displayName;
    return {
      result: { ref: args.ref, name },
    };
  },
});
