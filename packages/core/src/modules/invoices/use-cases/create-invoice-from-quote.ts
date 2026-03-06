import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findQuoteById } from '../../quotes/repository/find-quote-by-id.js';
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

function toInvoiceView(row: InvoiceRow, clientName?: string): InvoiceView {
  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: clientName ?? null,
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

export async function createInvoiceFromQuote(input: {
  teamId: string;
  userId: string;
  quoteId: string;
}): Promise<InvoiceView> {
  const quote = await findQuoteById({
    teamId: input.teamId,
    quoteId: input.quoteId,
  });

  if (!quote) {
    throw new HandledError(errorCodes.quoteNotFound);
  }

  const invoice = await insertInvoice({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: quote.client_id,
    quoteId: quote.id,
    lines: quote.lines,
    totalHt: quote.total_ht,
    totalTtc: quote.total_ttc,
    tvaRate: quote.tva_rate,
  });

  return toInvoiceView(invoice);
}
