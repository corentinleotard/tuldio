import { z } from 'zod';
import { defineTool, lineSchema, type ToolResult } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { getQuote, updateQuote, updateQuoteStatusUc } from '../../../modules/quotes/index.js';
import { applyLineDeltas, resolveLines, updatedLineSchema } from './line-deltas.js';

export const updateQuoteTool = defineTool({
  name: 'update_quote',
  description:
    `Update a quote's lines, title, or status. Takes a document ref.
Call get_document first to see current line IDs when you need to update or remove existing lines.
For line changes use delta operations:
  - addedLines: new lines to append
  - removedLineIds: IDs of lines to remove
  - updatedLines: partial field updates on existing lines (by lineId)
You can combine operations in a single call (e.g. add + remove + update).
For status changes: provide status only, no other fields. Invalid transitions will be rejected.
  - sent → accepted / refused. Cancelled from any state.
To delete a draft quote, use delete_document instead.`,
  schema: z.object({
    ref: z.string().describe('Quote ref (from current conversation tool results only, e.g. d0, d1)'),
    title: z.string().max(255).optional().describe('New title'),
    status: z.enum(['sent', 'accepted', 'refused', 'cancelled']).optional().describe('New status'),
    addedLines: z.array(lineSchema).max(50).optional().describe('New lines to append'),
    removedLineIds: z.array(z.string().uuid()).optional().describe('IDs of lines to remove'),
    updatedLines: z.array(updatedLineSchema).optional().describe('Partial updates to existing lines by lineId'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    const quoteId = ctx.resolveRef(args.ref, 'quote');

    // --- Status change ---
    if (args.status) {
      const quote = await updateQuoteStatusUc({ teamId: ctx.teamId, quoteId, status: args.status });
      return {
        result: { ref: args.ref, type: 'quote', number: quote.number, status: quote.status, totalTtc: quote.totalTtc },
        richCard: { type: 'quote', data: quote },
        activeStateUpdate: {
          document: { id: quoteId, type: 'quote' as const, number: quote.number },
        },
      };
    }

    // --- Line/title update via deltas ---
    const hasLineChanges = args.addedLines?.length || args.removedLineIds?.length || args.updatedLines?.length;
    if (!hasLineChanges && !args.title) {
      throw new HandledError(errorCodes.invalidInput);
    }

    const currentQuote = await getQuote({ teamId: ctx.teamId, quoteId });

    const finalLines = applyLineDeltas({
      currentLines: currentQuote.lines,
      addedLines: args.addedLines,
      removedLineIds: args.removedLineIds,
      updatedLines: args.updatedLines,
    });

    const resolvedLines = await resolveLines({ teamId: ctx.teamId, lines: finalLines });

    const quote = await updateQuote({
      teamId: ctx.teamId,
      quoteId,
      title: args.title,
      lines: resolvedLines,
    });
    return {
      result: { ref: args.ref, type: 'quote', number: quote.number },
      richCard: { type: 'quote', data: quote },
      activeStateUpdate: {
        document: { id: quoteId, type: 'quote' as const, number: quote.number },
      },
    };
  },
});
