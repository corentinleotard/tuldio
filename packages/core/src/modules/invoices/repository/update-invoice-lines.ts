import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';
import type { InsertInvoiceLine } from './insert-invoice.js';

export async function updateInvoiceLines(input: {
  teamId: string;
  invoiceId: string;
  lines: InsertInvoiceLine[];
  totalHt: number;
  totalTtc: number;
  title?: string | null;
}): Promise<InvoiceRow | null> {
  await query('BEGIN');

  try {
    const setClauses = ['total_ht = $1', 'total_ttc = $2'];
    const params: unknown[] = [input.totalHt, input.totalTtc, input.invoiceId, input.teamId];

    if (input.title !== undefined) {
      setClauses.push(`title = $${params.length + 1}`);
      params.push(input.title);
    }

    const result = await query<InvoiceRow>(
      `UPDATE invoices
       SET ${setClauses.join(', ')}
       WHERE id = $3 AND team_id = $4 AND status = 'draft'
       RETURNING id, team_id, created_by, client_id, quote_id, number, title, total_ht, total_ttc, status, pdf_url, sent_at, paid_at, cancelled_at, due_date, created_at`,
      params,
    );

    if (result.rows.length === 0) {
      await query('ROLLBACK');
      return null;
    }

    await query('DELETE FROM invoice_lines WHERE invoice_id = $1', [input.invoiceId]);

    if (input.lines.length > 0) {
      const placeholders: string[] = [];
      const lineParams: unknown[] = [];
      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i]!;
        const offset = i * 10;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
        lineParams.push(generateId(), input.invoiceId, line.prestationId ?? null, i + 1, line.description, line.quantity, line.unit, line.unitPrice, line.tvaRate, line.totalHt);
      }
      await query(
        `INSERT INTO invoice_lines (id, invoice_id, prestation_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
         VALUES ${placeholders.join(', ')}`,
        lineParams,
      );
    }

    await query('COMMIT');
    return result.rows[0]!;
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}
