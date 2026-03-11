import {
  validateDocumentLine,
  computeDocumentLineTotals,
  validateStatusTransition,
  type DocumentLineInput,
} from '../../shared/domain/document-validators.js';
import type { DocumentTotals } from '../../shared/domain/document-math.js';
import type { InvoiceType } from './invoice.entity.js';
import type { InvoiceLineRow } from './invoice.entity.js';

export type { DocumentLineInput as InvoiceLineInput };

export const validateInvoiceLine = validateDocumentLine;

export function computeInvoiceTotals(lines: DocumentLineInput[]): DocumentTotals {
  return computeDocumentLineTotals(lines);
}

const standardTransitions: Record<string, string[]> = {
  draft: ['sent', 'paid', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  overdue: ['paid', 'cancelled'],
  paid: ['cancelled'],
};

const avoirTransitions: Record<string, string[]> = {
  draft: ['sent'],
};

export function validateInvoiceStatusTransition(input: {
  from: string;
  to: string;
  invoiceType?: InvoiceType;
}): boolean {
  const transitions = input.invoiceType === 'avoir' ? avoirTransitions : standardTransitions;
  return validateStatusTransition({ ...input, transitions });
}

// Invoice lines can only be modified while the invoice is still a draft
export function canEditInvoice(status: string): boolean {
  return status === 'draft';
}

export function canCancelInvoice(status: string): boolean {
  return status !== 'paid' && status !== 'cancelled';
}

export function computeDueDate(input: { createdAt: Date; delayDays: number }): Date {
  const date = new Date(input.createdAt);
  date.setDate(date.getDate() + input.delayDays);
  return date;
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

/** Build avoir lines by negating all source invoice lines (full credit note). */
export function buildAvoirLines(sourceLines: InvoiceLineRow[]): Array<{
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  tvaRate: number;
  totalHt: number;
  prestationId: string | null;
}> {
  return sourceLines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    unitPrice: -l.unit_price,
    tvaRate: l.tva_rate,
    totalHt: -l.total_ht,
    prestationId: l.prestation_id,
  }));
}

/** Build solde lines: full quote lines + deduction lines for each acompte already invoiced. */
export function buildSoldeLines(input: {
  quoteLines: Array<{ description: string; quantity: number; unit: string; unit_price: number; tva_rate: number; total_ht: number; prestation_id: string | null }>;
  acompteInvoices: Array<{ number: string; total_ht: number; lines: InvoiceLineRow[] }>;
}): Array<{
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  tvaRate: number;
  totalHt: number;
  prestationId: string | null;
}> {
  const lines: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    tvaRate: number;
    totalHt: number;
    prestationId: string | null;
  }> = [];

  // Full quote lines
  for (const l of input.quoteLines) {
    lines.push({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unit_price,
      tvaRate: l.tva_rate,
      totalHt: l.total_ht,
      prestationId: l.prestation_id,
    });
  }

  // Deduction line per acompte (negative)
  for (const acompte of input.acompteInvoices) {
    // Use the first line's tva_rate as the acompte rate (acompte has a single line)
    const tvaRate = acompte.lines[0]?.tva_rate ?? 0;
    lines.push({
      description: `Déduction acompte ${acompte.number}`,
      quantity: 1,
      unit: 'forfait',
      unitPrice: -acompte.total_ht,
      tvaRate,
      totalHt: -acompte.total_ht,
      prestationId: null,
    });
  }

  return lines;
}
