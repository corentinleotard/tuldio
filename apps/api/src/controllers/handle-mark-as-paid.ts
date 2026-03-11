import type { Request, Response } from 'express';
import { updateInvoiceStatusUc } from '@tuldio/core/invoices';
import { getTeamId, getUserId } from '../middleware/auth.js';

export async function handleMarkAsPaid(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const userId = getUserId(res);
  const invoice = await updateInvoiceStatusUc({ teamId, userId, invoiceId: req.params.id as string, status: 'paid' });
  res.json({ data: invoice });
}
