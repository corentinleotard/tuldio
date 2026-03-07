import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { insertExpense } from '../repository/insert-expense.js';
import { findDuplicateExpense } from '../repository/find-duplicate-expense.js';
import { toExpenseView, type ExpenseView } from '../domain/expense.view.js';

export async function createExpense(input: {
  teamId: string;
  userId: string;
  amount: number;
  category: string;
  vendor: string;
  receiptUrl?: string;
  date: Date;
}): Promise<ExpenseView> {
  const duplicate = await findDuplicateExpense({
    teamId: input.teamId,
    vendor: input.vendor,
    amount: input.amount,
    date: input.date,
  });

  if (duplicate) {
    throw new HandledError(errorCodes.duplicateExpense);
  }

  const expense = await insertExpense({
    teamId: input.teamId,
    createdBy: input.userId,
    amount: input.amount,
    category: input.category,
    vendor: input.vendor,
    receiptUrl: input.receiptUrl,
    date: input.date,
  });

  logger.info('expense.created', { teamId: input.teamId, expenseId: expense.id, amount: input.amount, vendor: input.vendor });

  return toExpenseView(expense);
}
