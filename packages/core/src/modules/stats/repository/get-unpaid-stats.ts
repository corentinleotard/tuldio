import { query } from '../../../lib/database/db.js';

export interface UnpaidStats {
  total: number;
  count: number;
}

export async function getUnpaidStats(teamId: string): Promise<UnpaidStats> {
  const result = await query<{ total: string; count: string }>(
    `SELECT
       COALESCE(SUM(total_ttc), 0) AS total,
       COUNT(*)::text AS count
     FROM invoices
     WHERE team_id = $1
       AND status IN ('sent', 'overdue')`,
    [teamId],
  );

  const row = result.rows[0]!;

  return {
    total: Number(row.total),
    count: Number(row.count),
  };
}
