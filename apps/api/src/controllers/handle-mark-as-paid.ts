import type { Request, Response } from 'express';
import { updateInvoiceStatusUc } from '@tuldio/core/invoices';
import { getTeamId } from '../middleware/auth.js';

export async function handleMarkAsPaid(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const invoice = await updateInvoiceStatusUc({ teamId, invoiceId: req.params.id as string, status: 'paid' });
  res.json({ data: invoice });
}
