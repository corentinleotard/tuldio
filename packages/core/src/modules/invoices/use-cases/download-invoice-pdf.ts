import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { getFilePath } from '../../../lib/storage/get-file-path.js';
import { generatePdfToBuffer } from '../../../lib/pdf/generate-pdf.js';
import { buildDocumentPdfInput } from '../../../lib/pdf/build-document-pdf-input.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { toLineViews, toTvaGroups } from '../../shared/domain/to-line-views.js';

type DownloadResult =
  | { type: 'file'; filePath: string; fileName: string }
  | { type: 'buffer'; buffer: Buffer; fileName: string };

export async function downloadInvoicePdf(input: {
  teamId: string;
  invoiceId: string;
}): Promise<DownloadResult> {
  const invoice = await findInvoiceById(input);
  if (!invoice) throw new HandledError(errorCodes.invoiceNotFound);

  const fileName = `facture-${invoice.number}.pdf`;

  if (invoice.pdf_url) {
    return { type: 'file', filePath: getFilePath(invoice.pdf_url), fileName };
  }

  const lineViews = toLineViews(invoice.lines);
  const tvaGroups = toTvaGroups(invoice.lines);
  const pdfInput = await buildDocumentPdfInput({
    type: 'invoice',
    teamId: input.teamId,
    id: invoice.id,
    number: invoice.number,
    clientId: invoice.client_id,
    lines: lineViews,
    totalHt: invoice.total_ht,
    totalTtc: invoice.total_ttc,
    tvaGroups,
    createdAt: invoice.created_at,
    dueDate: invoice.due_date,
  });

  const buffer = await generatePdfToBuffer(pdfInput);
  return { type: 'buffer', buffer, fileName };
}
