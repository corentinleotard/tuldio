import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
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

export async function getInvoice(input: {
  teamId: string;
  invoiceId: string;
}): Promise<InvoiceView> {
  const invoice = await findInvoiceById(input);
  if (!invoice) {
    throw new HandledError(errorCodes.invoiceNotFound);
  }

  return toInvoiceView(invoice);
}
