import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { deleteInvoice } from '../repository/delete-invoice.js';

export async function deleteInvoiceUc(input: {
  teamId: string;
  invoiceId: string;
}): Promise<void> {
  const invoice = await findInvoiceById({ teamId: input.teamId, invoiceId: input.invoiceId });
  if (!invoice) {
    throw new HandledError(errorCodes.invoiceNotFound);
  }

  if (invoice.status !== 'draft') {
    throw new HandledError(errorCodes.invoiceNotDraft);
  }

  const deleted = await deleteInvoice({ teamId: input.teamId, invoiceId: input.invoiceId });
  if (!deleted) {
    throw new HandledError(errorCodes.invoiceNotFound);
  }

  logger.info('invoice.deleted', { teamId: input.teamId, invoiceId: input.invoiceId, number: invoice.number });
}
