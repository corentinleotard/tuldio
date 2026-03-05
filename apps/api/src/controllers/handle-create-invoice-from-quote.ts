import type { Request, Response } from 'express';
import { createInvoiceFromQuote } from '@tuldio/core/invoices';
import { getUserId, getTeamId } from '../middleware/auth.js';

export async function handleCreateInvoiceFromQuote(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const userId = getUserId(res);
  const { quoteId, templateId } = req.body;

  const invoice = await createInvoiceFromQuote({ teamId, userId, quoteId, templateId });

  res.status(201).json({ data: invoice });
}
