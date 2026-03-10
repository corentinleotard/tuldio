import { z } from 'zod';
import { defineTool, lineSchema, type ToolResult } from './define-tool.js';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { getQuote, updateQuote, updateQuoteStatusUc } from '../../../modules/quotes/index.js';
import { getInvoice, updateInvoice, updateInvoiceStatusUc } from '../../../modules/invoices/index.js';
import { resolveUnit } from '../../../modules/units/index.js';
import type { DocumentLineView } from '@tuldio/types';

const updatedLineSchema = z.object({
  lineId: z.string().uuid().describe('Line ID from the active document state'),
  description: z.string().min(1).max(500).optional().describe('New description'),
  quantity: z.number().positive().max(100_000).optional().describe('New quantity'),
  unit: z.string().max(50).optional().describe('New unit'),
  unitPrice: z.number().int().min(0).max(100_000_000).optional().describe('New unit price in cents'),
  tvaRate: z.number().int().optional().describe('New VAT rate in basis points'),
});

export const updateDocumentTool = defineTool({
  name: 'update_document',
  description:
    `Update the active document's lines, title, or status. Requires an active document in state.
Call get_active_document first to see current line IDs when you need to update or remove existing lines.
For line changes use delta operations:
  - addedLines: new lines to append
  - removedLineIds: IDs of lines to remove
  - updatedLines: partial field updates on existing lines (by lineId)
You can combine operations in a single call (e.g. add + remove + update).
For status changes: provide status only, no other fields. Invalid transitions will be rejected.
To delete a draft document, use delete_document instead.`,
  schema: z.object({
    title: z.string().max(255).optional().describe('New title'),
    status: z.enum(['sent', 'accepted', 'refused', 'paid', 'cancelled']).optional().describe('New status'),
    addedLines: z.array(lineSchema).max(50).optional().describe('New lines to append'),
    removedLineIds: z.array(z.string().uuid()).optional().describe('IDs of lines to remove'),
    updatedLines: z.array(updatedLineSchema).optional().describe('Partial updates to existing lines by lineId'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    const docId = ctx.demandState.document?.id;
    const docType = ctx.demandState.document?.type;

    if (!docId || !docType) {
      throw new HandledError(errorCodes.noDocumentPrepared);
    }

    // --- Status change ---
    if (args.status) {
      if (docType === 'invoice') {
        const invoice = await updateInvoiceStatusUc({ teamId: ctx.teamId, invoiceId: docId, status: args.status });
        return {
          result: invoice,
          richCard: { type: 'invoice', data: invoice },
          stateUpdate: { document: { id: docId, type: 'invoice' as const } },
        };
      }

      // Quote status
      const quote = await updateQuoteStatusUc({ teamId: ctx.teamId, quoteId: docId, status: args.status });
      return {
        result: quote,
        richCard: { type: 'quote', data: quote },
        stateUpdate: { document: { id: docId, type: 'quote' as const } },
      };
    }

    // --- Line/title update via deltas ---
    const hasLineChanges = args.addedLines?.length || args.removedLineIds?.length || args.updatedLines?.length;
    if (!hasLineChanges && !args.title) {
      throw new HandledError(errorCodes.invalidInput);
    }

    // Fetch current lines from DB
    const currentLines = await fetchCurrentLines({ teamId: ctx.teamId, docId, docType });

    // Apply deltas to produce the final line list
    const finalLines = applyLineDeltas({
      currentLines,
      addedLines: args.addedLines,
      removedLineIds: args.removedLineIds,
      updatedLines: args.updatedLines,
    });

    // Resolve units for all lines (added + updated ones may have new units)
    const resolvedLines = await Promise.all(
      finalLines.map(async (l) => {
        const resolved = await resolveUnit({ teamId: ctx.teamId, raw: l.unit });
        return { ...l, unit: resolved.label };
      }),
    );

    if (docType === 'quote') {
      const quote = await updateQuote({
        teamId: ctx.teamId,
        quoteId: docId,
        title: args.title,
        lines: resolvedLines,
      });
      return {
        result: quote,
        richCard: { type: 'quote', data: quote },
        stateUpdate: { document: { id: docId, type: 'quote' as const } },
      };
    }

    const invoice = await updateInvoice({
      teamId: ctx.teamId,
      invoiceId: docId,
      title: args.title,
      lines: resolvedLines,
    });
    return {
      result: invoice,
      richCard: { type: 'invoice', data: invoice },
      stateUpdate: { document: { id: docId, type: 'invoice' as const } },
    };
  },
});

// --- Helpers ---

interface LineDelta {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  tvaRate: number;
}

async function fetchCurrentLines(input: {
  teamId: string;
  docId: string;
  docType: 'quote' | 'invoice';
}): Promise<DocumentLineView[]> {
  if (input.docType === 'quote') {
    const quote = await getQuote({ teamId: input.teamId, quoteId: input.docId });
    return quote.lines;
  }
  const invoice = await getInvoice({ teamId: input.teamId, invoiceId: input.docId });
  return invoice.lines;
}

function applyLineDeltas(input: {
  currentLines: DocumentLineView[];
  addedLines?: Array<{ description: string; quantity: number; unit: string; unitPrice: number; tvaRate: number }>;
  removedLineIds?: string[];
  updatedLines?: Array<{ lineId: string; description?: string; quantity?: number; unit?: string; unitPrice?: number; tvaRate?: number }>;
}): LineDelta[] {
  const lineMap = new Map(input.currentLines.map((l) => [l.id, { ...l }]));

  // Apply updates
  if (input.updatedLines) {
    for (const update of input.updatedLines) {
      const existing = lineMap.get(update.lineId);
      if (!existing) {
        throw new HandledError(errorCodes.invalidInput);
      }
      lineMap.set(update.lineId, {
        ...existing,
        description: update.description ?? existing.description,
        quantity: update.quantity ?? existing.quantity,
        unit: update.unit ?? existing.unit,
        unitPrice: update.unitPrice ?? existing.unitPrice,
        tvaRate: update.tvaRate ?? existing.tvaRate,
      });
    }
  }

  // Apply removals
  if (input.removedLineIds) {
    for (const id of input.removedLineIds) {
      if (!lineMap.has(id)) {
        throw new HandledError(errorCodes.invalidInput);
      }
      lineMap.delete(id);
    }
  }

  // Build result: remaining lines in original order + appended new lines
  const lines: LineDelta[] = [];
  for (const existing of input.currentLines) {
    const line = lineMap.get(existing.id);
    if (line) {
      lines.push({
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        tvaRate: line.tvaRate,
      });
    }
  }

  if (input.addedLines) {
    for (const line of input.addedLines) {
      lines.push({
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        tvaRate: line.tvaRate,
      });
    }
  }

  if (lines.length === 0) {
    throw new HandledError(errorCodes.invalidInput);
  }

  return lines;
}
