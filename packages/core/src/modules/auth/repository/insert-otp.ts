import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';

const insertOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function insertOtp(input: { email: string; code: string }): Promise<void> {
  const validated = insertOtpSchema.parse(input);
  const id = generateId();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await query(
    'INSERT INTO otp_codes (id, email, code, expires_at) VALUES ($1, $2, $3, $4)',
    [id, validated.email, validated.code, expiresAt],
  );
}
