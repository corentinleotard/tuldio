import type { Request, Response } from 'express';
import { getInvoice } from '@tuldio/core/invoices';
import { getFilePath } from '@tuldio/core/lib';
import { getTeamId } from '../middleware/auth.js';

export async function handleDownloadInvoicePdf(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const invoiceId = req.params.id as string;

  const invoice = await getInvoice({ teamId, invoiceId });
  if (!invoice.pdfUrl) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'PDF non disponible' } });
    return;
  }

  const filePath = getFilePath(invoice.pdfUrl);
  res.sendFile(filePath);
}
