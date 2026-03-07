import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { ExpenseRow } from '../domain/expense.entity.js';

const insertExpenseSchema = z.object({
  teamId: z.string().uuid(),
  createdBy: z.string().uuid(),
  amount: z.number().int(),
  category: z.string().min(1),
  vendor: z.string().min(1),
  receiptUrl: z.string().optional(),
  date: z.date(),
});

export async function insertExpense(input: {
  teamId: string;
  createdBy: string;
  amount: number;
  category: string;
  vendor: string;
  receiptUrl?: string;
  date: Date;
}): Promise<ExpenseRow> {
  const validated = insertExpenseSchema.parse(input);
  const id = generateId();

  const result = await query<ExpenseRow>(
    `INSERT INTO expenses (id, team_id, created_by, amount, category, vendor, receipt_url, date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, team_id, created_by, amount, category, vendor, receipt_url, date, created_at`,
    [
      id,
      validated.teamId,
      validated.createdBy,
      validated.amount,
      validated.category,
      validated.vendor,
      validated.receiptUrl ?? null,
      validated.date,
    ],
  );

  return result.rows[0]!;
}
