import { query } from '../../../lib/database/db.js';

export interface RevenueStats {
  totalHt: number;
  totalTtc: number;
  count: number;
}

export async function getRevenueStats(input: {
  teamId: string;
  startDate: Date;
  endDate: Date;
}): Promise<RevenueStats> {
  const result = await query<{ total_ht: string; total_ttc: string; count: string }>(
    `SELECT
       COALESCE(SUM(total_ht), 0) AS total_ht,
       COALESCE(SUM(total_ttc), 0) AS total_ttc,
       COUNT(*)::text AS count
     FROM invoices
     WHERE team_id = $1
       AND status = 'paid'
       AND paid_at BETWEEN $2 AND $3`,
    [input.teamId, input.startDate, input.endDate],
  );

  const row = result.rows[0]!;

  return {
    totalHt: Number(row.total_ht),
    totalTtc: Number(row.total_ttc),
    count: Number(row.count),
  };
}
