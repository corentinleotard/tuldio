import { describe, expect, it } from 'vitest';
import {
  computeDocumentTotals,
  computeLineTotal,
  computeTva,
  groupByTva,
  isValidTvaRate,
  resolveTvaRate,
} from './document-math.js';

describe('isValidTvaRate', () => {
  it('accepts valid French TVA rates', () => {
    expect(isValidTvaRate(0)).toBe(true);
    expect(isValidTvaRate(550)).toBe(true);
    expect(isValidTvaRate(1000)).toBe(true);
    expect(isValidTvaRate(2000)).toBe(true);
  });

  it('rejects invalid rates', () => {
    expect(isValidTvaRate(20)).toBe(false);
    expect(isValidTvaRate(10)).toBe(false);
    expect(isValidTvaRate(1500)).toBe(false);
    expect(isValidTvaRate(-100)).toBe(false);
  });
});

describe('computeLineTotal', () => {
  it('computes integer quantity * unit price', () => {
    expect(computeLineTotal({ quantity: 12, unitPrice: 4500 })).toBe(54000);
  });

  it('computes decimal quantity', () => {
    expect(computeLineTotal({ quantity: 2.5, unitPrice: 4000 })).toBe(10000);
  });

  it('rounds to nearest cent', () => {
    // 3 * 3333 = 9999 (exact)
    expect(computeLineTotal({ quantity: 3, unitPrice: 3333 })).toBe(9999);
    // 1.5 * 3333 = 4999.5 → 5000
    expect(computeLineTotal({ quantity: 1.5, unitPrice: 3333 })).toBe(5000);
  });

  it('handles zero quantity', () => {
    expect(computeLineTotal({ quantity: 0, unitPrice: 4500 })).toBe(0);
  });
});

describe('computeTva', () => {
  it('computes 20% TVA', () => {
    expect(computeTva({ totalHt: 54000, tvaRate: 2000 })).toBe(10800);
  });

  it('computes 10% TVA', () => {
    expect(computeTva({ totalHt: 54000, tvaRate: 1000 })).toBe(5400);
  });

  it('computes 5.5% TVA', () => {
    expect(computeTva({ totalHt: 10000, tvaRate: 550 })).toBe(550);
  });

  it('computes 0% TVA', () => {
    expect(computeTva({ totalHt: 54000, tvaRate: 0 })).toBe(0);
  });

  it('rounds to nearest cent', () => {
    // 5555 * 550/10000 = 305.525 → 306
    expect(computeTva({ totalHt: 5555, tvaRate: 550 })).toBe(306);
  });
});

describe('groupByTva', () => {
  it('groups lines by TVA rate', () => {
    const lines = [
      { quantity: 12, unitPrice: 4500, tvaRate: 1000 }, // 54000 HT
      { quantity: 12, unitPrice: 3800, tvaRate: 2000 }, // 45600 HT
      { quantity: 5, unitPrice: 2000, tvaRate: 1000 },  // 10000 HT
    ];

    const groups = groupByTva(lines);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({ tvaRate: 1000, baseHt: 64000, tvaMontant: 6400 });
    expect(groups[1]).toEqual({ tvaRate: 2000, baseHt: 45600, tvaMontant: 9120 });
  });

  it('handles single TVA rate', () => {
    const lines = [
      { quantity: 10, unitPrice: 1000, tvaRate: 2000 },
      { quantity: 5, unitPrice: 2000, tvaRate: 2000 },
    ];

    const groups = groupByTva(lines);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual({ tvaRate: 2000, baseHt: 20000, tvaMontant: 4000 });
  });

  it('returns empty array for no lines', () => {
    expect(groupByTva([])).toEqual([]);
  });
});

describe('resolveTvaRate', () => {
  it('returns 0 when team is TVA exempt', () => {
    expect(resolveTvaRate({ requestedRate: 2000, tvaExempt: true })).toBe(0);
  });

  it('returns 0 for any rate when exempt', () => {
    expect(resolveTvaRate({ requestedRate: 550, tvaExempt: true })).toBe(0);
    expect(resolveTvaRate({ requestedRate: 1000, tvaExempt: true })).toBe(0);
    expect(resolveTvaRate({ requestedRate: 0, tvaExempt: true })).toBe(0);
  });

  it('returns requested rate when not exempt', () => {
    expect(resolveTvaRate({ requestedRate: 2000, tvaExempt: false })).toBe(2000);
    expect(resolveTvaRate({ requestedRate: 550, tvaExempt: false })).toBe(550);
    expect(resolveTvaRate({ requestedRate: 0, tvaExempt: false })).toBe(0);
  });
});

describe('computeDocumentTotals', () => {
  it('computes totals with mixed TVA rates', () => {
    const lines = [
      { quantity: 12, unitPrice: 4500, tvaRate: 1000 }, // 54000 HT, 5400 TVA
      { quantity: 12, unitPrice: 3800, tvaRate: 2000 }, // 45600 HT, 9120 TVA
    ];

    const totals = computeDocumentTotals(lines);
    expect(totals.totalHt).toBe(99600);
    expect(totals.totalTtc).toBe(99600 + 5400 + 9120); // 114120
    expect(totals.tvaGroups).toHaveLength(2);
  });

  it('computes totals for auto-entrepreneur (0% TVA)', () => {
    const lines = [
      { quantity: 1, unitPrice: 50000, tvaRate: 0 },
      { quantity: 3, unitPrice: 10000, tvaRate: 0 },
    ];

    const totals = computeDocumentTotals(lines);
    expect(totals.totalHt).toBe(80000);
    expect(totals.totalTtc).toBe(80000); // no TVA
  });

  it('handles empty lines', () => {
    const totals = computeDocumentTotals([]);
    expect(totals.totalHt).toBe(0);
    expect(totals.totalTtc).toBe(0);
    expect(totals.tvaGroups).toEqual([]);
  });
});
