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
    `Create a new quote or invoice for the active client. All lines must have unitPrice set.
To create an invoice from an existing quote, provide fromQuoteId — lines are copied automatically.`,
  schema: z.object({
    type: z.enum(['quote', 'invoice']).describe('Document type'),
    title: z.string().max(255).optional().describe('Document title'),
    fromQuoteId: z.string().uuid().optional().describe(
      'Create invoice from this quote (from recent tool results only). Omit lines when using this.',
    ),
    lines: z.array(lineSchema).min(1).max(50).optional().describe(
      'Document lines — required unless using fromQuoteId',
    ),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    // Invoice from existing quote — client comes from the quote
    if (args.fromQuoteId) {
      if (args.type !== 'invoice') {
        throw new HandledError(errorCodes.invalidInput);
      }
      const invoice = await createInvoiceFromQuote({
        teamId: ctx.teamId,
        userId: ctx.userId,
        quoteId: args.fromQuoteId,
        title: args.title,
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
    });
    return {
      result: invoice,
      richCard: { type: 'invoice', data: invoice },
      stateUpdate: { document: { id: invoice.id, type: 'invoice' as const } },
    };
  },
});
