import { query } from '../../../lib/database/db.js';

/** Assign a sequential number to a draft quote. Wraps in its own transaction for advisory lock safety. */
export async function assignQuoteNumber(input: {
  teamId: string;
  quoteId: string;
  lastNumber?: number;
}): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEVIS-${year}-`;

  await query('BEGIN');
  try {
    await query(`SELECT pg_advisory_xact_lock(hashtext($1 || 'quote'))`, [input.teamId]);

    const seqResult = await query<{ next_num: number }>(
      `SELECT GREATEST(COALESCE(MAX(CAST(SPLIT_PART(number, '-', 3) AS INTEGER)), 0), $3) + 1 AS next_num
       FROM quotes
       WHERE team_id = $1 AND number LIKE $2`,
      [input.teamId, `${prefix}%`, input.lastNumber ?? 0],
    );

    const nextNum = seqResult.rows[0]?.next_num ?? 1;
    const number = `${prefix}${String(nextNum).padStart(4, '0')}`;

    await query(
      `UPDATE quotes SET number = $1 WHERE id = $2 AND team_id = $3`,
      [number, input.quoteId, input.teamId],
    );

    await query('COMMIT');
    return number;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}
