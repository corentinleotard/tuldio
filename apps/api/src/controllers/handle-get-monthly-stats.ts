import type { Request, Response } from 'express';
import { getMonthlyStats } from '@tuldio/core/stats';
import { getTeamId } from '../middleware/auth.js';

export async function handleGetMonthlyStats(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const now = new Date();
  const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();

  const stats = await getMonthlyStats({ teamId, month, year });

  res.json({ data: stats });
}
