import type { InvoiceView } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
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

  return toInvoiceView(invoice, {
    clientName: client ? `${client.first_name} ${client.last_name}` : undefined,
    clientEmail: client?.email ?? undefined,
  });
}
