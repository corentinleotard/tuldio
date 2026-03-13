import { isValidTvaRate, computeDocumentTotals, type DocumentTotals } from './document-math.js';

export interface DocumentLineInput {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number; // cents
  tvaRate: number; // basis points
}

export function validateDocumentLine(line: DocumentLineInput): string[] {
  const errors: string[] = [];
  if (!line.description.trim()) errors.push('description is required');
  if (!Number.isFinite(line.quantity) || line.quantity <= 0) errors.push('quantity must be > 0');
  if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) errors.push('unitPrice must be >= 0');
  if (!Number.isInteger(line.unitPrice)) errors.push('unitPrice must be an integer (cents)');
  if (!Number.isInteger(line.tvaRate)) errors.push('tvaRate must be an integer (basis points)');
  if (!isValidTvaRate(line.tvaRate)) errors.push(`invalid tvaRate: ${line.tvaRate}`);
  return errors;
}

export function computeDocumentLineTotals(lines: DocumentLineInput[]): DocumentTotals {
  return computeDocumentTotals(lines);
}

export function validateStatusTransition(input: {
  from: string;
  to: string;
  transitions: Record<string, string[]>;
}): boolean {
  const allowed = input.transitions[input.from];
  return !!allowed && allowed.includes(input.to);
}

export interface InsertDocumentLine {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  tvaRate: number;
  totalHt: number;
  prestationId?: string | null;
}
