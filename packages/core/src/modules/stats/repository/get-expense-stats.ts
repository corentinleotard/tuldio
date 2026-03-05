import { query } from '../../../lib/database/db.js';

export interface ExpenseStats {
  total: number;
  count: number;
}

export async function getExpenseStats(input: {
  teamId: string;
  startDate: Date;
  endDate: Date;
}): Promise<ExpenseStats> {
  const result = await query<{ total: string; count: string }>(
    `SELECT
       COALESCE(SUM(amount), 0) AS total,
       COUNT(*)::text AS count
     FROM expenses
     WHERE team_id = $1
       AND date BETWEEN $2 AND $3`,
    [input.teamId, input.startDate, input.endDate],
  );

  const row = result.rows[0]!;

  return {
    total: Number(row.total),
    count: Number(row.count),
  };
}
