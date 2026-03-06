import type { Request, Response } from 'express';
import { downloadInvoicePdf } from '@tuldio/core/invoices';
import { getTeamId } from '../middleware/auth.js';

export async function handleDownloadInvoicePdf(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const invoiceId = req.params.id as string;

  const result = await downloadInvoicePdf({ teamId, invoiceId });

  if (result.type === 'file') {
    res.sendFile(result.filePath);
    return;
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
  res.send(result.buffer);
}
