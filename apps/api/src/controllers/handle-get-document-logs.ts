import type { Request, Response } from 'express';
import type { DocumentLogView } from '@tuldio/common';
import { findDocumentLogs } from '@tuldio/core/documents';
import { getTeamId } from '../middleware/auth.js';

export async function handleGetDocumentLogs(
  documentType: 'quote' | 'invoice',
  req: Request,
  res: Response,
): Promise<void> {
  const teamId = getTeamId(res);
  const documentId = req.params.id as string;

  const rows = await findDocumentLogs({ teamId, documentType, documentId });

  const logs: DocumentLogView[] = rows.map((row) => ({
    id: row.id,
    event: row.event as DocumentLogView['event'],
    recipientEmail: row.recipient_email,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
  }));

  res.json({ data: logs });
}
