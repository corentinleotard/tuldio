import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { deleteInvoiceUc } from '../../../modules/invoices/index.js';
import { deleteQuoteUc } from '../../../modules/quotes/index.js';

export const deleteDocumentTool = defineTool({
  name: 'delete_document',
  description:
    `Permanently delete the active document. Only draft documents can be deleted — non-draft documents must be cancelled via update_document instead.
Requires an active document in state. Deleting is irreversible: the document and all its lines are removed from the database.
Use this when the user explicitly asks to delete/remove/discard a draft quote or invoice.`,
  schema: z.object({}),
  handler: async (_args, ctx): Promise<ToolResult> => {
    const docId = ctx.demandState.document?.id;
    const docType = ctx.demandState.document?.type;

    if (!docId || !docType) {
      throw new HandledError(errorCodes.noDocumentPrepared);
    }

    if (docType === 'invoice') {
      await deleteInvoiceUc({ teamId: ctx.teamId, invoiceId: docId });
    } else {
      await deleteQuoteUc({ teamId: ctx.teamId, quoteId: docId });
    }

    const label = docType === 'invoice' ? 'Facture' : 'Devis';
    return {
      result: { action: 'deleted', message: `${label} brouillon supprimé.` },
      stateUpdate: { document: null },
    };
  },
});
