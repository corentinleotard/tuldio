import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { invoiceLineSchema } from '../domain/invoice.entity.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';

const insertInvoiceSchema = z.object({
  teamId: z.string().uuid(),
  createdBy: z.string().uuid(),
  clientId: z.string().uuid(),
  quoteId: z.string().uuid().optional(),
  templateId: z.string().uuid(),
  lines: z.array(invoiceLineSchema),
  totalHt: z.number().int(),
  totalTtc: z.number().int(),
  tvaRate: z.number().int(),
  dueDate: z.date().optional(),
});

export async function insertInvoice(input: {
  teamId: string;
  createdBy: string;
  clientId: string;
  quoteId?: string;
  templateId: string;
  lines: { description: string; quantity: number; unitPrice: number; total: number }[];
  totalHt: number;
  totalTtc: number;
  tvaRate: number;
  dueDate?: Date;
}): Promise<InvoiceRow> {
  const validated = insertInvoiceSchema.parse(input);
  const id = generateId();
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;

  await query('BEGIN');

  try {
    const seqResult = await query<{ next_num: number }>(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(number, '-', 3) AS INTEGER)), 0) + 1 AS next_num
       FROM invoices
       WHERE team_id = $1 AND number LIKE $2
       FOR UPDATE`,
      [validated.teamId, `${prefix}%`],
    );

    const nextNum = seqResult.rows[0]?.next_num ?? 1;
    const number = `${prefix}${String(nextNum).padStart(4, '0')}`;

    const result = await query<InvoiceRow>(
      `INSERT INTO invoices (id, team_id, created_by, client_id, quote_id, template_id, number, lines, total_ht, total_ttc, tva_rate, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id,
        validated.teamId,
        validated.createdBy,
        validated.clientId,
        validated.quoteId ?? null,
        validated.templateId,
        number,
        JSON.stringify(validated.lines),
        validated.totalHt,
        validated.totalTtc,
        validated.tvaRate,
        validated.dueDate ?? null,
      ],
    );

    await query('COMMIT');

    return result.rows[0]!;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}
