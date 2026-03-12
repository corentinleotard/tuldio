import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { deleteInvoiceUc } from '../../../modules/invoices/index.js';
import { deleteQuoteUc } from '../../../modules/quotes/index.js';
import { getQuote } from '../../../modules/quotes/index.js';

export const deleteDocumentTool = defineTool({
  name: 'delete_document',
  description:
    `Permanently delete a document by ref. Only draft documents can be deleted — non-draft documents must be cancelled via update_quote or update_invoice instead.
Deleting is irreversible: the document and all its lines are removed from the database.
Use this when the user explicitly asks to delete/remove/discard a draft quote or invoice.`,
  schema: z.object({
    ref: z.string().describe('Document ref (from current conversation tool results only, e.g. d0, d1)'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    const docId = ctx.resolveRef(args.ref);

    // Determine type by trying quote first
    let docType: 'quote' | 'invoice';
    try {
      await getQuote({ teamId: ctx.teamId, quoteId: docId });
      docType = 'quote';
    } catch {
      docType = 'invoice';
    }

    if (docType === 'invoice') {
      await deleteInvoiceUc({ teamId: ctx.teamId, invoiceId: docId });
    } else {
      await deleteQuoteUc({ teamId: ctx.teamId, quoteId: docId });
    }

    const label = docType === 'invoice' ? 'Facture' : 'Devis';
    return {
      result: { message: `${label} brouillon supprimé.` },
      activeStateUpdate: { document: null },
    };
  },
});
