export function computeInvoiceTotals(input: {
  lines: { description: string; quantity: number; unitPrice: number }[];
  tvaRate: number;
}): {
  totalHt: number;
  totalTtc: number;
  lines: { description: string; quantity: number; unitPrice: number; total: number }[];
} {
  const lines = input.lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    total: line.quantity * line.unitPrice,
  }));

  const totalHt = lines.reduce((sum, line) => sum + line.total, 0);
  const totalTtc = Math.round(totalHt + (totalHt * input.tvaRate) / 100);

  return { totalHt, totalTtc, lines };
}

const validTransitions: Record<string, string[]> = {
  draft: ['sent'],
  sent: ['paid', 'overdue'],
  overdue: ['paid'],
};

export function validateInvoiceStatusTransition(input: {
  from: string;
  to: string;
}): boolean {
  const allowed = validTransitions[input.from];
  return !!allowed && allowed.includes(input.to);
}
