import type { Request, Response } from 'express';
import { deleteInvoiceUc } from '@tuldio/core/invoices';
import { getTeamId } from '../middleware/auth.js';

export async function handleDeleteInvoice(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  await deleteInvoiceUc({ teamId, invoiceId: req.params.id as string });
  res.status(204).end();
}
