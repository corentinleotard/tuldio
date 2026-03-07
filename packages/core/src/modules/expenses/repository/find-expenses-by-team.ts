import { query } from '../../../lib/database/db.js';
import type { ExpenseRow } from '../domain/expense.entity.js';

export async function findExpensesByTeam(input: {
  teamId: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<ExpenseRow[]> {
  const params: unknown[] = [input.teamId];
  let sql = 'SELECT id, team_id, created_by, amount, category, vendor, receipt_url, date, created_at FROM expenses WHERE team_id = $1';

  if (input.startDate) {
    params.push(input.startDate);
    sql += ` AND date >= $${params.length}`;
  }

  if (input.endDate) {
    params.push(input.endDate);
    sql += ` AND date <= $${params.length}`;
  }

  const limit = input.limit ?? 1000;
  params.push(limit);
  sql += ` ORDER BY date DESC LIMIT $${params.length}`;

  const result = await query<ExpenseRow>(sql, params);

  return result.rows;
}
