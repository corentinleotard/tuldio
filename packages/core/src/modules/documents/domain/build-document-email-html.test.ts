import { describe, it, expect } from 'vitest';
import { buildDocumentEmailHtml } from './build-document-email-html.js';

describe('buildDocumentEmailHtml', () => {
  it('builds a quote email with correct content', () => {
    const html = buildDocumentEmailHtml({
      teamName: 'Martin BTP',
      documentType: 'quote',
      documentNumber: 'D-2025-0042',
      totalTtc: 312480,
      downloadUrl: 'https://app.tuldio.fr/api/d/abc123',
    });

    expect(html).toContain('Bonjour,');
    expect(html).toContain('devis');
    expect(html).toContain('D-2025-0042');
    // toLocaleString may use non-breaking space (U+202F) as thousands separator
    expect(html).toMatch(/3\s124,80/);
    expect(html).toContain('https://app.tuldio.fr/api/d/abc123');
    expect(html).toContain('Télécharger le devis');
    expect(html).toContain('Martin BTP');
    expect(html).toContain('Envoyé via Tuldio');
  });

  it('builds an invoice email with correct content', () => {
    const html = buildDocumentEmailHtml({
      teamName: 'Dupont Rénovation',
      documentType: 'invoice',
      documentNumber: 'F-2025-0018',
      totalTtc: 504000,
      downloadUrl: 'https://app.tuldio.fr/api/d/def456',
    });

    expect(html).toContain('facture');
    expect(html).toContain('F-2025-0018');
    expect(html).toMatch(/5\s040,00/);
    expect(html).toContain('Télécharger la facture');
    expect(html).toContain('Dupont Rénovation');
  });

  it('uses correct article for document type', () => {
    const quoteHtml = buildDocumentEmailHtml({
      teamName: 'Test',
      documentType: 'quote',
      documentNumber: 'D-001',
      totalTtc: 10000,
      downloadUrl: 'https://example.com/d/x',
    });
    expect(quoteHtml).toContain('Télécharger le devis');

    const invoiceHtml = buildDocumentEmailHtml({
      teamName: 'Test',
      documentType: 'invoice',
      documentNumber: 'F-001',
      totalTtc: 10000,
      downloadUrl: 'https://example.com/d/x',
    });
    expect(invoiceHtml).toContain('Télécharger la facture');
  });
});
