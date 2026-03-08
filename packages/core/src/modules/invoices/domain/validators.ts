import {
  validateDocumentLine,
  computeDocumentLineTotals,
  validateStatusTransition,
  type DocumentLineInput,
} from '../../shared/domain/document-validators.js';
import type { DocumentTotals } from '../../shared/domain/document-math.js';

export type { DocumentLineInput as InvoiceLineInput };

export const validateInvoiceLine = validateDocumentLine;

export function computeInvoiceTotals(lines: DocumentLineInput[]): DocumentTotals {
  return computeDocumentLineTotals(lines);
}

const invoiceTransitions: Record<string, string[]> = {
  draft: ['sent', 'paid', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  overdue: ['paid', 'cancelled'],
};

export function validateInvoiceStatusTransition(input: {
  from: string;
  to: string;
}): boolean {
  return validateStatusTransition({ ...input, transitions: invoiceTransitions });
}

// Invoice lines can only be modified while the invoice is still a draft
export function canEditInvoice(status: string): boolean {
  return status === 'draft';
}

export function canCancelInvoice(status: string): boolean {
  return status !== 'paid' && status !== 'cancelled';
}

export function isOverdue(input: { dueDate: Date | null; status: string; now: Date }): boolean {
  if (input.status !== 'sent' || !input.dueDate) return false;
  return input.now > input.dueDate;
}

export function buildAcompteLine(input: {
  quoteTitle: string | null;
  quoteTotalHt: number;
  percentage: number;
  tvaRate: number;
}): { description: string; quantity: number; unit: string; unitPrice: number; tvaRate: number } {
  const amount = Math.round(input.quoteTotalHt * input.percentage / 100);
  const label = input.quoteTitle
    ? `Acompte ${input.percentage}% — ${input.quoteTitle}`
    : `Acompte ${input.percentage}%`;
  return { description: label, quantity: 1, unit: 'forfait', unitPrice: amount, tvaRate: input.tvaRate };
}

export function computeRemaining(input: {
  quoteTotalHt: number;
  invoicedTotalHt: number;
}): number {
  return input.quoteTotalHt - input.invoicedTotalHt;
}
