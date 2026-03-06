import { renderPdfBuffer } from './render-pdf.js';
import { renderQuoteHtml } from './templates/quote.js';
import { renderInvoiceHtml } from './templates/invoice.js';
import { resolveLogoDataUri, type PdfTeam } from './templates/shared.js';

const SAMPLE_CLIENT = {
  name: 'Martin Jean',
  email: 'martin.jean@example.com',
  phone: '06 98 76 54 32',
  address: '45 avenue de la Republique, 69003 Lyon',
};

const SAMPLE_LINES = [
  { description: 'Prestation principale', quantity: 1, unitPrice: 80000, total: 80000 },
  { description: 'Fournitures', quantity: 1, unitPrice: 25000, total: 25000 },
  { description: 'Deplacement', quantity: 1, unitPrice: 5000, total: 5000 },
];

const SAMPLE_TOTAL_HT = 110000;
const SAMPLE_TVA_RATE = 20;
const SAMPLE_TOTAL_TTC = 132000;

export async function generatePreviewPdf(input: {
  type: 'quote' | 'invoice';
  team: PdfTeam;
}): Promise<Buffer> {
  const team = await resolveLogoDataUri(input.team);
  const now = new Date();

  const html =
    input.type === 'quote'
      ? renderQuoteHtml({
          team,
          client: SAMPLE_CLIENT,
          number: 'DEVIS-2025-0001',
          lines: SAMPLE_LINES,
          totalHt: SAMPLE_TOTAL_HT,
          totalTtc: SAMPLE_TOTAL_TTC,
          tvaRate: SAMPLE_TVA_RATE,
          createdAt: now,
        })
      : renderInvoiceHtml({
          team,
          client: SAMPLE_CLIENT,
          number: 'FAC-2025-0001',
          lines: SAMPLE_LINES,
          totalHt: SAMPLE_TOTAL_HT,
          totalTtc: SAMPLE_TOTAL_TTC,
          tvaRate: SAMPLE_TVA_RATE,
          createdAt: now,
          dueDate: new Date(now.getTime() + 30 * 86400000),
        });

  return renderPdfBuffer(html);
}
