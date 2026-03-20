import { logger } from '../../../lib/infra/logger.js';
import { findInvoiceByPdpId } from '../repository/find-invoice-by-pdp-id.js';
import { updateInvoicePdpStatus } from '../repository/update-invoice-pdp-status.js';
import { insertDocumentLog } from '../../documents/repository/insert-document-log.js';

export async function handlePdpStatusUpdate(input: {
  pdpId: string;
  status: string;
}): Promise<void> {
  const invoice = await findInvoiceByPdpId({ pdpId: input.pdpId });
  if (!invoice) {
    logger.warn('pdp.status_update.invoice_not_found', { pdpId: input.pdpId });
    return;
  }

  const previousStatus = invoice.pdp_status;
  await updateInvoicePdpStatus({
    teamId: invoice.team_id,
    invoiceId: invoice.id,
    pdpId: input.pdpId,
    pdpStatus: input.status,
  });

  await insertDocumentLog({
    teamId: invoice.team_id,
    documentType: 'invoice',
    documentId: invoice.id,
    event: 'pdp_status_changed',
    metadata: { pdpId: input.pdpId, from: previousStatus, to: input.status },
  });

  logger.info('pdp.status_updated', { invoiceId: invoice.id, pdpId: input.pdpId, from: previousStatus, to: input.status });
}
