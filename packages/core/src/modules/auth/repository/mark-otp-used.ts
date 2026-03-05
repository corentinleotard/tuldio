import { query } from '../../../lib/database/db.js';

export async function markOtpUsed(id: string): Promise<void> {
  await query('UPDATE otp_codes SET used = TRUE WHERE id = $1', [id]);
}
