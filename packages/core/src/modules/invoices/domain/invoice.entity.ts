import { z } from 'zod';

// Facture                       │ Facture              │ Standard invoice for goods/services delivered                                        │
// ├───────────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
// │ Facture d'acompte             │ Facture d'acompte    │ Deposit/advance payment invoice (partial payment before delivery)                    │
// ├───────────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
// │ Facture d'avoir (credit note) │ Avoir                │ Cancellation/correction document — references the original invoice, negative amounts │
// ├───────────────────────────────┼──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
// │ Facture de situation          │ Facture de situation │ Progress billing (construction/long projects — % completion)                         │
// └───────────────────────────────┴──────────────────────┴─────────────────────────────────────────────────────────────────────────────────────

export const invoiceLineSchema = z.object({
  id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  prestation_id: z.string().uuid().nullable(),
  sort_order: z.number().int(),
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unit_price: z.number().int(), // cents
  tva_rate: z.number().int(), // basis points
  total_ht: z.number().int(), // cents
});

export type InvoiceLineRow = z.infer<typeof invoiceLineSchema>;

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  created_by: z.string().uuid(),
  client_id: z.string().uuid(),
  quote_id: z.string().uuid().nullable(),
  number: z.string(),
  title: z.string().nullable(),
  total_ht: z.number().int(),
  total_ttc: z.number().int(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  pdf_url: z.string().nullable(),
  sent_at: z.date().nullable(),
  paid_at: z.date().nullable(),
  cancelled_at: z.date().nullable(),
  due_date: z.date().nullable(),
  created_at: z.date(),
});

export type InvoiceRow = z.infer<typeof invoiceSchema>;
