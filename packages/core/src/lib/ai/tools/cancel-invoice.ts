import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { cancelOrDeleteInvoice } from '../../../modules/invoices/index.js';

export const cancelInvoiceTool = defineTool({
  name: 'cancel_invoice',
  description: `Cancel or delete an invoice.
Draft invoices are permanently deleted (not yet in accounting sequence).
Sent or overdue invoices are marked as cancelled (preserves audit trail — required by French law).
Paid or already cancelled invoices cannot be cancelled.`,
  schema: z.object({
    invoiceId: z.string().uuid().describe('Invoice ID (from current conversation tool results only)'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    const { action, invoice } = await cancelOrDeleteInvoice({
      teamId: ctx.teamId,
      invoiceId: args.invoiceId,
    });

    if (action === 'deleted') {
      return { result: { action, message: 'Facture brouillon supprimée.' } };
    }

    return {
      result: { action, invoice },
      richCard: invoice ? { type: 'invoice', data: invoice } : undefined,
    };
  },
});
