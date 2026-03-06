import type { Request, Response } from 'express';
import { updateInvoice } from '@tuldio/core/invoices';
import { getTeamId } from '../middleware/auth.js';

export async function handleUpdateInvoice(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const { title, lines } = req.body;

  const invoice = await updateInvoice({
    teamId,
    invoiceId: req.params.id as string,
    title,
    lines,
  });

  res.json({ data: invoice });
}
