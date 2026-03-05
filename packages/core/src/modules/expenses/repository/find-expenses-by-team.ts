import { query } from '../../../lib/database/db.js';
import type { ExpenseRow } from '../domain/expense.entity.js';

export async function findExpensesByTeam(input: {
  teamId: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ExpenseRow[]> {
  const params: unknown[] = [input.teamId];
  let sql = 'SELECT * FROM expenses WHERE team_id = $1';

  if (input.startDate) {
    params.push(input.startDate);
    sql += ` AND date >= $${params.length}`;
  }

  if (input.endDate) {
    params.push(input.endDate);
    sql += ` AND date <= $${params.length}`;
  }

  sql += ' ORDER BY date DESC';

  const result = await query<ExpenseRow>(sql, params);

  return result.rows;
}
