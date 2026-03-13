import type { InvoiceView } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { buildAvoirLines, computeInvoiceTotals } from '../domain/validators.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { insertInvoice } from '../repository/insert-invoice.js';
import { updateInvoiceAvoirId } from '../repository/update-invoice-avoir-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { getClientDisplayName } from '../../clients/domain/get-client-display-name.js';
import { toInvoiceView } from './create-invoice.js';

export async function createAvoir(input: {
  teamId: string;
  userId: string;
  sourceInvoiceId: string;
}): Promise<InvoiceView> {
  const source = await findInvoiceById({ teamId: input.teamId, invoiceId: input.sourceInvoiceId });
  if (!source) {
    throw new HandledError(errorCodes.invoiceNotFound);
  }

  // Only non-draft, non-avoir invoices can have an avoir (document must have been communicated to client)
  if (source.invoice_type === 'avoir') {
    throw new HandledError(errorCodes.invalidInput);
  }
  if (source.status !== 'sent' && source.status !== 'paid' && source.status !== 'overdue') {
    throw new HandledError(errorCodes.invalidStatusTransition);
  }

  // Cannot create a second avoir for the same invoice
  if (source.avoir_id) {
    throw new HandledError(errorCodes.invoiceAlreadyHasAvoir);
  }

  const avoirLines = buildAvoirLines(source.lines);
  const totals = computeInvoiceTotals(avoirLines);

  const avoir = await insertInvoice({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: source.client_id,
    quoteId: source.quote_id ?? undefined,
    title: source.title ? `Avoir — ${source.title}` : null,
    prestationDate: source.prestation_date ?? undefined,
    lines: avoirLines,
    totalHt: totals.totalHt,
    totalTtc: totals.totalTtc,
    invoiceType: 'avoir',
    sourceInvoiceId: source.id,
  });

  // Set back-reference on source invoice
  await updateInvoiceAvoirId({ teamId: input.teamId, invoiceId: source.id, avoirId: avoir.id });

  logger.info('avoir.created', {
    teamId: input.teamId,
    avoirId: avoir.id,
    avoirNumber: avoir.number,
    sourceInvoiceId: source.id,
    sourceInvoiceNumber: source.number,
  });

  const client = await findClientById({ teamId: input.teamId, clientId: source.client_id });
  const full = await findInvoiceById({ teamId: input.teamId, invoiceId: avoir.id });

  return toInvoiceView(full!, {
    clientName: client ? getClientDisplayName(client) : undefined,
    clientEmail: client?.email ?? undefined,
    sourceInvoiceNumber: source.number,
  });
}
