import { query } from '../../../lib/database/db.js';

interface DocumentLogRow {
  id: string;
  event: string;
  recipient_email: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export async function findDocumentLogs(input: {
  teamId: string;
  documentType: 'quote' | 'invoice';
  documentId: string;
  limit?: number;
}): Promise<DocumentLogRow[]> {
  const result = await query<DocumentLogRow>(
    `SELECT id, event, recipient_email, metadata, created_at
     FROM document_logs
     WHERE team_id = $1 AND document_type = $2 AND document_id = $3
     ORDER BY created_at DESC
     LIMIT $4`,
    [input.teamId, input.documentType, input.documentId, input.limit ?? 1000],
  );
  return result.rows;
}
