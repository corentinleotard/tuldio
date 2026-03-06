import { z } from 'zod';

export const quoteLineSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(), // cents
  total: z.number(), // cents
});

export type QuoteLine = z.infer<typeof quoteLineSchema>;

export const quoteSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  created_by: z.string().uuid(),
  client_id: z.string().uuid(),
  number: z.string(),
  lines: z.array(quoteLineSchema),
  total_ht: z.number().int(),
  total_ttc: z.number().int(),
  tva_rate: z.number().int(),
  status: z.enum(['draft', 'sent', 'accepted', 'refused']),
  pdf_url: z.string().nullable(),
  sent_at: z.date().nullable(),
  created_at: z.date(),
});

export type QuoteRow = z.infer<typeof quoteSchema>;
