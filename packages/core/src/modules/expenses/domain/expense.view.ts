import type { ExpenseRow } from './expense.entity.js';

export interface ExpenseView {
  id: string;
  amount: number;
  category: string;
  vendor: string;
  receiptUrl: string | null;
  date: string;
  createdAt: string;
}

export function toExpenseView(row: ExpenseRow): ExpenseView {
  return {
    id: row.id,
    amount: row.amount,
    category: row.category,
    vendor: row.vendor,
    receiptUrl: row.receipt_url,
    date: row.date.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}
