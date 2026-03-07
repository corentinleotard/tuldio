import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { resolveUnit } from '../../../modules/units/index.js';

export const updateLineTool = defineTool({
  name: 'update_line',
  description:
    `Update one or more existing lines in the current document by their index (0-based, visible in the current demand state).
Use IMMEDIATELY when the user provides prices, quantities, or corrections for existing lines — do not ask for confirmation, just update.
Only include fields you want to change.`,
  schema: z.object({
    updates: z.array(z.object({
      index: z.number().int().min(0).describe('Line index (0-based, from current demand state)'),
      description: z.string().min(1).max(500).optional().describe('New description'),
      quantity: z.number().positive().max(100_000).optional().describe('New quantity'),
      unit: z.string().max(50).optional().describe('New unit of measure'),
      unitPrice: z.number().int().min(0).max(100_000_000).optional().describe('New unit price in cents'),
      tvaRate: z.number().int().optional().describe('New VAT rate in basis points'),
    })).min(1).max(50).describe('Line updates'),
  }),
  handler: async (args, ctx) => {
    if (!ctx.demandState.document) {
      throw new HandledError(errorCodes.noDocumentPrepared);
    }
    const doc = ctx.demandState.document;
    const lines = [...doc.lines];
    for (const update of args.updates) {
      if (update.index >= lines.length) {
        throw new HandledError(errorCodes.invalidInput);
      }
      const line = { ...lines[update.index]! };
      if (update.description !== undefined) line.description = update.description;
      if (update.quantity !== undefined) line.quantity = update.quantity;
      if (update.unit !== undefined) {
        const resolved = await resolveUnit({ teamId: ctx.teamId, raw: update.unit });
        line.unit = resolved.label;
      }
      if (update.unitPrice !== undefined) line.unitPrice = update.unitPrice;
      if (update.tvaRate !== undefined) line.tvaRate = update.tvaRate;
      lines[update.index] = line;
    }
    const allPriced = lines.every((l) => l.unitPrice !== undefined);
    return {
      result: {
        updatedCount: args.updates.length,
        totalLineCount: lines.length,
        allPriced,
        document: { ...doc, lines },
      },
    };
  },
  stateUpdate: (result) => {
    return { document: result.document };
  },
});
