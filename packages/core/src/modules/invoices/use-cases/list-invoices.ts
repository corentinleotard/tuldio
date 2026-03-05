import { findInvoicesByTeam } from '../repository/find-invoices-by-team.js';
import type { InvoiceWithClient } from '../repository/find-invoices-by-team.js';
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

function toInvoiceView(row: InvoiceWithClient): InvoiceView {
  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: row.client_name,
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

export async function listInvoices(teamId: string): Promise<InvoiceView[]> {
  const invoices = await findInvoicesByTeam(teamId);

  return invoices.map(toInvoiceView);
}
