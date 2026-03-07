import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { markAsPaid } from '../../../modules/invoices/index.js';

export const markAsPaidTool = defineTool({
  name: 'mark_as_paid',
  description: 'Mark an invoice as paid.',
  schema: z.object({
    invoiceId: z.string().uuid().describe('Invoice ID (from current conversation tool results only)'),
  }),
  handler: async (args, ctx) => {
    const invoice = await markAsPaid({
      teamId: ctx.teamId,
      invoiceId: args.invoiceId,
    });
    return { result: invoice };
  },
});
