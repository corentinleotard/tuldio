import { renderPdf, renderPdfBuffer } from './render-pdf.js';
import { renderQuoteHtml } from './templates/quote.js';
import { renderInvoiceHtml } from './templates/invoice.js';
import { resolveLogoDataUri, type PdfTeam, type PdfClient, type PdfLine, type PdfTvaGroup } from './templates/shared.js';

export interface GeneratePdfInput {
  type: 'quote' | 'invoice';
  id: string;
  number: string;
  team: PdfTeam;
  client: PdfClient;
  lines: PdfLine[];
  totalHt: number;
  totalTtc: number;
  tvaGroups: PdfTvaGroup[];
  createdAt: Date;
  dueDate?: Date | null;
  validUntil?: Date | null;
}

function buildHtml(input: GeneratePdfInput & { team: PdfTeam }): string {
  return input.type === 'quote'
    ? renderQuoteHtml({
        team: input.team,
        client: input.client,
        number: input.number,
        lines: input.lines,
        totalHt: input.totalHt,
        totalTtc: input.totalTtc,
        tvaGroups: input.tvaGroups,
        createdAt: input.createdAt,
        validUntil: input.validUntil ?? null,
      })
    : renderInvoiceHtml({
        team: input.team,
        client: input.client,
        number: input.number,
        lines: input.lines,
        totalHt: input.totalHt,
        totalTtc: input.totalTtc,
        tvaGroups: input.tvaGroups,
        createdAt: input.createdAt,
        dueDate: input.dueDate ?? null,
      });
}

/** Generate PDF and persist to disk. Returns the file URL. */
export async function generatePdf(input: GeneratePdfInput): Promise<string> {
  const team = await resolveLogoDataUri(input.team);
  const html = buildHtml({ ...input, team });

  const prefix = input.type === 'quote' ? 'devis' : 'facture';
  const fileName = `${prefix}-${input.id}.pdf`;

  return renderPdf({ html, fileName });
}

/** Generate PDF in memory (no disk write). Returns the raw buffer. */
export async function generatePdfToBuffer(input: GeneratePdfInput): Promise<Buffer> {
  const team = await resolveLogoDataUri(input.team);
  const html = buildHtml({ ...input, team });
  return renderPdfBuffer(html);
}
