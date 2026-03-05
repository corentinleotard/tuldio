import { findExpensesByTeam } from '../repository/find-expenses-by-team.js';
import { toExpenseView, type ExpenseView } from '../domain/expense.view.js';

export async function listExpenses(input: {
  teamId: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ExpenseView[]> {
  const expenses = await findExpensesByTeam(input);

  return expenses.map(toExpenseView);
}
