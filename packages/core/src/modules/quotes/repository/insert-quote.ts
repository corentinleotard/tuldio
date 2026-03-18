import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { InsertDocumentLine } from '../../documents/domain/document-validators.js';

export type { InsertDocumentLine as InsertQuoteLine };

export async function insertQuote(input: {
  teamId: string;
  createdBy: string;
  clientId: string;
  title?: string | null;
  validUntil?: Date | null;
  lines: InsertDocumentLine[];
  totalHt: number;
  totalTtc: number;
}): Promise<{ id: string }> {
  const id = generateId();
  // Draft quotes get a temporary number — real sequential number assigned when leaving draft
  const number = `BROUILLON-${id}`;

  await query('BEGIN');

  try {
    await query(
      `INSERT INTO quotes (id, team_id, created_by, client_id, number, title, total_ht, total_ttc, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [id, input.teamId, input.createdBy, input.clientId, number, input.title ?? null, input.totalHt, input.totalTtc, input.validUntil ?? null],
    );

    if (input.lines.length > 0) {
      const placeholders: string[] = [];
      const params: unknown[] = [];
      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i]!;
        const offset = i * 10;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
        params.push(generateId(), id, line.prestationId ?? null, i + 1, line.description, line.quantity, line.unit, line.unitPrice, line.tvaRate, line.totalHt);
      }
      await query(
        `INSERT INTO quote_lines (id, quote_id, prestation_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
         VALUES ${placeholders.join(', ')}`,
        params,
      );
    }

    await query('COMMIT');
    return { id };
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}
