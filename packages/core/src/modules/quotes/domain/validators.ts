import {
  validateDocumentLine,
  computeDocumentLineTotals,
  validateStatusTransition,
  type DocumentLineInput,
} from '../../shared/domain/document-validators.js';
import type { DocumentTotals } from '../../shared/domain/document-math.js';

export type { DocumentLineInput as QuoteLineInput };

export const validateQuoteLine = validateDocumentLine;

export function computeQuoteTotals(lines: DocumentLineInput[]): DocumentTotals {
  return computeDocumentLineTotals(lines);
}

const quoteTransitions: Record<string, string[]> = {
  draft: ['sent', 'accepted', 'refused', 'cancelled'],
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

export function defaultValidUntil(createdAt: Date): Date {
  const date = new Date(createdAt);
  date.setDate(date.getDate() + 30);
  return date;
}
