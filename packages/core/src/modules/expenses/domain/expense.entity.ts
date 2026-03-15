import { z } from 'zod';

// TODO: Add tva_rate (basis points) and tva_amount (cents) columns to support
// TVA déductible tracking — required for proper accounting integration (e.g. Pennylane export).
export const expenseSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  created_by: z.string().uuid(),
  amount: z.number().int(),
  category: z.string(),
  vendor: z.string(),
  receipt_url: z.string().nullable(),
  date: z.date(),
  created_at: z.date(),
});

export type ExpenseRow = z.infer<typeof expenseSchema>;
