import { query } from '../../../lib/database/db.js';
import type { OtpRow } from '../domain/otp.entity.js';

export async function findValidOtp(input: {
  email: string;
  code: string;
}): Promise<OtpRow | null> {
  const result = await query<OtpRow>(
    `SELECT * FROM otp_codes
     WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.email, input.code],
  );

  return result.rows[0] ?? null;
}
