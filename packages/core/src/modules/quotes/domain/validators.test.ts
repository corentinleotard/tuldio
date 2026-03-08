import { describe, it, expect } from 'vitest';
import {
  canEditQuote,
  computeQuoteTotals,
  defaultValidUntil,
  validateQuoteLine,
  validateQuoteStatusTransition,
} from './validators.js';

describe('validateQuoteLine', () => {
  const validLine = { description: 'Carrelage', quantity: 10, unit: 'm²', unitPrice: 6200, tvaRate: 2000 };

  it('accepts a valid line', () => {
    expect(validateQuoteLine(validLine)).toEqual([]);
  });

  it('rejects empty description', () => {
    expect(validateQuoteLine({ ...validLine, description: '  ' })).toContain('description is required');
  });

  it('rejects zero quantity', () => {
    expect(validateQuoteLine({ ...validLine, quantity: 0 })).toContain('quantity must be > 0');
  });

  it('rejects negative unit price', () => {
    expect(validateQuoteLine({ ...validLine, unitPrice: -1 })).toContain('unitPrice must be >= 0');
  });

  it('rejects invalid TVA rate', () => {
    expect(validateQuoteLine({ ...validLine, tvaRate: 15 })[0]).toContain('invalid tvaRate');
  });
});

describe('computeQuoteTotals', () => {
  it('computes totals with mixed TVA rates', () => {
    const result = computeQuoteTotals([
      { description: 'Pose', quantity: 10, unit: 'm²', unitPrice: 4500, tvaRate: 1000 },
      { description: 'Fourniture', quantity: 10, unit: 'm²', unitPrice: 3800, tvaRate: 2000 },
    ]);

    expect(result.totalHt).toBe(83000);
    // 45000 * 10% = 4500 + 38000 * 20% = 7600 → total TVA = 12100
    expect(result.totalTtc).toBe(95100);
    expect(result.tvaGroups).toHaveLength(2);
  });

  it('computes totals with 0% TVA (auto-entrepreneur)', () => {
    const result = computeQuoteTotals([
      { description: 'Forfait', quantity: 1, unit: 'forfait', unitPrice: 50000, tvaRate: 0 },
    ]);

    expect(result.totalHt).toBe(50000);
    expect(result.totalTtc).toBe(50000);
  });

  it('handles empty lines', () => {
    const result = computeQuoteTotals([]);
    expect(result.totalHt).toBe(0);
    expect(result.totalTtc).toBe(0);
  });
});

describe('validateQuoteStatusTransition', () => {
  it('allows draft → sent', () => {
    expect(validateQuoteStatusTransition({ from: 'draft', to: 'sent' })).toBe(true);
  });

  it('allows sent → accepted', () => {
    expect(validateQuoteStatusTransition({ from: 'sent', to: 'accepted' })).toBe(true);
  });

  it('allows sent → refused', () => {
    expect(validateQuoteStatusTransition({ from: 'sent', to: 'refused' })).toBe(true);
  });

  it('allows draft → accepted', () => {
    expect(validateQuoteStatusTransition({ from: 'draft', to: 'accepted' })).toBe(true);
  });

  it('allows draft → refused (skip sent)', () => {
    expect(validateQuoteStatusTransition({ from: 'draft', to: 'refused' })).toBe(true);
  });

  it('rejects draft → cancelled (no cancel for quotes)', () => {
    expect(validateQuoteStatusTransition({ from: 'draft', to: 'cancelled' })).toBe(false);
  });

  it('rejects sent → cancelled (no cancel for quotes)', () => {
    expect(validateQuoteStatusTransition({ from: 'sent', to: 'cancelled' })).toBe(false);
  });

  it('rejects accepted → anything (terminal)', () => {
    expect(validateQuoteStatusTransition({ from: 'accepted', to: 'sent' })).toBe(false);
    expect(validateQuoteStatusTransition({ from: 'accepted', to: 'draft' })).toBe(false);
    expect(validateQuoteStatusTransition({ from: 'accepted', to: 'refused' })).toBe(false);
  });

  it('rejects refused → anything (terminal)', () => {
    expect(validateQuoteStatusTransition({ from: 'refused', to: 'draft' })).toBe(false);
    expect(validateQuoteStatusTransition({ from: 'refused', to: 'sent' })).toBe(false);
    expect(validateQuoteStatusTransition({ from: 'refused', to: 'accepted' })).toBe(false);
  });

  it('rejects going backwards (sent → draft)', () => {
    expect(validateQuoteStatusTransition({ from: 'sent', to: 'draft' })).toBe(false);
  });

  it('rejects unknown status', () => {
    expect(validateQuoteStatusTransition({ from: 'unknown', to: 'sent' })).toBe(false);
  });
});

describe('canEditQuote', () => {
  it('allows editing draft without invoices', () => {
    expect(canEditQuote({ status: 'draft', hasLinkedInvoices: false })).toBe(true);
  });

  it('allows editing sent without invoices', () => {
    expect(canEditQuote({ status: 'sent', hasLinkedInvoices: false })).toBe(true);
  });

  it('blocks editing when invoices are linked', () => {
    expect(canEditQuote({ status: 'draft', hasLinkedInvoices: true })).toBe(false);
  });

  it('blocks editing accepted quotes', () => {
    expect(canEditQuote({ status: 'accepted', hasLinkedInvoices: false })).toBe(false);
  });

  it('blocks editing refused quotes', () => {
    expect(canEditQuote({ status: 'refused', hasLinkedInvoices: false })).toBe(false);
  });

  it('blocks editing cancelled quotes', () => {
    expect(canEditQuote({ status: 'cancelled', hasLinkedInvoices: false })).toBe(false);
  });
});

describe('defaultValidUntil', () => {
  it('returns date + 30 days', () => {
    const created = new Date('2026-03-01T12:00:00Z');
    const result = defaultValidUntil(created);
    expect(result.toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('handles month overflow', () => {
    const created = new Date('2026-01-15T12:00:00Z');
    const result = defaultValidUntil(created);
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-14');
  });
});
