import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';
import type { InsertDocumentLine } from '../../shared/domain/document-validators.js';

export type { InsertDocumentLine as InsertInvoiceLine };

export async function insertInvoice(input: {
  teamId: string;
  createdBy: string;
  clientId: string;
  quoteId?: string;
  title?: string | null;
  lastNumber?: number;
  prestationDate?: Date | null;
  lines: InsertDocumentLine[];
  totalHt: number;
  totalTtc: number;
  dueDate?: Date;
}): Promise<InvoiceRow> {
  const id = generateId();
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;

  await query('BEGIN');

  try {
    await query(`SELECT pg_advisory_xact_lock(hashtext($1 || 'invoice'))`, [input.teamId]);

    const seqResult = await query<{ next_num: number }>(
      `SELECT GREATEST(COALESCE(MAX(CAST(SPLIT_PART(number, '-', 3) AS INTEGER)), 0), $3) + 1 AS next_num
       FROM invoices
       WHERE team_id = $1 AND number LIKE $2`,
      [input.teamId, `${prefix}%`, input.lastNumber ?? 0],
    );

    const nextNum = seqResult.rows[0]?.next_num ?? 1;
    const number = `${prefix}${String(nextNum).padStart(4, '0')}`;

    const result = await query<InvoiceRow>(
      `INSERT INTO invoices (id, team_id, created_by, client_id, quote_id, number, title, total_ht, total_ttc, due_date, prestation_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, team_id, created_by, client_id, quote_id, number, title, total_ht, total_ttc, status, pdf_url, sent_at, paid_at, cancelled_at, due_date, prestation_date, created_at`,
      [id, input.teamId, input.createdBy, input.clientId, input.quoteId ?? null, number, input.title ?? null, input.totalHt, input.totalTtc, input.dueDate ?? null, input.prestationDate ?? new Date()],
    );

    if (input.lines.length > 0) {
      const placeholders: string[] = [];
      const params: unknown[] = [];
      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i]!;
        const offset = i * 10;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
        params.push(generateId(), id, line.prestationId ?? null, i + 1, line.description, line.quantity, line.unit, line.unitPrice, line.tvaRate, line.totalHt);
      }
      await query(
        `INSERT INTO invoice_lines (id, invoice_id, prestation_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
         VALUES ${placeholders.join(', ')}`,
        params,
      );
    }

    await query('COMMIT');
    return result.rows[0]!;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}
