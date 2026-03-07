import type { Request, Response } from 'express';
import { listInvoices } from '@tuldio/core/invoices';
import { getTeamId } from '../middleware/auth.js';

export async function handleListInvoices(_req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const invoices = await listInvoices({ teamId });

  res.json({ data: invoices });
}
