import { z } from 'zod';
import { HandledError } from '../../errors/handled-error.js';
import { errorCodes } from '../../errors/error-codes.js';
import { resolveUnit } from '../../../modules/units/index.js';
import type { DocumentLineView } from '@tuldio/common';

export const updatedLineSchema = z.object({
  lineId: z.string().uuid().describe('Line ID from get_document results'),
  description: z.string().min(1).max(500).optional().describe('New description'),
  quantity: z.number().positive().max(100_000).optional().describe('New quantity'),
  unit: z.string().max(50).optional().describe('New unit'),
  unitPrice: z.number().int().min(0).max(100_000_000).optional().describe('New unit price in euro cents (e.g. 4500 = 45.00€, 132000 = 1320.00€). Always multiply the euro amount by 100.'),
  tvaRate: z.number().int().optional().describe('New VAT rate in basis points'),
});

export interface LineDelta {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  tvaRate: number;
}

export function applyLineDeltas(input: {
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

/** Resolve unit labels for a list of lines (fuzzy unit matching via team config) */
export async function resolveLines(input: {
  teamId: string;
  lines: LineDelta[];
}): Promise<LineDelta[]> {
  return Promise.all(
    input.lines.map(async (l) => {
      const resolved = await resolveUnit({ teamId: input.teamId, raw: l.unit });
      return { ...l, unit: resolved.label };
    }),
  );
}
