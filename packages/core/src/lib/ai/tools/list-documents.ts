import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { listQuotes } from '../../../modules/quotes/index.js';
import { listInvoices } from '../../../modules/invoices/index.js';

export const listDocumentsTool = defineTool({
  name: 'list_documents',
  description: `List recent quotes and/or invoices, sorted by creation date (newest first).
Optionally filter by type (quote/invoice) or by client.
Returns document number, client name, total HT, status, and creation date.
Use this when the user asks to find, review, or open a past document.
After listing, the user may ask to open a specific one — use open_document with the document ID from results.`,
  schema: z.object({
    type: z.enum(['quote', 'invoice']).optional().describe('Filter by document type. Omit to list both.'),
    clientId: z.string().uuid().optional().describe('Filter by client (from recent tool results only)'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    if (args.type === 'quote') {
      const quotes = await listQuotes({ teamId: ctx.teamId, clientId: args.clientId });
      return { result: { quotes } };
    }
    if (args.type === 'invoice') {
      const invoices = await listInvoices({ teamId: ctx.teamId, clientId: args.clientId });
      return { result: { invoices } };
    }
    const [quotes, invoices] = await Promise.all([
      listQuotes({ teamId: ctx.teamId, clientId: args.clientId }),
      listInvoices({ teamId: ctx.teamId, clientId: args.clientId }),
    ]);
    return { result: { quotes, invoices } };
  },
});
