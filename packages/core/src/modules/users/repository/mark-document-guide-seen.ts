import { query } from '../../../lib/database/db.js';

export async function markDocumentGuideSeen(userId: string): Promise<void> {
  await query(
    'UPDATE users SET has_seen_document_guide = true WHERE id = $1',
    [userId],
  );
}
