import type { Request, Response } from 'express';
import { createInvoice } from '@tuldio/core/invoices';
import { getUserId, getTeamId } from '../middleware/auth.js';

export async function handleCreateInvoice(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const userId = getUserId(res);
  const { clientId, lines, tvaRate, dueDate } = req.body;

  const invoice = await createInvoice({
    teamId,
    userId,
    clientId,
    lines,
    tvaRate,
    dueDate: dueDate ? new Date(dueDate) : undefined,
  });

  res.status(201).json({ data: invoice });
}
