import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { createInvoice } from '../../../modules/invoices/index.js';

export const generateInvoiceTool = defineTool({
  name: 'generate_invoice',
  description:
    `Generate an invoice from the current document and active client.
PREREQUISITES: resolve_client and add_lines must have been called. All lines must have unitPrice set (use update_line if needed).
The client and lines are read from the current demand state — do not pass them.
Use this for standalone invoices. To invoice from an existing quote, use invoice_from_quote instead.
Only for NEW invoices. If a generatedId already exists in state, the invoice was already created — use update_invoice instead.`,
  schema: z.object({
    title: z.string().max(255).optional().describe('Override title (uses add_lines title if omitted)'),
  }),
  handler: async (args, ctx) => {
    const { demandState } = ctx;
    if (!demandState.client) throw new HandledError(errorCodes.noActiveClient);
    if (!demandState.document?.lines?.length) throw new HandledError(errorCodes.noDocumentPrepared);

    const incomplete = demandState.document.lines.some((l) => l.unitPrice === undefined);
    if (incomplete) throw new HandledError(errorCodes.documentLinesIncomplete);

    const invoice = await createInvoice({
      teamId: ctx.teamId,
      userId: ctx.userId,
      clientId: demandState.client.id,
      title: args.title ?? demandState.document.title,
      lines: demandState.document.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice!,
        tvaRate: l.tvaRate,
      })),
    });
    return { result: invoice, richCard: { type: 'invoice', data: invoice } };
  },
  stateUpdate: (result, ctx) => {
    return { document: ctx.demandState.document ? { ...ctx.demandState.document, generatedId: result.id } : null };
  },
});
