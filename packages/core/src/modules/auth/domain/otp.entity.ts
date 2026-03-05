import { z } from 'zod';

export const otpSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  code: z.string().length(6),
  expires_at: z.date(),
  used: z.boolean(),
  created_at: z.date(),
});

export type OtpRow = z.infer<typeof otpSchema>;
