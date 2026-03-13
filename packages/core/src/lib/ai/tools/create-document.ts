import { z } from 'zod';
import { defineTool, lineSchema, type ToolResult } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { createQuote } from '../../../modules/quotes/index.js';
import { createInvoice, createInvoiceFromQuote, updateInvoiceStatusUc } from '../../../modules/invoices/index.js';
import { resolveLines } from './line-deltas.js';

export const createDocumentTool = defineTool({
  name: 'create_document',
  description:
    `Create a new quote or invoice. clientRef is required unless sourceQuoteRef is provided (client is inherited from the quote).
All lines must have unitPrice set (in euro cents: 4500 = 45.00€). TVA rate is in basis points (1000 = 10%, 2000 = 20%).
To create an invoice from an existing quote, set sourceQuoteRef to the quote's ref — lines are copied automatically, no need to pass lines or clientRef.
After creation, the document becomes the active document.

Invoice types:
- To invoice a quote fully: sourceQuoteRef + no invoiceType. The system auto-decides: if no prior acomptes → standard invoice; if acomptes exist → solde (final invoice with deductions).
- acompte: deposit invoice from a quote. Use sourceQuoteRef + invoiceType 'acompte' + either depositPercent OR depositAmount (mutually exclusive). Multiple acomptes on the same quote are supported — always use sourceQuoteRef. Use depositBase 'remaining' when the user refers to a percentage of what's left. Use depositAmount when the user gives a fixed euro amount (e.g. "200 euros d'acompte"). Never create standalone invoices to simulate acompte behavior.
- To cancel/reverse an invoice, use update_invoice with status 'cancelled' instead — the system creates an avoir automatically.
- initialStatus: set to 'sent' or 'paid' to skip the draft stage (invoices only). MANDATORY when the user indicates payment already happened (past tense). If the user says the client paid, always set initialStatus to 'paid'.
- When the user mentions a payment amount (e.g. "il a payé 250€"), this amount is TTC. For acomptes, pass it directly as depositAmount (the system handles TTC→HT conversion). For standalone invoices, lines/unitPrice are always HT — ask the user for line details.`,
  schema: z.object({
    type: z.enum(['quote', 'invoice']).describe('Document type'),
    clientRef: z.string().optional().describe('Client ref (from current conversation tool results only, e.g. c0, c1). Required unless sourceQuoteRef is provided.'),
    title: z.string().max(255).optional().describe('Document title'),
    sourceQuoteRef: z.string().optional().describe(
      'Quote ref to create invoice from (from current conversation tool results only, e.g. d0, d1). Only valid when type is invoice.',
    ),
    lines: z.array(lineSchema).min(1).max(50).optional().describe(
      'Document lines — required unless using sourceQuoteRef',
    ),
    prestationDate: z.string().optional().describe(
      'Service/prestation date as ISO string (YYYY-MM-DD). Only for invoices. Defaults to today if omitted.',
    ),
    invoiceType: z.enum(['acompte']).optional().describe(
      'Only set for acompte (deposit). For standard/solde, omit — the system auto-decides.',
    ),
    depositPercent: z.number().int().min(1).max(99).optional().describe(
      'Deposit percentage for acompte invoices (e.g. 30 for 30%). Integer only — no decimals.',
    ),
    depositAmount: z.number().int().min(1).optional().describe(
      'Fixed deposit amount in euro cents TTC (e.g. 24000 = 240.00€ TTC). Mutually exclusive with depositPercent. When the user says "200€ d\'acompte", that is TTC.',
    ),
    depositBase: z.enum(['total', 'remaining']).optional().describe(
      'Base for depositPercent: "total" (default) = % of full quote, "remaining" = % of balance after existing acomptes. Ignored when depositAmount is used.',
    ),
    initialStatus: z.enum(['sent', 'paid']).optional().describe(
      'Skip draft — transition invoice to this status immediately after creation. Invoices only.',
    ),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    // Reject initialStatus on quotes
    if (args.initialStatus && args.type === 'quote') {
      throw new HandledError(errorCodes.invalidInput);
    }

    // Invoice from source quote — client inherited from quote, no clientRef needed
    if (args.sourceQuoteRef) {
      if (args.type !== 'invoice') {
        throw new HandledError(errorCodes.invalidInput);
      }
      const quoteId = ctx.resolveRef(args.sourceQuoteRef, 'quote');
      let invoice = await createInvoiceFromQuote({
        teamId: ctx.teamId,
        userId: ctx.userId,
        quoteId,
        title: args.title,
        prestationDate: args.prestationDate ? new Date(args.prestationDate) : undefined,
        invoiceType: args.invoiceType === 'acompte' ? 'acompte' : undefined,
        depositPercent: args.depositPercent,
        depositAmount: args.depositAmount,
        depositBase: args.depositBase,
      });
      if (args.initialStatus) {
        invoice = await updateInvoiceStatusUc({ teamId: ctx.teamId, userId: ctx.userId, invoiceId: invoice.id, status: args.initialStatus });
      }
      const ref = ctx.registerRef('invoice', invoice.id);
      return {
        result: { ref, type: 'invoice', number: invoice.number, status: invoice.status, totalHt: invoice.totalHt, totalTtc: invoice.totalTtc },
        richCard: { type: 'invoice', data: invoice },
        activeStateUpdate: {
          client: { id: invoice.clientId, name: invoice.clientName ?? '' },
          document: { id: invoice.id, type: 'invoice' as const, number: invoice.number },
        },
      };
    }

    // Standalone document — requires clientRef and lines
    if (!args.clientRef) {
      throw new HandledError(errorCodes.invalidInput);
    }
    const clientId = ctx.resolveRef(args.clientRef, 'client');

    if (!args.lines?.length) {
      throw new HandledError(errorCodes.invalidInput);
    }

    const resolvedLines = await resolveLines({ teamId: ctx.teamId, lines: args.lines });

    if (args.type === 'quote') {
      const quote = await createQuote({
        teamId: ctx.teamId,
        userId: ctx.userId,
        clientId,
        title: args.title,
        lines: resolvedLines,
      });
      const ref = ctx.registerRef('quote', quote.id);
      return {
        result: { ref, type: 'quote', number: quote.number, totalHt: quote.totalHt, totalTtc: quote.totalTtc },
        richCard: { type: 'quote', data: quote },
        activeStateUpdate: {
          client: { id: clientId, name: quote.clientName ?? '' },
          document: { id: quote.id, type: 'quote' as const, number: quote.number },
        },
      };
    }

    let invoice = await createInvoice({
      teamId: ctx.teamId,
      userId: ctx.userId,
      clientId,
      title: args.title,
      lines: resolvedLines,
      prestationDate: args.prestationDate ? new Date(args.prestationDate) : undefined,
    });
    if (args.initialStatus) {
      invoice = await updateInvoiceStatusUc({ teamId: ctx.teamId, userId: ctx.userId, invoiceId: invoice.id, status: args.initialStatus });
    }
    const ref = ctx.registerRef('invoice', invoice.id);
    return {
      result: { ref, type: 'invoice', number: invoice.number, status: invoice.status, totalHt: invoice.totalHt, totalTtc: invoice.totalTtc },
      richCard: { type: 'invoice', data: invoice },
      activeStateUpdate: {
        client: { id: clientId, name: invoice.clientName ?? '' },
        document: { id: invoice.id, type: 'invoice' as const, number: invoice.number },
      },
    };
  },
});
