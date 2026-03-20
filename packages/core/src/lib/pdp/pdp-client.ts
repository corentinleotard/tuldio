import { logger } from '../infra/logger.js';
import { generateId } from '../infra/id.js';

export interface InvoiceMetadata {
  invoiceNumber: string;
  teamName: string;
  teamSiret: string;
  clientName: string;
  clientSiret: string | null;
  totalTtc: number;
  issuedAt: Date;
}

export interface PdpClient {
  /** Submit a Factur-X invoice to the PDP. Returns the PDP-assigned ID. */
  sendInvoice(input: { invoiceId: string; facturxPdf: Buffer; metadata: InvoiceMetadata }): Promise<{ pdpId: string }>;
  /** Report that an invoice has been paid. */
  reportPayment(input: { pdpId: string; paidAt: Date; amount: number }): Promise<void>;
}

// TODO: Replace with real PDP API client when partner is chosen (target: Q4 2026)
// Candidates: B2Brouter, Docaposte/SERES, or another certified PA with public API
// This placeholder logs the call and returns a fake pdp_id for development/testing
function createPlaceholderPdpClient(): PdpClient {
  return {
    async sendInvoice(input) {
      const pdpId = `pdp_placeholder_${generateId()}`;
      logger.info('pdp.send_invoice.placeholder', {
        invoiceId: input.invoiceId,
        pdpId,
        invoiceNumber: input.metadata.invoiceNumber,
        clientSiret: input.metadata.clientSiret,
        totalTtc: input.metadata.totalTtc,
      });
      return { pdpId };
    },

    async reportPayment(input) {
      logger.info('pdp.report_payment.placeholder', {
        pdpId: input.pdpId,
        paidAt: input.paidAt.toISOString(),
        amount: input.amount,
      });
    },
  };
}

let pdpClient: PdpClient | null = null;

export function getPdpClient(): PdpClient {
  if (!pdpClient) {
    // TODO: Instantiate real PDP client based on env config when available
    pdpClient = createPlaceholderPdpClient();
  }
  return pdpClient;
}
