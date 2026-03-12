import { describe, it, expect } from 'vitest';
import {
  canEditQuote,
  canInvoiceQuote,
  shouldAutoAcceptQuote,
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

  it('rejects draft → cancelled (no cancel for drafts)', () => {
    expect(validateQuoteStatusTransition({ from: 'draft', to: 'cancelled' })).toBe(false);
  });

  it('allows sent → cancelled', () => {
    expect(validateQuoteStatusTransition({ from: 'sent', to: 'cancelled' })).toBe(true);
  });

  it('rejects accepted → anything (terminal)', () => {
    expect(validateQuoteStatusTransition({ from: 'accepted', to: 'sent' })).toBe(false);
    expect(validateQuoteStatusTransition({ from: 'accepted', to: 'draft' })).toBe(false);
    expect(validateQuoteStatusTransition({ from: 'accepted', to: 'refused' })).toBe(false);
    expect(validateQuoteStatusTransition({ from: 'accepted', to: 'cancelled' })).toBe(false);
  });

  it('rejects refused → anything (terminal)', () => {
    expect(validateQuoteStatusTransition({ from: 'refused', to: 'draft' })).toBe(false);
    expect(validateQuoteStatusTransition({ from: 'refused', to: 'sent' })).toBe(false);
    expect(validateQuoteStatusTransition({ from: 'refused', to: 'accepted' })).toBe(false);
    expect(validateQuoteStatusTransition({ from: 'refused', to: 'cancelled' })).toBe(false);
  });

  it('rejects cancelled → anything (terminal)', () => {
    expect(validateQuoteStatusTransition({ from: 'cancelled', to: 'draft' })).toBe(false);
    expect(validateQuoteStatusTransition({ from: 'cancelled', to: 'sent' })).toBe(false);
    expect(validateQuoteStatusTransition({ from: 'cancelled', to: 'accepted' })).toBe(false);
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

  it('blocks editing sent quotes', () => {
    expect(canEditQuote({ status: 'sent', hasLinkedInvoices: false })).toBe(false);
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

describe('canInvoiceQuote', () => {
  it('allows invoicing draft quotes', () => {
    expect(canInvoiceQuote('draft')).toBe(true);
  });

  it('allows invoicing sent quotes', () => {
    expect(canInvoiceQuote('sent')).toBe(true);
  });

  it('allows invoicing accepted quotes', () => {
    expect(canInvoiceQuote('accepted')).toBe(true);
  });

  it('blocks invoicing refused quotes', () => {
    expect(canInvoiceQuote('refused')).toBe(false);
  });

  it('blocks invoicing cancelled quotes', () => {
    expect(canInvoiceQuote('cancelled')).toBe(false);
  });
});

describe('shouldAutoAcceptQuote', () => {
  it('returns true for draft', () => {
    expect(shouldAutoAcceptQuote('draft')).toBe(true);
  });

  it('returns true for sent', () => {
    expect(shouldAutoAcceptQuote('sent')).toBe(true);
  });

  it('returns false for accepted', () => {
    expect(shouldAutoAcceptQuote('accepted')).toBe(false);
  });

  it('returns false for refused', () => {
    expect(shouldAutoAcceptQuote('refused')).toBe(false);
  });

  it('returns false for cancelled', () => {
    expect(shouldAutoAcceptQuote('cancelled')).toBe(false);
  });
});

describe('defaultValidUntil', () => {
  it('returns date + 30 days by default', () => {
    const created = new Date('2026-03-01T12:00:00Z');
    const result = defaultValidUntil({ createdAt: created, days: 30 });
    expect(result.toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('handles month overflow', () => {
    const created = new Date('2026-01-15T12:00:00Z');
    const result = defaultValidUntil({ createdAt: created, days: 30 });
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-14');
  });

  it('supports custom validity days', () => {
    const created = new Date('2026-03-01T12:00:00Z');
    const result = defaultValidUntil({ createdAt: created, days: 15 });
    expect(result.toISOString().slice(0, 10)).toBe('2026-03-16');
  });

  it('supports 60 days validity', () => {
    const created = new Date('2026-03-01T12:00:00Z');
    const result = defaultValidUntil({ createdAt: created, days: 60 });
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-30');
  });
});
