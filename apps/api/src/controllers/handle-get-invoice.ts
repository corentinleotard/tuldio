import type { Request, Response } from 'express';
import { getInvoice } from '@tuldio/core/invoices';
import { getTeamId } from '../middleware/auth.js';

export async function handleGetInvoice(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const invoice = await getInvoice({ teamId, invoiceId: req.params.id as string });

  res.json({ data: invoice });
}
