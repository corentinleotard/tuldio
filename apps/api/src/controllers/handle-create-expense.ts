import type { Request, Response } from 'express';
import { createExpense } from '@tuldio/core/expenses';
import { getUserId, getTeamId } from '../middleware/auth.js';

export async function handleCreateExpense(req: Request, res: Response): Promise<void> {
  const userId = getUserId(res);
  const teamId = getTeamId(res);
  const { amount, category, vendor, receiptUrl, date } = req.body;

  const expense = await createExpense({
    teamId,
    userId,
    amount,
    category,
    vendor,
    receiptUrl,
    date: new Date(date),
  });

  res.status(201).json({ data: expense });
}
