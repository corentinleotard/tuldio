import { renderPdfBuffer } from './render-pdf.js';
import { renderQuoteHtml } from './templates/quote.js';
import { renderInvoiceHtml } from './templates/invoice.js';
import { resolveLogoDataUri, type PdfTeam } from './templates/shared.js';

const SAMPLE_CLIENT = {
  name: 'Martin Jean',
  siret: null,
  tvaNumber: null,
  email: 'martin.jean@example.com',
  phone: '06 98 76 54 32',
  address: '45 avenue de la Republique, 69003 Lyon',
};

const SAMPLE_LINES = [
  { description: 'Prestation principale', quantity: 1, unit: 'u', unitPrice: 80000, tvaRate: 2000, totalHt: 80000 },
  { description: 'Fournitures', quantity: 1, unit: 'u', unitPrice: 25000, tvaRate: 2000, totalHt: 25000 },
  { description: 'Deplacement', quantity: 1, unit: 'u', unitPrice: 5000, tvaRate: 2000, totalHt: 5000 },
];

const SAMPLE_TOTAL_HT = 110000;
const SAMPLE_TOTAL_TTC = 132000;
const SAMPLE_TVA_GROUPS = [{ tvaRate: 2000, baseHt: 110000, tvaMontant: 22000 }];

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
          tvaGroups: SAMPLE_TVA_GROUPS,
          createdAt: now,
          validUntil: null,
        })
      : renderInvoiceHtml({
          team,
          client: SAMPLE_CLIENT,
          number: 'FAC-2025-0001',
          lines: SAMPLE_LINES,
          totalHt: SAMPLE_TOTAL_HT,
          totalTtc: SAMPLE_TOTAL_TTC,
          tvaGroups: SAMPLE_TVA_GROUPS,
          createdAt: now,
          dueDate: new Date(now.getTime() + 30 * 86400000),
          prestationDate: now,
        });

  return renderPdfBuffer(html);
}
