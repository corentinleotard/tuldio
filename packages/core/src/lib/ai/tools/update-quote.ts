import { z } from 'zod';
import { defineTool, lineSchema } from './define-tool.js';
import { updateQuote } from '../../../modules/quotes/index.js';
import { resolveUnit } from '../../../modules/units/index.js';

export const updateQuoteTool = defineTool({
  name: 'update_quote',
  description:
    `Update an existing quote (draft or sent, with no linked invoice). Replaces ALL lines — include unchanged lines too with the user's modifications applied.
WHEN TO USE: when a generatedId exists in state or the user wants to modify a quote from conversation history.
Call this DIRECTLY with all lines (old + new/modified). Do NOT call add_lines/update_line first — this tool replaces everything in one step.`,
  schema: z.object({
    quoteId: z.string().uuid().describe('Quote ID (from current conversation tool results only)'),
    title: z.string().max(255).optional().describe('New title (optional)'),
    lines: z.array(lineSchema).min(1).max(50).describe('New line items (replaces all existing lines)'),
  }),
  handler: async (args, ctx) => {
    const resolvedLines = await Promise.all(
      args.lines.map(async (l) => {
        const resolved = await resolveUnit({ teamId: ctx.teamId, raw: l.unit });
        return { ...l, unit: resolved.label };
      }),
    );
    const quote = await updateQuote({
      teamId: ctx.teamId,
      quoteId: args.quoteId,
      title: args.title,
      lines: resolvedLines,
    });
    return { result: quote, richCard: { type: 'quote', data: quote } };
  },
  stateUpdate: (result, ctx) => {
    const doc = ctx.demandState.document;
    if (!doc) return null;
    return {
      document: {
        ...doc,
        generatedId: result.id,
        lines: result.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          tvaRate: l.tvaRate,
        })),
      },
    };
  },
});
