import type { InvoiceView } from '@tuldio/common';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { getClientDisplayName } from '../../clients/domain/get-client-display-name.js';
import { toInvoiceView } from './create-invoice.js';

export async function getInvoice(input: {
  teamId: string;
  invoiceId: string;
}): Promise<InvoiceView> {
  const invoice = await findInvoiceById(input);
  if (!invoice) {
    throw new HandledError(errorCodes.invoiceNotFound);
  }

  const client = await findClientById({ teamId: input.teamId, clientId: invoice.client_id });

  // Resolve source invoice number for avoir
  let sourceInvoiceNumber: string | undefined;
  if (invoice.source_invoice_id) {
    const sourceInv = await findInvoiceById({ teamId: input.teamId, invoiceId: invoice.source_invoice_id });
    sourceInvoiceNumber = sourceInv?.number;
  }

  return toInvoiceView(invoice, {
    clientName: client ? getClientDisplayName(client) : undefined,
    clientEmail: client?.email ?? undefined,
    sourceInvoiceNumber,
  });
}
