import { z } from 'zod';

export const invoiceLineSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(), // cents
  total: z.number(), // cents
});

export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  created_by: z.string().uuid(),
  client_id: z.string().uuid(),
  quote_id: z.string().uuid().nullable(),
  number: z.string(),
  lines: z.array(invoiceLineSchema),
  total_ht: z.number().int(),
  total_ttc: z.number().int(),
  tva_rate: z.number().int(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue']),
  pdf_url: z.string().nullable(),
  sent_at: z.date().nullable(),
  paid_at: z.date().nullable(),
  due_date: z.date().nullable(),
  created_at: z.date(),
});

export type InvoiceRow = z.infer<typeof invoiceSchema>;
