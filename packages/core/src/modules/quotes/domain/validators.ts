import {
  validateDocumentLine,
  computeDocumentLineTotals,
  validateStatusTransition,
  type DocumentLineInput,
} from '../../documents/domain/document-validators.js';
import type { DocumentTotals } from '../../documents/domain/document-math.js';

export type { DocumentLineInput as QuoteLineInput };

export const validateQuoteLine = validateDocumentLine;

export function computeQuoteTotals(lines: DocumentLineInput[]): DocumentTotals {
  return computeDocumentLineTotals(lines);
}

const quoteTransitions: Record<string, string[]> = {
  draft: ['sent', 'accepted', 'refused'],
  sent: ['accepted', 'refused', 'cancelled'],
};

export function validateQuoteStatusTransition(input: {
  from: string;
  to: string;
}): boolean {
  return validateStatusTransition({ ...input, transitions: quoteTransitions });
}

export function canEditQuote(input: {
  status: string;
  hasLinkedInvoices: boolean;
}): boolean {
  if (input.hasLinkedInvoices) return false;
  return input.status === 'draft';
}

export function canInvoiceQuote(status: string): boolean {
  return status !== 'refused' && status !== 'cancelled';
}

export function shouldAutoAcceptQuote(status: string): boolean {
  return canInvoiceQuote(status) && status !== 'accepted';
}

export function defaultValidUntil(input: { createdAt: Date; days: number }): Date {
  const date = new Date(input.createdAt);
  date.setDate(date.getDate() + input.days);
  return date;
}
