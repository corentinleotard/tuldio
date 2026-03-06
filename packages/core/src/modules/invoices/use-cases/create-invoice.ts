import { computeInvoiceTotals } from '../domain/validators.js';
import { insertInvoice } from '../repository/insert-invoice.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';

interface InvoiceView {
  id: string;
  number: string;
  clientId: string;
  clientName: string | null;
  quoteId: string | null;
  lines: InvoiceRow['lines'];
  totalHt: number;
  totalTtc: number;
  tvaRate: number;
  status: string;
  pdfUrl: string | null;
  sentAt: string | null;
  paidAt: string | null;
  dueDate: string | null;
  createdAt: string;
}

function toInvoiceView(row: InvoiceRow): InvoiceView {
  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: null,
    quoteId: row.quote_id,
    lines: row.lines,
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaRate: row.tva_rate,
    status: row.status,
    pdfUrl: row.pdf_url,
    sentAt: row.sent_at?.toISOString() ?? null,
    paidAt: row.paid_at?.toISOString() ?? null,
    dueDate: row.due_date?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createInvoice(input: {
  teamId: string;
  userId: string;
  clientId: string;
  templateId: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
  tvaRate: number;
  dueDate?: Date;
}): Promise<InvoiceView> {
  const { totalHt, totalTtc, lines } = computeInvoiceTotals({
    lines: input.lines,
    tvaRate: input.tvaRate,
  });

  const invoice = await insertInvoice({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: input.clientId,
    templateId: input.templateId,
    lines,
    totalHt,
    totalTtc,
    tvaRate: input.tvaRate,
    dueDate: input.dueDate,
  });

  // TODO: PDF generation will be reimplemented with Puppeteer + React template

  return toInvoiceView(invoice);
}
