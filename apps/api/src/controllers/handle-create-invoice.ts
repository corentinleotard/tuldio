import type { Request, Response } from 'express';
import { createInvoice } from '@tuldio/core/invoices';
import { getUserId, getTeamId } from '../middleware/auth.js';

export async function handleCreateInvoice(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const userId = getUserId(res);
  const { clientId, title, lines, dueDate, prestationDate } = req.body;

  const invoice = await createInvoice({
    teamId,
    userId,
    clientId,
    title,
    lines,
    dueDate: dueDate ? new Date(dueDate) : undefined,
    prestationDate: prestationDate ? new Date(prestationDate) : undefined,
  });

  res.status(201).json({ data: invoice });
}
