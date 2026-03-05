import type { Request, Response } from 'express';
import { listExpenses } from '@tuldio/core/expenses';
import { getTeamId } from '../middleware/auth.js';

export async function handleListExpenses(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

  const expenses = await listExpenses({ teamId, startDate, endDate });

  res.json({ data: expenses });
}
