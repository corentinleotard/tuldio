import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { getFilePath } from '../../../lib/storage/get-file-path.js';
import { generatePdfToBuffer } from '../../../lib/pdf/generate-pdf.js';
import { buildDocumentPdfInput } from '../../../lib/pdf/build-document-pdf-input.js';
import { findQuoteById } from '../repository/find-quote-by-id.js';
import { toLineViews, toTvaGroups } from '../../documents/domain/to-line-views.js';

type DownloadResult =
  | { type: 'file'; filePath: string; fileName: string }
  | { type: 'buffer'; buffer: Buffer; fileName: string };

export async function downloadQuotePdf(input: {
  teamId: string;
  quoteId: string;
}): Promise<DownloadResult> {
  const quote = await findQuoteById(input);
  if (!quote) throw new HandledError(errorCodes.quoteNotFound);

  const fileName = `devis-${quote.number}.pdf`;

  if (quote.pdf_url) {
    return { type: 'file', filePath: getFilePath(quote.pdf_url), fileName };
  }

  const lineViews = toLineViews(quote.lines);
  const tvaGroups = toTvaGroups(quote.lines);
  const pdfInput = await buildDocumentPdfInput({
    type: 'quote',
    teamId: input.teamId,
    id: quote.id,
    number: quote.number,
    clientId: quote.client_id,
    lines: lineViews,
    totalHt: quote.total_ht,
    totalTtc: quote.total_ttc,
    tvaGroups,
    createdAt: quote.created_at,
    validUntil: quote.valid_until,
  });

  const buffer = await generatePdfToBuffer(pdfInput);
  return { type: 'buffer', buffer, fileName };
}
