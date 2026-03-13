import { query } from '../../../lib/database/db.js';
import type { InvoiceType } from '../domain/invoice.entity.js';

/** Assign a sequential number to a draft invoice. Wraps in its own transaction for advisory lock safety. */
export async function assignInvoiceNumber(input: {
  teamId: string;
  invoiceId: string;
  invoiceType: InvoiceType;
  lastNumber?: number;
}): Promise<string> {
  const year = new Date().getFullYear();
  const isAvoir = input.invoiceType === 'avoir';
  const prefix = isAvoir ? `AVO-${year}-` : `FAC-${year}-`;
  const lockKey = isAvoir ? 'avoir' : 'invoice';

  await query('BEGIN');
  try {
    await query(`SELECT pg_advisory_xact_lock(hashtext($1 || $2))`, [input.teamId, lockKey]);

    const seqResult = await query<{ next_num: number }>(
      `SELECT GREATEST(COALESCE(MAX(CAST(SPLIT_PART(number, '-', 3) AS INTEGER)), 0), $3) + 1 AS next_num
       FROM invoices
       WHERE team_id = $1 AND number LIKE $2`,
      [input.teamId, `${prefix}%`, input.lastNumber ?? 0],
    );

    const nextNum = seqResult.rows[0]?.next_num ?? 1;
    const number = `${prefix}${String(nextNum).padStart(4, '0')}`;

    await query(
      `UPDATE invoices SET number = $1 WHERE id = $2 AND team_id = $3`,
      [number, input.invoiceId, input.teamId],
    );

    await query('COMMIT');
    return number;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}
