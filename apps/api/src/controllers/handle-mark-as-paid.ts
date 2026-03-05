import type { Request, Response } from 'express';
import { markAsPaid } from '@tuldio/core/invoices';
import { getTeamId } from '../middleware/auth.js';

export async function handleMarkAsPaid(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const invoice = await markAsPaid({ teamId, invoiceId: req.params.id as string });

  res.json({ data: invoice });
}
