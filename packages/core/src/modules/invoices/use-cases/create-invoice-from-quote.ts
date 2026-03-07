import type { InvoiceView } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { findQuoteById } from '../../quotes/repository/find-quote-by-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { insertInvoice } from '../repository/insert-invoice.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { toInvoiceView } from './create-invoice.js';

export async function createInvoiceFromQuote(input: {
  teamId: string;
  userId: string;
  quoteId: string;
  title?: string;
}): Promise<InvoiceView> {
  const quote = await findQuoteById({
    teamId: input.teamId,
    quoteId: input.quoteId,
  });

  if (!quote) {
    throw new HandledError(errorCodes.quoteNotFound);
  }

  // Only accepted or sent quotes can be invoiced
  if (quote.status !== 'accepted' && quote.status !== 'sent') {
    throw new HandledError(errorCodes.invalidStatusTransition);
  }

  // Copy quote lines to invoice lines
  const insertLines = quote.lines.map((l) => ({
    description: l.description,
    quantity: Number(l.quantity),
    unit: l.unit,
    unitPrice: l.unit_price,
    tvaRate: l.tva_rate,
    totalHt: l.total_ht,
    prestationId: l.prestation_id,
  }));

  const invoice = await insertInvoice({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: quote.client_id,
    quoteId: quote.id,
    title: input.title ?? quote.title,
    lines: insertLines,
    totalHt: quote.total_ht,
    totalTtc: quote.total_ttc,
  });

  logger.info('invoice.created_from_quote', { teamId: input.teamId, invoiceId: invoice.id, quoteId: input.quoteId, number: invoice.number });

  const client = await findClientById({ teamId: input.teamId, clientId: quote.client_id });
  const full = await findInvoiceById({ teamId: input.teamId, invoiceId: invoice.id });

  return toInvoiceView(full!, {
    clientName: client ? `${client.first_name} ${client.last_name}` : undefined,
    clientEmail: client?.email ?? undefined,
  });
}
