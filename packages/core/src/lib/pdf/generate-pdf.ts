import fs from 'node:fs/promises';
import path from 'node:path';
import { renderPdf, renderPdfBuffer } from './render-pdf.js';
import { renderQuoteHtml } from './templates/quote.js';
import { renderInvoiceHtml } from './templates/invoice.js';
import { resolveLogoDataUri, type PdfTeam, type PdfClient, type PdfLine, type PdfTvaGroup } from './templates/shared.js';
import { embedFacturX } from '../facturx/embed-facturx.js';
import { buildInvoiceXml } from '../facturx/build-invoice-xml.js';
import { logger } from '../infra/logger.js';

const FILES_DIR = process.env.FILES_DIR ?? '/var/tuldio/files';

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
  prestationDate?: Date | null;
  invoiceType?: string;
  sourceInvoiceNumber?: string | null;
  situationNumber?: number | null;
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
        prestationDate: input.prestationDate ?? null,
        invoiceType: input.invoiceType,
        sourceInvoiceNumber: input.sourceInvoiceNumber,
        situationNumber: input.situationNumber,
      });
}

/** Generate PDF and persist to disk. Returns the file URL. */
export async function generatePdf(input: GeneratePdfInput): Promise<string> {
  const team = await resolveLogoDataUri(input.team);
  const html = buildHtml({ ...input, team });

  const prefix = input.type === 'quote' ? 'devis' : input.invoiceType === 'avoir' ? 'avoir' : 'facture';
  const fileName = `${prefix}-${input.id}.pdf`;

  const pdfUrl = await renderPdf({ html, fileName });

  // Post-process: embed Factur-X XML into invoice PDFs for e-invoicing compliance
  if (input.type === 'invoice') {
    const filePath = path.join(FILES_DIR, 'pdfs', fileName);
    const pdfBuffer = await fs.readFile(filePath);
    logger.info('facturx.embedding', { filePath, puppeteerSize: pdfBuffer.length });
    const xml = buildInvoiceXml(input);
    const facturxBuffer = await embedFacturX({
      pdf: Buffer.from(pdfBuffer),
      xml,
      metadata: {
        title: `${input.team.name}: Facture ${input.number}`,
        subject: `Facture ${input.number} - ${input.team.name}`,
        author: input.team.name,
      },
    });
    logger.info('facturx.embedded', { filePath, facturxSize: facturxBuffer.length });
    await fs.writeFile(filePath, new Uint8Array(facturxBuffer));
  }

  return pdfUrl;
}

/** Generate PDF in memory (no disk write). Returns the raw buffer. */
export async function generatePdfToBuffer(input: GeneratePdfInput): Promise<Buffer> {
  const team = await resolveLogoDataUri(input.team);
  const html = buildHtml({ ...input, team });
  return renderPdfBuffer(html);
}
