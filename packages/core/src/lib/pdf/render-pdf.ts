import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import React from 'react';
import { QuoteTemplate } from './quote-template.js';
import { InvoiceTemplate } from './invoice-template.js';
import { storeFile } from '../storage/store-file.js';

interface CompanyInfo {
  name: string;
  siret: string;
  address: string | null;
}

interface ClientInfo {
  name: string;
  email: string | null;
  address: string | null;
}

interface Line {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export async function renderQuotePdf(input: {
  number: string;
  date: string;
  company: CompanyInfo;
  client: ClientInfo;
  lines: Line[];
  totalHt: number;
  totalTtc: number;
  tvaRate: number;
}): Promise<string> {
  const element = React.createElement(QuoteTemplate, input) as unknown as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  return storeFile({
    subdir: 'quotes',
    buffer: Buffer.from(buffer),
    extension: '.pdf',
  });
}

export async function renderInvoicePdf(input: {
  number: string;
  date: string;
  dueDate: string | null;
  company: CompanyInfo;
  client: ClientInfo;
  lines: Line[];
  totalHt: number;
  totalTtc: number;
  tvaRate: number;
}): Promise<string> {
  const element = React.createElement(InvoiceTemplate, input) as unknown as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  return storeFile({
    subdir: 'invoices',
    buffer: Buffer.from(buffer),
    extension: '.pdf',
  });
}
