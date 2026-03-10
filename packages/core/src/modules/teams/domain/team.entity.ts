import { z } from 'zod';

export const teamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logo_url: z.string(),
  original_document_url: z.string(),
  quote_last_number: z.number().int(),
  quote_validity_days: z.number().int(),
  invoice_last_number: z.number().int(),
  invoice_payment_delay_days: z.number().int(),
  terms_accepted_at: z.date().nullable(),
  stripe_customer_id: z.string().nullable(),
  trial_ends_at: z.date().nullable(),
  subscription_status: z.enum(['trial', 'active', 'cancelled', 'expired']),
  created_at: z.date(),
});

export type TeamRow = z.infer<typeof teamSchema>;
