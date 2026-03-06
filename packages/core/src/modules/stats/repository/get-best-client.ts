import { query } from '../../../lib/database/db.js';

export interface BestClientStats {
  clientId: string;
  clientName: string;
  total: number;
}

export async function getBestClient(input: {
  teamId: string;
  startDate: Date;
  endDate: Date;
}): Promise<BestClientStats | null> {
  const result = await query<{ client_id: string; client_name: string; total: string }>(
    `SELECT
       c.id AS client_id,
       c.first_name || ' ' || c.last_name AS client_name,
       COALESCE(SUM(i.total_ttc), 0) AS total
     FROM invoices i
     JOIN clients c ON c.id = i.client_id
     WHERE i.team_id = $1
       AND i.status = 'paid'
       AND i.paid_at BETWEEN $2 AND $3
     GROUP BY c.id, c.first_name, c.last_name
     ORDER BY total DESC
     LIMIT 1`,
    [input.teamId, input.startDate, input.endDate],
  );

  const row = result.rows[0];

  if (!row) return null;

  return {
    clientId: row.client_id,
    clientName: row.client_name,
    total: Number(row.total),
  };
}
