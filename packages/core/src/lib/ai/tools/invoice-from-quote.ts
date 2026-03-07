import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { createInvoiceFromQuote } from '../../../modules/invoices/index.js';

export const invoiceFromQuoteTool = defineTool({
  name: 'invoice_from_quote',
  description:
    `Create an invoice from an existing quote. Copies all lines from the quote into a linked invoice.
Use when the user says "facture le devis X". Confirm before invoicing: "Je facture la totalite du devis #X ?"
Use the list tool to find the quote if needed.`,
  schema: z.object({
    quoteId: z.string().uuid().describe('Quote ID (from current conversation tool results only)'),
    title: z.string().max(255).optional().describe('Invoice title (defaults to quote title)'),
  }),
  handler: async (args, ctx) => {
    const invoice = await createInvoiceFromQuote({
      teamId: ctx.teamId,
      userId: ctx.userId,
      quoteId: args.quoteId,
      title: args.title,
    });
    return { result: invoice, richCard: { type: 'invoice', data: invoice } };
  },
});
