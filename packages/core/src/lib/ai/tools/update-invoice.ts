import { z } from 'zod';
import { defineTool, lineSchema } from './define-tool.js';
import { updateInvoice } from '../../../modules/invoices/index.js';
import { resolveUnit } from '../../../modules/units/index.js';

export const updateInvoiceTool = defineTool({
  name: 'update_invoice',
  description:
    `Update an existing invoice (draft only). Replaces ALL lines — include unchanged lines too with the user's modifications applied.
Once sent, paid, or cancelled, an invoice cannot be modified — propose to cancel and recreate if needed.
WHEN TO USE: when a generatedId exists in state or the user wants to modify an invoice from conversation history.
Call this DIRECTLY with all lines (old + new/modified). Do NOT call add_lines/update_line first — this tool replaces everything in one step.`,
  schema: z.object({
    invoiceId: z.string().uuid().describe('Invoice ID (from current conversation tool results only)'),
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
    const invoice = await updateInvoice({
      teamId: ctx.teamId,
      invoiceId: args.invoiceId,
      title: args.title,
      lines: resolvedLines,
    });
    return { result: invoice, richCard: { type: 'invoice', data: invoice } };
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
