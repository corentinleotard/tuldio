import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { resolveUnit } from '../../../modules/units/index.js';

export const addLinesTool = defineTool({
  name: 'add_lines',
  description:
    `Add one or more lines to a document. If no document exists yet, provide type (and optionally title/tvaContext) to create one.
Lines are appended to the existing list — never replaces. Prices and TVA can be omitted and set later with update_line.
Call this once with all lines the user mentioned, or multiple times as the user adds more.
If the user does not specify TVA context, ask: "C'est de la réno ou du neuf ? Pour la TVA." Then apply French construction VAT rules per line type.
Do NOT call this if a generatedId already exists in state — use update_quote/update_invoice instead.`,
  schema: z.object({
    type: z.enum(['quote', 'invoice']).optional().describe('Document type — required if no document exists yet'),
    title: z.string().max(255).optional().describe('Document title (only used when creating a new document)'),
    tvaContext: z.enum(['réno', 'neuf']).optional().describe('TVA context — réno or neuf (only used when creating a new document)'),
    lines: z.array(z.object({
      description: z.string().min(1).max(500).describe('Line item description'),
      quantity: z.number().positive().max(100_000).describe('Quantity'),
      unit: z.string().max(50).default('u').describe('Unit of measure (e.g. u, m2, m, h, forfait, kg, L, lot, t, sac, palette, etc.)'),
      unitPrice: z.number().int().min(0).max(100_000_000).optional().describe('Unit price excl. tax in cents — omit if not yet known'),
      tvaRate: z.number().int().optional().describe('VAT rate in basis points (2000=20%, 1000=10%, 550=5.5%) — omit if not yet determined'),
    })).min(1).max(50).describe('Lines to add'),
  }),
  handler: async (args, ctx) => {
    let doc = ctx.demandState.document;
    if (!doc) {
      if (!args.type) {
        throw new HandledError(errorCodes.noDocumentPrepared);
      }
      doc = { type: args.type, title: args.title, tvaContext: args.tvaContext, lines: [] };
    }
    const resolvedLines = await Promise.all(
      args.lines.map(async (l) => {
        const resolved = await resolveUnit({ teamId: ctx.teamId, raw: l.unit });
        return { ...l, unit: resolved.label };
      }),
    );
    const newLines = [...doc.lines, ...resolvedLines];
    const allPriced = newLines.every((l) => l.unitPrice !== undefined);
    const needsTvaContext = !doc.tvaContext && newLines.some((l) => l.tvaRate === undefined);
    return {
      result: {
        addedCount: resolvedLines.length,
        totalLineCount: newLines.length,
        allPriced,
        document: { ...doc, lines: newLines },
      },
      ...(needsTvaContext ? { quickReplies: ['Réno', 'Neuf'] } : {}),
    };
  },
  stateUpdate: (result) => {
    return { document: result.document };
  },
});
