import { query } from '../../../lib/database/db.js';
import type { ExpenseRow } from '../domain/expense.entity.js';

export async function findDuplicateExpense(input: {
  teamId: string;
  vendor: string;
  amount: number;
  date: Date;
}): Promise<ExpenseRow | null> {
  const result = await query<ExpenseRow>(
    `SELECT * FROM expenses
     WHERE team_id = $1
       AND LOWER(vendor) = LOWER($2)
       AND amount = $3
       AND date BETWEEN $4::timestamptz - interval '1 day' AND $4::timestamptz + interval '1 day'
     LIMIT 1`,
    [input.teamId, input.vendor, input.amount, input.date],
  );

  return result.rows[0] ?? null;
}
