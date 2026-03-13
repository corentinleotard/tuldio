import { z } from 'zod';
import { defineTool, lineSchema, type ToolResult } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { getInvoice, updateInvoice, updateInvoiceStatusUc } from '../../../modules/invoices/index.js';
import { applyLineDeltas, resolveLines, updatedLineSchema } from './line-deltas.js';

export const updateInvoiceTool = defineTool({
  name: 'update_invoice',
  description:
    `Update an invoice's lines, title, status, or prestation date. Takes a document ref.
Call get_document first to see current line IDs when you need to update or remove existing lines.
For line changes use delta operations:
  - addedLines: new lines to append
  - removedLineIds: IDs of lines to remove
  - updatedLines: partial field updates on existing lines (by lineId)
You can combine operations in a single call (e.g. add + remove + update).
For status changes: provide status only, no other fields. Invalid transitions will be rejected.
  - sent, paid, cancelled. "paid" marks the full invoice amount as paid — no partial payments.
  - To cancel a paid invoice, the system creates an avoir (credit note) automatically.
  - Cancellation is destructive and irreversible (creates an avoir). Only cancel when the user explicitly asks to cancel/annuler. Never cancel as an intermediate step to create a different document.
Avoir invoices cannot be edited (lines mirror the source invoice).
To delete a draft invoice, use delete_document instead.`,
  schema: z.object({
    ref: z.string().describe('Invoice ref (from current conversation tool results only, e.g. d0, d1)'),
    title: z.string().max(255).optional().describe('New title'),
    status: z.enum(['sent', 'paid', 'cancelled']).optional().describe('New status'),
    addedLines: z.array(lineSchema).max(50).optional().describe('New lines to append'),
    removedLineIds: z.array(z.string().uuid()).optional().describe('IDs of lines to remove'),
    updatedLines: z.array(updatedLineSchema).optional().describe('Partial updates to existing lines by lineId'),
    prestationDate: z.string().optional().describe(
      'New service/prestation date as ISO string (YYYY-MM-DD)',
    ),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    const invoiceId = ctx.resolveRef(args.ref, 'invoice');

    // --- Status change ---
    if (args.status) {
      const invoice = await updateInvoiceStatusUc({ teamId: ctx.teamId, userId: ctx.userId, invoiceId, status: args.status });
      return {
        result: { ref: args.ref, type: 'invoice', number: invoice.number, status: invoice.status, totalHt: invoice.totalHt, totalTtc: invoice.totalTtc },
        richCard: { type: 'invoice', data: invoice },
        activeStateUpdate: {
          document: { id: invoiceId, type: 'invoice' as const, number: invoice.number },
        },
      };
    }

    // --- Line/title update via deltas ---
    const hasLineChanges = args.addedLines?.length || args.removedLineIds?.length || args.updatedLines?.length;
    if (!hasLineChanges && !args.title && !args.prestationDate) {
      throw new HandledError(errorCodes.invalidInput);
    }

    const currentInvoice = await getInvoice({ teamId: ctx.teamId, invoiceId });

    // Block line edits on avoir invoices — lines must mirror source
    if (hasLineChanges && currentInvoice.invoiceType === 'avoir') {
      throw new HandledError(errorCodes.avoirNotEditable);
    }

    const finalLines = applyLineDeltas({
      currentLines: currentInvoice.lines,
      addedLines: args.addedLines,
      removedLineIds: args.removedLineIds,
      updatedLines: args.updatedLines,
    });

    const resolvedLines = await resolveLines({ teamId: ctx.teamId, lines: finalLines });

    const invoice = await updateInvoice({
      teamId: ctx.teamId,
      invoiceId,
      title: args.title,
      lines: resolvedLines,
      prestationDate: args.prestationDate ? new Date(args.prestationDate) : undefined,
    });
    return {
      result: { ref: args.ref, type: 'invoice', number: invoice.number, totalHt: invoice.totalHt, totalTtc: invoice.totalTtc },
      richCard: { type: 'invoice', data: invoice },
      activeStateUpdate: {
        document: { id: invoiceId, type: 'invoice' as const, number: invoice.number },
      },
    };
  },
});
