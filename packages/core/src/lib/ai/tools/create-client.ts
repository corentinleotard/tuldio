import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { createClient } from '../../../modules/clients/index.js';

export const createClientTool = defineTool({
  name: 'create_client',
  description:
    `Create a new client when a client is not found. When the user's message clearly requests an action for this client, call directly — do not ask for confirmation. The user naming a client in an action request is implicit consent to create them.
For individual (B2C): provide firstName and lastName. For company (B2B): provide companyName (and optionally siret, tvaNumber). Contact person firstName/lastName are optional for B2B.
Sets as active client and clears any active document.`,
  schema: z.object({
    firstName: z.string().min(1).max(100).optional().describe('Client first name (required for B2C, optional contact for B2B)'),
    lastName: z.string().min(1).max(100).optional().describe('Client last name (required for B2C, optional contact for B2B)'),
    companyName: z.string().min(1).max(255).optional().describe('Company name (B2B client). If set, client is treated as a company.'),
    siret: z.string().max(14).optional().describe('Company SIRET number (B2B only, 14 digits)'),
    tvaNumber: z.string().max(20).optional().describe('Company TVA intracommunautaire number (B2B only)'),
    email: z.string().email().optional().describe('Client email'),
    phone: z.string().max(30).optional().describe('Client phone'),
    address: z.string().max(500).optional().describe('Client full address'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    const client = await createClient({
      teamId: ctx.teamId,
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
    const ref = ctx.registerRef('client', client.id);
    return {
      result: { ref, name },
      activeStateUpdate: {
        client: { id: client.id, name },
        document: null,
      },
    };
  },
});
