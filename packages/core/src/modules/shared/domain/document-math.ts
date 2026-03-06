export interface DocumentLine {
  quantity: number;
  unitPrice: number; // cents
  tvaRate: number; // basis points (2000 = 20%)
}

export interface TvaGroup {
  tvaRate: number;
  baseHt: number; // cents
  tvaMontant: number; // cents
}

export interface DocumentTotals {
  totalHt: number; // cents
  totalTtc: number; // cents
  tvaGroups: TvaGroup[];
}

const VALID_TVA_RATES = [0, 550, 1000, 2000] as const;

export function isValidTvaRate(rate: number): boolean {
  return (VALID_TVA_RATES as readonly number[]).includes(rate);
}

export function computeLineTotal(input: {
  quantity: number;
  unitPrice: number;
}): number {
  return Math.round(input.quantity * input.unitPrice);
}

export function computeTva(input: {
  totalHt: number;
  tvaRate: number;
}): number {
  return Math.round(input.totalHt * input.tvaRate / 10000);
}

export function groupByTva(lines: DocumentLine[]): TvaGroup[] {
  const groups = new Map<number, number>();

  for (const line of lines) {
    const lineTotal = computeLineTotal({ quantity: line.quantity, unitPrice: line.unitPrice });
    groups.set(line.tvaRate, (groups.get(line.tvaRate) ?? 0) + lineTotal);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([tvaRate, baseHt]) => ({
      tvaRate,
      baseHt,
      tvaMontant: computeTva({ totalHt: baseHt, tvaRate }),
    }));
}

export function computeDocumentTotals(lines: DocumentLine[]): DocumentTotals {
  const tvaGroups = groupByTva(lines);
  const totalHt = tvaGroups.reduce((sum, g) => sum + g.baseHt, 0);
  const totalTtc = tvaGroups.reduce((sum, g) => sum + g.baseHt + g.tvaMontant, 0);

  return { totalHt, totalTtc, tvaGroups };
}
