import type { Request, Response } from 'express';
import { updateInvoiceStatusUc } from '@tuldio/core/invoices';
import { getTeamId, getUserId } from '../middleware/auth.js';

const VALID_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const;

export async function handleUpdateInvoiceStatus(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const userId = getUserId(res);
  const status = req.body.status as string;

  if (!status || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'Invalid status value' } });
    return;
  }

  const invoice = await updateInvoiceStatusUc({ teamId, userId, invoiceId: req.params.id as string, status });
  res.json({ data: invoice });
}
