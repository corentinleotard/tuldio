import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { InsertQuoteLine } from './insert-quote.js';

export async function updateQuoteLines(input: {
  teamId: string;
  quoteId: string;
  lines: InsertQuoteLine[];
  totalHt: number;
  totalTtc: number;
  title?: string | null;
}): Promise<void> {
  await query('BEGIN');

  try {
    // Update quote first to verify ownership + status before touching lines
    const setClauses = ['total_ht = $1', 'total_ttc = $2'];
    const params: unknown[] = [input.totalHt, input.totalTtc, input.quoteId, input.teamId];

    if (input.title !== undefined) {
      setClauses.push(`title = $${params.length + 1}`);
      params.push(input.title);
    }

    const result = await query(
      `UPDATE quotes
       SET ${setClauses.join(', ')}
       WHERE id = $3 AND team_id = $4 AND status = 'draft'`,
      params,
    );

    if (result.rowCount === 0) {
      await query('ROLLBACK');
      return;
    }

    // Safe to delete lines now — we've confirmed team ownership
    await query('DELETE FROM quote_lines WHERE quote_id = $1', [input.quoteId]);

    if (input.lines.length > 0) {
      const placeholders: string[] = [];
      const lineParams: unknown[] = [];
      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i]!;
        const offset = i * 10;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
        lineParams.push(generateId(), input.quoteId, line.prestationId ?? null, i + 1, line.description, line.quantity, line.unit, line.unitPrice, line.tvaRate, line.totalHt);
      }
      await query(
        `INSERT INTO quote_lines (id, quote_id, prestation_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
         VALUES ${placeholders.join(', ')}`,
        lineParams,
      );
    }

    await query('COMMIT');
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}
