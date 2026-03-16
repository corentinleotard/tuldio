import fs from 'node:fs/promises';
import path from 'node:path';
import type { TeamField } from '@tuldio/common';

const FILES_DIR = process.env.FILES_DIR ?? '/var/tuldio/files';

export interface PdfTeam {
  name: string;
  logoUrl: string;
  fields: TeamField[];
}

export interface PdfClient {
  name: string;
  siret: string | null;
  tvaNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface PdfLine {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  tvaRate: number; // basis points
  totalHt: number;
}

export interface PdfTvaGroup {
  tvaRate: number;
  baseHt: number;
  tvaMontant: number;
}

/** Get a field value by key, respecting visibility for the given doc type */
export function getField(fields: TeamField[], key: string, docType?: 'quote' | 'invoice'): string {
  const field = fields.find((f) => f.key === key);
  if (!field) return '';
  if (docType === 'quote' && !field.showQuote) return '';
  if (docType === 'invoice' && !field.showInvoice) return '';
  return field.value;
}

/** Get a boolean field value by key, respecting visibility for the given doc type */
export function getBooleanField(fields: TeamField[], key: string, docType?: 'quote' | 'invoice'): boolean {
  return getField(fields, key, docType) === 'true';
}

/** Get visible custom (non-system) fields for a zone + doc type */
export function getCustomFields(fields: TeamField[], zone: string, docType: 'quote' | 'invoice'): TeamField[] {
  return fields.filter((f) => {
    if (f.zone !== zone || f.isSystem || !f.value) return false;
    if (docType === 'quote' && !f.showQuote) return false;
    if (docType === 'invoice' && !f.showInvoice) return false;
    return true;
  });
}

/** Get visible fields for a zone + doc type */
export function getVisibleFields(fields: TeamField[], zone: string, docType: 'quote' | 'invoice'): TeamField[] {
  return fields.filter((f) => {
    if (f.zone !== zone) return false;
    if (docType === 'quote' && !f.showQuote) return false;
    if (docType === 'invoice' && !f.showInvoice) return false;
    return f.value !== '';
  });
}

export async function resolveLogoDataUri(team: PdfTeam): Promise<PdfTeam> {
  if (!team.logoUrl) return team;
  try {
    const relative = team.logoUrl.replace(/^\/files\//, '');
    const filePath = path.resolve(FILES_DIR, relative);
    if (!filePath.startsWith(path.resolve(FILES_DIR))) {
      return { ...team, logoUrl: '' };
    }
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
    return { ...team, logoUrl: dataUri };
  } catch {
    return { ...team, logoUrl: '' };
  }
}

export function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' \u20AC';
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function formatSiret(siret: string): string {
  return siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4');
}

export function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Renders legal mentions from visible fields in legal zone
export function renderLegalMentions(fields: TeamField[], docType: 'quote' | 'invoice'): string {
  const parts: string[] = [];

  const earlyDiscount = getField(fields, 'early_payment_discount', docType);
  const latePenalty = getField(fields, 'late_penalty_rate', docType);
  const recoveryFee = getField(fields, 'recovery_fee', docType);

  if (earlyDiscount) parts.push(esc(earlyDiscount));
  if (latePenalty) parts.push(esc(latePenalty));
  if (recoveryFee) parts.push(esc(recoveryFee));

  const insuranceCompany = getField(fields, 'insurance_company', docType);
  if (insuranceCompany) {
    let ins = `Assurance : ${insuranceCompany}`;
    const policyNumber = getField(fields, 'insurance_policy_number', docType);
    const coverageZone = getField(fields, 'insurance_coverage_zone', docType);
    if (policyNumber) ins += ` \u2014 n\u00B0 ${policyNumber}`;
    if (coverageZone) ins += ` \u2014 ${coverageZone}`;
    parts.push(esc(ins));
  }

  const legalForm = getField(fields, 'legal_form', docType);
  const capitalSocial = getField(fields, 'capital_social', docType);
  if (legalForm) parts.push(esc(legalForm));
  if (capitalSocial) {
    const amount = Number(capitalSocial);
    if (!isNaN(amount)) parts.push(`au capital de ${formatCurrency(amount)}`);
  }

  const rcsCity = getField(fields, 'rcs_city', docType);
  const rmCity = getField(fields, 'rm_city', docType);
  const apeCode = getField(fields, 'ape_code', docType);
  if (rcsCity) parts.push(`RCS ${esc(rcsCity)}`);
  if (rmCity) parts.push(`RM ${esc(rmCity)}`);
  if (apeCode) parts.push(`APE ${esc(apeCode)}`);

  // Custom fields in legal zone
  const customLegal = fields.filter(
    (f) => !f.isSystem && f.zone === 'legal' && f.value &&
    (docType === 'quote' ? f.showQuote : f.showInvoice),
  );
  for (const clause of customLegal) {
    parts.push(esc(clause.value));
  }

  return parts.join(' \u00B7 ');
}

export const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page {
    size: A4;
    margin: 15mm 15mm 20mm 15mm;
    @bottom-left {
      content: "Créé avec Tuldio · tuldio.fr";
      font-size: 7pt;
      color: #bbb;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    }
    @bottom-right {
      content: counter(page) " / " counter(pages);
      font-size: 7pt;
      color: #999;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    }
  }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 9.5pt;
    color: #1a1a1a;
    line-height: 1.4;
  }

  /* -- Top row: company left, doc+client right -- */
  .top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 28px;
  }

  /* Left: logo + company info */
  .company-col {
    max-width: 50%;
  }
  .logo-box {
    margin-bottom: 8px;
  }
  .logo-box img {
    display: block;
    max-width: 100%;
    max-height: 55px;
    object-fit: contain;
  }
  .company-name {
    font-size: 13pt;
    font-weight: 700;
    color: #1B4D3E;
    margin-bottom: 3px;
  }
  .company-info {
    font-size: 8pt;
    color: #666;
    line-height: 1.55;
    text-align: left;
  }

  /* Right: document meta + client */
  .doc-col {
    text-align: right;
    max-width: 45%;
  }
  .doc-title {
    font-size: 20pt;
    font-weight: 800;
    color: #1B4D3E;
    letter-spacing: 1px;
    margin-bottom: 2px;
  }
  .doc-meta {
    font-size: 8.5pt;
    color: #666;
    margin-bottom: 1px;
  }
  .client-block {
    text-align: left;
    background: #f8f7f4;
    border: 1px solid #e5e2dc;
    border-radius: 5px;
    padding: 10px 14px;
    margin-top: 14px;
    min-width: 220px;
  }
  .client-label {
    font-size: 6.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #999;
    margin-bottom: 3px;
  }
  .client-name {
    font-size: 10pt;
    font-weight: 600;
    margin-bottom: 1px;
  }
  .client-info {
    font-size: 8pt;
    color: #666;
    line-height: 1.5;
  }

  /* -- Lines table -- */
  .lines-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  .lines-table th {
    background: #1B4D3E;
    color: #fff;
    font-size: 7.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 7px 8px;
    text-align: left;
  }
  .lines-table th.r { text-align: right; }
  .lines-table td {
    padding: 7px 8px;
    border-bottom: 1px solid #eae8e4;
    font-size: 8.5pt;
  }
  .lines-table td.r {
    text-align: right;
    white-space: nowrap;
  }
  .lines-table tr:last-child td {
    border-bottom: none;
  }

  /* -- Totals -- */
  .totals-row {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 20px;
  }
  .totals-table {
    border-collapse: collapse;
    min-width: 200px;
  }
  .totals-table td {
    padding: 4px 8px;
    font-size: 8.5pt;
  }
  .totals-table td.r {
    text-align: right;
    font-weight: 500;
    white-space: nowrap;
  }
  .totals-table .ttc td {
    font-size: 11pt;
    font-weight: 700;
    color: #1B4D3E;
    border-top: 2px solid #1B4D3E;
    padding-top: 6px;
  }

  /* -- Payment -- */
  .payment-box {
    background: #f8f7f4;
    border: 1px solid #e5e2dc;
    border-radius: 5px;
    padding: 8px 12px;
    font-size: 8pt;
    color: #555;
    line-height: 1.5;
    margin-bottom: 16px;
  }
  .payment-box strong { color: #1a1a1a; }

  /* -- Bottom row: legal left, signature right -- */
  .bottom-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid #eae8e4;
  }
  .legal-col {
    flex: 1;
    font-size: 7pt;
    color: #999;
    line-height: 1.7;
    max-width: 60%;
  }
  .signature-col {
    flex-shrink: 0;
    width: 200px;
  }
  .signature-box {
    border: 1px solid #e5e2dc;
    border-radius: 5px;
    padding: 10px 14px;
    min-height: 75px;
  }
  .signature-label {
    font-size: 7.5pt;
    color: #999;
    margin-bottom: 3px;
  }
  .signature-mention {
    font-size: 7pt;
    color: #bbb;
    font-style: italic;
  }

  /* -- Page number (fallback for non-@page browsers) -- */
  .page-number {
    position: fixed;
    bottom: 8mm;
    right: 0;
    font-size: 7pt;
    color: #999;
  }
`;
