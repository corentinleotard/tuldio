import { renderPdf } from './render-pdf.js';
import { renderQuoteHtml } from './templates/quote.js';
import { renderInvoiceHtml } from './templates/invoice.js';
import { resolveLogoDataUri, type PdfTeam, type PdfClient, type PdfLine } from './templates/shared.js';

interface GeneratePdfInput {
  type: 'quote' | 'invoice';
  id: string;
  number: string;
  team: PdfTeam;
  client: PdfClient;
  lines: PdfLine[];
  totalHt: number;
  totalTtc: number;
  tvaRate: number;
  createdAt: Date;
  dueDate?: Date | null;
}

export async function generatePdf(input: GeneratePdfInput): Promise<string> {
  const team = await resolveLogoDataUri(input.team);

  const html =
    input.type === 'quote'
      ? renderQuoteHtml({
          team,
          client: input.client,
          number: input.number,
          lines: input.lines,
          totalHt: input.totalHt,
          totalTtc: input.totalTtc,
          tvaRate: input.tvaRate,
          createdAt: input.createdAt,
        })
      : renderInvoiceHtml({
          team,
          client: input.client,
          number: input.number,
          lines: input.lines,
          totalHt: input.totalHt,
          totalTtc: input.totalTtc,
          tvaRate: input.tvaRate,
          createdAt: input.createdAt,
          dueDate: input.dueDate ?? null,
        });

  const prefix = input.type === 'quote' ? 'devis' : 'facture';
  const fileName = `${prefix}-${input.id}.pdf`;

  return renderPdf({ html, fileName });
}
