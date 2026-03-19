import { query } from '../../../lib/database/db.js';

export async function markProspectReplied(input: {
  email?: string;
  phone?: string;
}): Promise<void> {
  if (input.email) {
    await query(
      `UPDATE god_prospects
       SET sequence_status = 'replied', updated_at = now()
       WHERE lower(email) = lower($1)
         AND sequence_status = 'active'`,
      [input.email],
    );
  }

  if (input.phone) {
    await query(
      `UPDATE god_prospects
       SET sequence_status = 'replied', updated_at = now()
       WHERE whatsapp_phone = $1
         AND sequence_status = 'active'`,
      [input.phone],
    );
  }
}
