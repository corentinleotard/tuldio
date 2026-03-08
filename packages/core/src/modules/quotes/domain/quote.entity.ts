import { z } from 'zod';

export const quoteLineSchema = z.object({
  id: z.string().uuid(),
  quote_id: z.string().uuid(),
  prestation_id: z.string().uuid().nullable(),
  sort_order: z.number().int(),
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unit_price: z.number().int(), // cents
  tva_rate: z.number().int(), // basis points
  total_ht: z.number().int(), // cents
});

export type QuoteLineRow = z.infer<typeof quoteLineSchema>;

export const quoteSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  created_by: z.string().uuid(),
  client_id: z.string().uuid(),
  number: z.string(),
  title: z.string().nullable(),
  total_ht: z.number().int(),
  total_ttc: z.number().int(),
  status: z.enum(['draft', 'sent', 'accepted', 'refused', 'cancelled']),
  pdf_url: z.string().nullable(),
  valid_until: z.date().nullable(),
  sent_at: z.date().nullable(),
  accepted_at: z.date().nullable(),
  refused_at: z.date().nullable(),
  cancelled_at: z.date().nullable(),
  created_at: z.date(),
});

export type QuoteRow = z.infer<typeof quoteSchema>;
