import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { getQuote } from '../../../modules/quotes/index.js';
import { getInvoice } from '../../../modules/invoices/index.js';

export const openDocumentTool = defineTool({
  name: 'open_document',
  description:
    `Open a document to make it the active document. Use after list_documents to select a specific quote or invoice by its ID.
Sets the document in state so get_active_document returns its full details and update_document can target it.
Also use this when the user references a document by number (e.g. "ouvre le devis 12") — first call list_documents to find the ID, then open_document.`,
  schema: z.object({
    documentId: z.string().uuid().describe('Document ID (from recent tool results only)'),
    documentType: z.enum(['quote', 'invoice']).describe('Document type'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    if (args.documentType === 'quote') {
      const quote = await getQuote({ teamId: ctx.teamId, quoteId: args.documentId });
      return {
        result: quote,
        richCard: { type: 'quote', data: quote },
        stateUpdate: {
          client: { id: quote.clientId, name: quote.clientName ?? '' },
          document: { id: quote.id, type: 'quote' as const },
        },
      };
    }

    const invoice = await getInvoice({ teamId: ctx.teamId, invoiceId: args.documentId });
    return {
      result: invoice,
      richCard: { type: 'invoice', data: invoice },
      stateUpdate: {
        client: { id: invoice.clientId, name: invoice.clientName ?? '' },
        document: { id: invoice.id, type: 'invoice' as const },
      },
    };
  },
});
