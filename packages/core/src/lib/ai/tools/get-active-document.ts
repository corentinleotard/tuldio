import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { getQuote } from '../../../modules/quotes/index.js';
import { getInvoice } from '../../../modules/invoices/index.js';

export const getActiveDocumentTool = defineTool({
  name: 'get_active_document',
  description:
    `Retrieve the full active document with all lines, totals, and status.
Call this before update_document when you need to see current line IDs for updates or removals.
Requires an active document in state.`,
  schema: z.object({}),
  handler: async (_args, ctx): Promise<ToolResult> => {
    const docPointer = ctx.demandState.document;

    if (!docPointer?.id) {
      throw new HandledError(errorCodes.noDocumentPrepared);
    }

    if (docPointer.type === 'quote') {
      const quote = await getQuote({ teamId: ctx.teamId, quoteId: docPointer.id });
      return { result: quote };
    }

    const invoice = await getInvoice({ teamId: ctx.teamId, invoiceId: docPointer.id });
    return { result: invoice };
  },
});
