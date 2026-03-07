import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { listInvoices } from '../../../modules/invoices/index.js';

export const listInvoicesTool = defineTool({
  name: 'list_invoices',
  description: 'List recent invoices. Optionally filter by client.',
  schema: z.object({
    clientId: z.string().uuid().optional().describe('Filter by client ID (from current conversation, optional)'),
  }),
  handler: async (args, ctx) => {
    const invoices = await listInvoices({ teamId: ctx.teamId, clientId: args.clientId, limit: 10 });
    return { result: invoices };
  },
});
