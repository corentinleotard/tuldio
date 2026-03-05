import { z } from 'zod';

export const teamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  siret: z.string(),
  address: z.string().nullable(),
  stripe_customer_id: z.string().nullable(),
  trial_ends_at: z.date().nullable(),
  subscription_status: z.enum(['trial', 'active', 'cancelled', 'expired']),
  created_at: z.date(),
});

export type TeamRow = z.infer<typeof teamSchema>;
