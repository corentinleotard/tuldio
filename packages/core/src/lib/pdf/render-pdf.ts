import path from 'node:path';
import fs from 'node:fs/promises';
import { getBrowser } from './browser.js';

const FILES_DIR = process.env.FILES_DIR ?? '/var/tuldio/files';

const PDF_OPTIONS = {
  format: 'A4' as const,
  margin: { top: '15mm', right: '15mm', bottom: '20mm', left: '15mm' },
  printBackground: true,
};

export async function renderPdfBuffer(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf(PDF_OPTIONS);
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

export async function renderPdf(input: {
  html: string;
  fileName: string;
}): Promise<string> {
  const pdfBuffer = await renderPdfBuffer(input.html);

  const pdfDir = path.join(FILES_DIR, 'pdfs');
  await fs.mkdir(pdfDir, { recursive: true });

  const filePath = path.join(pdfDir, input.fileName);
  await fs.writeFile(filePath, new Uint8Array(pdfBuffer));

  return `/files/pdfs/${input.fileName}`;
}
