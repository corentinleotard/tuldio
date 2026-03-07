import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';

export const removeLineTool = defineTool({
  name: 'remove_line',
  description:
    `Remove a line from the current document by its index (0-based, visible in the current demand state).`,
  schema: z.object({
    index: z.number().int().min(0).describe('Line index to remove (0-based)'),
  }),
  handler: async (args, ctx) => {
    if (!ctx.demandState.document) {
      throw new HandledError(errorCodes.noDocumentPrepared);
    }
    const doc = ctx.demandState.document;
    if (args.index >= doc.lines.length) {
      throw new HandledError(errorCodes.invalidInput);
    }
    const lines = doc.lines.filter((_, i) => i !== args.index);
    const allPriced = lines.every((l) => l.unitPrice !== undefined);
    return {
      result: {
        removedIndex: args.index,
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
