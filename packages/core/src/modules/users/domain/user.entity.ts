import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  email: z.string().email(),
  phone: z.string().nullable(),
  name: z.string(),
  role: z.enum(['owner', 'member']),
  created_at: z.date(),
});

export type UserRow = z.infer<typeof userSchema>;
