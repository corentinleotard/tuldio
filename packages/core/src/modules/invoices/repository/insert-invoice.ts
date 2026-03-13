import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { InvoiceRow, InvoiceType } from '../domain/invoice.entity.js';
import type { InsertDocumentLine } from '../../documents/domain/document-validators.js';

export type { InsertDocumentLine as InsertInvoiceLine };

export async function insertInvoice(input: {
  teamId: string;
  createdBy: string;
  clientId: string;
  quoteId?: string;
  title?: string | null;
  prestationDate?: Date | null;
  lines: InsertDocumentLine[];
  totalHt: number;
  totalTtc: number;
  dueDate?: Date;
  invoiceType?: InvoiceType;
  sourceInvoiceId?: string;
  situationNumber?: number;
}): Promise<InvoiceRow> {
  const id = generateId();
  const invoiceType = input.invoiceType ?? 'standard';
  // Draft invoices get a temporary number — real sequential number assigned when leaving draft
  const number = `BROUILLON-${id}`;

  await query('BEGIN');

  try {
    const result = await query<InvoiceRow>(
      `INSERT INTO invoices (id, team_id, created_by, client_id, quote_id, number, title, total_ht, total_ttc, due_date, prestation_date, invoice_type, source_invoice_id, situation_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, team_id, created_by, client_id, quote_id, number, title, total_ht, total_ttc, status, invoice_type, source_invoice_id, situation_number, avoir_id, pdf_url, sent_at, paid_at, cancelled_at, due_date, prestation_date, created_at`,
      [id, input.teamId, input.createdBy, input.clientId, input.quoteId ?? null, number, input.title ?? null, input.totalHt, input.totalTtc, input.dueDate ?? null, input.prestationDate ?? new Date(), invoiceType, input.sourceInvoiceId ?? null, input.situationNumber ?? null],
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
