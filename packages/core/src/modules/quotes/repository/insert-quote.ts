import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { quoteLineSchema } from '../domain/quote.entity.js';
import type { QuoteRow } from '../domain/quote.entity.js';

const insertQuoteSchema = z.object({
  teamId: z.string().uuid(),
  createdBy: z.string().uuid(),
  clientId: z.string().uuid(),
  lines: z.array(quoteLineSchema),
  totalHt: z.number().int(),
  totalTtc: z.number().int(),
  tvaRate: z.number().int(),
});

export async function insertQuote(input: {
  teamId: string;
  createdBy: string;
  clientId: string;
  lines: { description: string; quantity: number; unitPrice: number; total: number }[];
  totalHt: number;
  totalTtc: number;
  tvaRate: number;
}): Promise<QuoteRow> {
  const validated = insertQuoteSchema.parse(input);
  const id = generateId();
  const year = new Date().getFullYear();
  const prefix = `DEVIS-${year}-`;

  await query('BEGIN');

  try {
    // Advisory lock per team to prevent race conditions on sequential numbering
    await query(`SELECT pg_advisory_xact_lock(hashtext($1 || 'quote'))`, [validated.teamId]);

    const seqResult = await query<{ next_num: number }>(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(number, '-', 3) AS INTEGER)), 0) + 1 AS next_num
       FROM quotes
       WHERE team_id = $1 AND number LIKE $2`,
      [validated.teamId, `${prefix}%`],
    );

    const nextNum = seqResult.rows[0]?.next_num ?? 1;
    const number = `${prefix}${String(nextNum).padStart(4, '0')}`;

    const result = await query<QuoteRow>(
      `INSERT INTO quotes (id, team_id, created_by, client_id, number, lines, total_ht, total_ttc, tva_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        validated.teamId,
        validated.createdBy,
        validated.clientId,
        number,
        JSON.stringify(validated.lines),
        validated.totalHt,
        validated.totalTtc,
        validated.tvaRate,
      ],
    );

    await query('COMMIT');

    return result.rows[0]!;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}
