import { z } from 'zod';
import { defineTool, lineSchema, type ToolResult } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { createQuote } from '../../../modules/quotes/index.js';
import { createInvoice, createInvoiceFromQuote } from '../../../modules/invoices/index.js';
import { resolveUnit } from '../../../modules/units/index.js';

export const createDocumentTool = defineTool({
  name: 'create_document',
  description:
    `Create a new quote or invoice for the active client. Requires an active client in state.
All lines must have unitPrice set (in euro cents: 4500 = 45.00€). TVA rate is in basis points (1000 = 10%, 2000 = 20%).
To create an invoice from the active quote, set fromActiveQuote to true — lines are copied automatically, no need to pass lines.
After creation, the document becomes the active document in state.

Invoice types:
- To invoice a quote fully: fromActiveQuote + no invoiceType. The system auto-decides: if no prior acomptes → standard invoice; if acomptes exist → solde (final invoice with deductions).
- acompte: deposit invoice from a quote. Use fromActiveQuote + invoiceType 'acompte' + depositPercent (e.g. 30 for 30%). Cannot total 100% of quote — remaining must exist for solde.
- To cancel/reverse an invoice, use update_document with status 'cancelled' instead — the system creates an avoir automatically.`,
  schema: z.object({
    type: z.enum(['quote', 'invoice']).describe('Document type'),
    title: z.string().max(255).optional().describe('Document title'),
    fromActiveQuote: z.boolean().optional().describe(
      'Create invoice from the active quote in state. Only valid when type is invoice and active document is a quote.',
    ),
    lines: z.array(lineSchema).min(1).max(50).optional().describe(
      'Document lines — required unless using fromActiveQuote',
    ),
    prestationDate: z.string().optional().describe(
      'Service/prestation date as ISO string (YYYY-MM-DD). Only for invoices. Defaults to today if omitted.',
    ),
    invoiceType: z.enum(['acompte']).optional().describe(
      'Only set for acompte (deposit). For standard/solde, omit — the system auto-decides.',
    ),
    depositPercent: z.number().int().min(1).max(99).optional().describe(
      'Deposit percentage for acompte invoices (e.g. 30 for 30%)',
    ),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    // Invoice from active quote (standard, acompte, or solde — auto-decided)
    if (args.fromActiveQuote) {
      if (args.type !== 'invoice') {
        throw new HandledError(errorCodes.invalidInput);
      }
      const activeDoc = ctx.demandState.document;
      if (!activeDoc || activeDoc.type !== 'quote') {
        throw new HandledError(errorCodes.noDocumentPrepared);
      }
      const invoice = await createInvoiceFromQuote({
        teamId: ctx.teamId,
        userId: ctx.userId,
        quoteId: activeDoc.id,
        title: args.title,
        prestationDate: args.prestationDate ? new Date(args.prestationDate) : undefined,
        invoiceType: args.invoiceType === 'acompte' ? 'acompte' : undefined,
        depositPercent: args.depositPercent,
      });
      return {
        result: invoice,
        richCard: { type: 'invoice', data: invoice },
        stateUpdate: {
          client: { id: invoice.clientId, name: invoice.clientName ?? '' },
          document: { id: invoice.id, type: 'invoice' as const },
        },
      };
    }

    // Standalone document — requires active client and lines
    if (!ctx.demandState.client) {
      throw new HandledError(errorCodes.noActiveClient);
    }
    if (!args.lines?.length) {
      throw new HandledError(errorCodes.invalidInput);
    }

    const resolvedLines = await Promise.all(
      args.lines.map(async (l) => {
        const resolved = await resolveUnit({ teamId: ctx.teamId, raw: l.unit });
        return { ...l, unit: resolved.label };
      }),
    );

    if (args.type === 'quote') {
      const quote = await createQuote({
        teamId: ctx.teamId,
        userId: ctx.userId,
        clientId: ctx.demandState.client.id,
        title: args.title,
        lines: resolvedLines,
      });
      return {
        result: quote,
        richCard: { type: 'quote', data: quote },
        stateUpdate: { document: { id: quote.id, type: 'quote' as const } },
      };
    }

    const invoice = await createInvoice({
      teamId: ctx.teamId,
      userId: ctx.userId,
      clientId: ctx.demandState.client.id,
      title: args.title,
      lines: resolvedLines,
      prestationDate: args.prestationDate ? new Date(args.prestationDate) : undefined,
    });
    return {
      result: invoice,
      richCard: { type: 'invoice', data: invoice },
      stateUpdate: { document: { id: invoice.id, type: 'invoice' as const } },
    };
  },
});
