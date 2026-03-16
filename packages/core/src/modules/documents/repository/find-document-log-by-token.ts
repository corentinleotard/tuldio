// Intentionally not scoped by team_id — this is used by the public download endpoint
// where there is no authenticated team context. Security relies on token unguessability (256-bit).
import { query } from '../../../lib/database/db.js';

interface DocumentLogTokenRow {
  team_id: string;
  document_type: 'quote' | 'invoice';
  document_id: string;
}

export async function findDocumentLogByToken(input: {
  downloadToken: string;
}): Promise<DocumentLogTokenRow | null> {
  const result = await query<DocumentLogTokenRow>(
    `SELECT team_id, document_type, document_id
     FROM document_logs
     WHERE download_token = $1
     LIMIT 1`,
    [input.downloadToken],
  );
  return result.rows[0] ?? null;
}
