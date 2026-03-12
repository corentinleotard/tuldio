import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { getQuote } from '../../../modules/quotes/index.js';
import { getInvoice } from '../../../modules/invoices/index.js';

export const getDocumentTool = defineTool({
  name: 'get_document',
  description:
    `Retrieve full document details (lines, totals, status) by ref.
Call this before update_quote or update_invoice when you need to see current line IDs for updates or removals.
This is the only "heavy" tool — it returns all lines and amounts. Use it when you need the full picture.`,
  schema: z.object({
    ref: z.string().describe('Document ref (from current conversation tool results only, e.g. d0, d1)'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    const docId = ctx.resolveRef(args.ref);

    // Try quote first, then invoice
    try {
      const quote = await getQuote({ teamId: ctx.teamId, quoteId: docId });
      return {
        result: quote,
        richCard: { type: 'quote', data: quote },
        activeStateUpdate: {
          client: { id: quote.clientId, name: quote.clientName ?? '' },
          document: { id: quote.id, type: 'quote' as const, number: quote.number },
        },
      };
    } catch {
      // Not a quote, try invoice
    }

    const invoice = await getInvoice({ teamId: ctx.teamId, invoiceId: docId });
    return {
      result: invoice,
      richCard: { type: 'invoice', data: invoice },
      activeStateUpdate: {
        client: { id: invoice.clientId, name: invoice.clientName ?? '' },
        document: { id: invoice.id, type: 'invoice' as const, number: invoice.number },
      },
    };
  },
});
