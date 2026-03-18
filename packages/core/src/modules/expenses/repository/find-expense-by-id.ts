import { query } from '../../../lib/database/db.js';
import type { ExpenseRow } from '../domain/expense.entity.js';

export async function findExpenseById(input: {
  id: string;
  teamId: string;
}): Promise<ExpenseRow | null> {
  const result = await query<ExpenseRow>(
    'SELECT id, team_id, created_by, amount, category, vendor, receipt_url, date, created_at FROM expenses WHERE id = $1 AND team_id = $2 LIMIT 1',
    [input.id, input.teamId],
  );

  return result.rows[0] ?? null;
}
