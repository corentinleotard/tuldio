import type { Request, Response } from 'express';
import { findDocumentLogByToken, insertDocumentLog } from '@tuldio/core/documents';
import { downloadQuotePdf } from '@tuldio/core/quotes';
import { downloadInvoicePdf } from '@tuldio/core/invoices';
import { logger } from '@tuldio/core/lib';

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]/g, '_');
}

export async function handlePublicDownload(req: Request, res: Response): Promise<void> {
  const token = req.params.token as string;

  const logRow = await findDocumentLogByToken({ downloadToken: token });
  if (!logRow) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lien invalide ou expiré' } });
    return;
  }

  const { team_id: teamId, document_type: documentType, document_id: documentId } = logRow;

  const result = documentType === 'quote'
    ? await downloadQuotePdf({ teamId, quoteId: documentId })
    : await downloadInvoicePdf({ teamId, invoiceId: documentId });

  // Log download (async, don't block response)
  insertDocumentLog({
    teamId,
    documentType,
    documentId,
    event: 'downloaded',
  }).catch((err) => {
    logger.error('document_log.download_failed', { documentId, error: err instanceof Error ? err.message : String(err) });
  });

  const fileName = sanitizeFileName(result.fileName);

  if (result.type === 'file') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(result.filePath);
    return;
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(result.buffer);
}
