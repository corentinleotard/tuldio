import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { hashToken } from '../domain/validators.js';

const REFRESH_TOKEN_DAYS = 90;

const insertRefreshTokenSchema = z.object({
  userId: z.string().uuid(),
  token: z.string().length(64),
});

export async function insertRefreshToken(input: {
  userId: string;
  token: string;
}): Promise<void> {
  const validated = insertRefreshTokenSchema.parse(input);
  const id = generateId();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await query(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
    [id, validated.userId, hashToken(validated.token), expiresAt],
  );
}
