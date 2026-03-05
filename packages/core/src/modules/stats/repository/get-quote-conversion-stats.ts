import { query } from '../../../lib/database/db.js';

export interface QuoteConversionStats {
  total: number;
  accepted: number;
  rate: number;
}

export async function getQuoteConversionStats(input: {
  teamId: string;
  startDate: Date;
  endDate: Date;
}): Promise<QuoteConversionStats> {
  const result = await query<{ total: string; accepted: string }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE status = 'accepted')::text AS accepted
     FROM quotes
     WHERE team_id = $1
       AND created_at BETWEEN $2 AND $3`,
    [input.teamId, input.startDate, input.endDate],
  );

  const row = result.rows[0]!;
  const total = Number(row.total);
  const accepted = Number(row.accepted);

  return {
    total,
    accepted,
    rate: total > 0 ? accepted / total : 0,
  };
}
