import type { InvoiceView } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { canCancelInvoice } from '../domain/validators.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { updateInvoiceStatus } from '../repository/update-invoice-status.js';
import { deleteInvoice } from '../repository/delete-invoice.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { toInvoiceView } from './create-invoice.js';

/**
 * Draft invoices → hard delete (not yet in accounting sequence).
 * Other cancellable statuses → mark as cancelled (preserve audit trail).
 */
export async function cancelOrDeleteInvoice(input: {
  teamId: string;
  invoiceId: string;
}): Promise<{ action: 'deleted' | 'cancelled'; invoice: InvoiceView | null }> {
  const invoice = await findInvoiceById({ teamId: input.teamId, invoiceId: input.invoiceId });
  if (!invoice) {
    throw new HandledError(errorCodes.invoiceNotFound);
  }

  if (!canCancelInvoice(invoice.status)) {
    throw new HandledError(errorCodes.invalidStatusTransition);
  }

  if (invoice.status === 'draft') {
    const deleted = await deleteInvoice({ teamId: input.teamId, invoiceId: input.invoiceId });
    if (!deleted) {
      throw new HandledError(errorCodes.invoiceNotFound);
    }
    logger.info('invoice.deleted', { teamId: input.teamId, invoiceId: input.invoiceId, number: invoice.number });
    return { action: 'deleted', invoice: null };
  }

  await updateInvoiceStatus({
    teamId: input.teamId,
    invoiceId: input.invoiceId,
    status: 'cancelled',
  });

  logger.info('invoice.cancelled', { teamId: input.teamId, invoiceId: input.invoiceId, number: invoice.number });

  const full = await findInvoiceById({ teamId: input.teamId, invoiceId: input.invoiceId });
  if (!full) throw new HandledError(errorCodes.invoiceNotFound);
  const client = await findClientById({ teamId: input.teamId, clientId: full.client_id });
  return {
    action: 'cancelled',
    invoice: toInvoiceView(full, {
      clientName: client ? `${client.first_name} ${client.last_name}` : undefined,
      clientEmail: client?.email ?? undefined,
    }),
  };
}
