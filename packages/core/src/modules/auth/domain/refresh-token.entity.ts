import { z } from 'zod';

export const refreshTokenSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  token: z.string().length(64),
  expires_at: z.date(),
  revoked: z.boolean(),
  created_at: z.date(),
});

export type RefreshTokenRow = z.infer<typeof refreshTokenSchema>;
