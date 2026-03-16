import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';

export async function insertDocumentLog(input: {
  teamId: string;
  documentType: 'quote' | 'invoice';
  documentId: string;
  event: 'created' | 'status_changed' | 'email_sent' | 'downloaded' | 'viewed' | 'signed';
  recipientEmail?: string | null;
  downloadToken?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const id = generateId();
  await query(
    `INSERT INTO document_logs (id, team_id, document_type, document_id, event, recipient_email, download_token, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      input.teamId,
      input.documentType,
      input.documentId,
      input.event,
      input.recipientEmail ?? null,
      input.downloadToken ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
