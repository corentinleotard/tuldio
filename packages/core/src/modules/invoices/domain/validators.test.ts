import { describe, it, expect } from 'vitest';
import {
  buildAcompteLine,
  canCancelInvoice,
  canEditInvoice,
  canMarkAsPaid,
  computeInvoiceTotals,
  computeRemaining,
  isOverdue,
  validateInvoiceLine,
  validateInvoiceStatusTransition,
} from './validators.js';

describe('validateInvoiceLine', () => {
  const validLine = { description: 'Pose carrelage', quantity: 10, unit: 'm²', unitPrice: 4500, tvaRate: 1000 };

  it('accepts a valid line', () => {
    expect(validateInvoiceLine(validLine)).toEqual([]);
  });

  it('rejects empty description', () => {
    expect(validateInvoiceLine({ ...validLine, description: '' })).toContain('description is required');
  });

  it('rejects invalid unit', () => {
    expect(validateInvoiceLine({ ...validLine, unit: 'invalid' })[0]).toContain('invalid unit');
  });
});

describe('computeInvoiceTotals', () => {
  it('computes totals with single TVA rate', () => {
    const result = computeInvoiceTotals([
      { description: 'Pose carrelage', quantity: 45, unit: 'm²', unitPrice: 6200, tvaRate: 2000 },
    ]);

    expect(result.totalHt).toBe(279000);
    expect(result.totalTtc).toBe(334800);
  });

  it('handles 5.5% TVA', () => {
    const result = computeInvoiceTotals([
      { description: 'Isolation', quantity: 1, unit: 'forfait', unitPrice: 10000, tvaRate: 550 },
    ]);

    expect(result.totalTtc).toBe(10550);
  });
});

describe('validateInvoiceStatusTransition', () => {
  it('allows draft → sent', () => {
    expect(validateInvoiceStatusTransition({ from: 'draft', to: 'sent' })).toBe(true);
  });

  it('allows sent → paid', () => {
    expect(validateInvoiceStatusTransition({ from: 'sent', to: 'paid' })).toBe(true);
  });

  it('allows sent → overdue', () => {
    expect(validateInvoiceStatusTransition({ from: 'sent', to: 'overdue' })).toBe(true);
  });

  it('allows overdue → paid', () => {
    expect(validateInvoiceStatusTransition({ from: 'overdue', to: 'paid' })).toBe(true);
  });

  it('allows sent → cancelled', () => {
    expect(validateInvoiceStatusTransition({ from: 'sent', to: 'cancelled' })).toBe(true);
  });

  it('rejects paid → anything', () => {
    expect(validateInvoiceStatusTransition({ from: 'paid', to: 'sent' })).toBe(false);
    expect(validateInvoiceStatusTransition({ from: 'paid', to: 'cancelled' })).toBe(false);
  });
});

describe('canEditInvoice', () => {
  it('allows editing draft invoices', () => {
    expect(canEditInvoice('draft')).toBe(true);
  });

  it('blocks editing sent invoices', () => {
    expect(canEditInvoice('sent')).toBe(false);
  });

  it('blocks editing paid invoices', () => {
    expect(canEditInvoice('paid')).toBe(false);
  });

  it('blocks editing overdue invoices', () => {
    expect(canEditInvoice('overdue')).toBe(false);
  });

  it('blocks editing cancelled invoices', () => {
    expect(canEditInvoice('cancelled')).toBe(false);
  });
});

describe('canMarkAsPaid', () => {
  it('allows sent → paid', () => expect(canMarkAsPaid('sent')).toBe(true));
  it('allows overdue → paid', () => expect(canMarkAsPaid('overdue')).toBe(true));
  it('rejects draft', () => expect(canMarkAsPaid('draft')).toBe(false));
  it('rejects already paid', () => expect(canMarkAsPaid('paid')).toBe(false));
  it('rejects cancelled', () => expect(canMarkAsPaid('cancelled')).toBe(false));
});

describe('canCancelInvoice', () => {
  it('allows draft', () => expect(canCancelInvoice('draft')).toBe(true));
  it('allows sent', () => expect(canCancelInvoice('sent')).toBe(true));
  it('allows overdue', () => expect(canCancelInvoice('overdue')).toBe(true));
  it('rejects paid', () => expect(canCancelInvoice('paid')).toBe(false));
  it('rejects already cancelled', () => expect(canCancelInvoice('cancelled')).toBe(false));
});

describe('isOverdue', () => {
  it('returns true when past due date and sent', () => {
    expect(isOverdue({
      dueDate: new Date('2026-03-01'),
      status: 'sent',
      now: new Date('2026-03-02'),
    })).toBe(true);
  });

  it('returns false when not yet due', () => {
    expect(isOverdue({
      dueDate: new Date('2026-03-10'),
      status: 'sent',
      now: new Date('2026-03-02'),
    })).toBe(false);
  });

  it('returns false when no due date', () => {
    expect(isOverdue({ dueDate: null, status: 'sent', now: new Date() })).toBe(false);
  });

  it('returns false when not sent', () => {
    expect(isOverdue({
      dueDate: new Date('2026-03-01'),
      status: 'paid',
      now: new Date('2026-03-02'),
    })).toBe(false);
  });
});

describe('buildAcompteLine', () => {
  it('builds an acompte line with title', () => {
    const line = buildAcompteLine({
      quoteTitle: 'Rénovation SDB',
      quoteTotalHt: 100000,
      percentage: 30,
      tvaRate: 1000,
    });

    expect(line.description).toBe('Acompte 30% — Rénovation SDB');
    expect(line.unitPrice).toBe(30000);
    expect(line.quantity).toBe(1);
    expect(line.unit).toBe('forfait');
    expect(line.tvaRate).toBe(1000);
  });

  it('builds an acompte line without title', () => {
    const line = buildAcompteLine({
      quoteTitle: null,
      quoteTotalHt: 50000,
      percentage: 50,
      tvaRate: 2000,
    });

    expect(line.description).toBe('Acompte 50%');
    expect(line.unitPrice).toBe(25000);
  });

  it('rounds to nearest cent', () => {
    const line = buildAcompteLine({
      quoteTitle: null,
      quoteTotalHt: 33333,
      percentage: 30,
      tvaRate: 1000,
    });

    expect(line.unitPrice).toBe(10000); // 33333 * 30 / 100 = 9999.9 → 10000
  });
});

describe('computeRemaining', () => {
  it('computes remaining amount', () => {
    expect(computeRemaining({ quoteTotalHt: 100000, invoicedTotalHt: 30000 })).toBe(70000);
  });

  it('returns 0 when fully invoiced', () => {
    expect(computeRemaining({ quoteTotalHt: 100000, invoicedTotalHt: 100000 })).toBe(0);
  });

  it('returns negative when over-invoiced (extra work)', () => {
    expect(computeRemaining({ quoteTotalHt: 100000, invoicedTotalHt: 120000 })).toBe(-20000);
  });
});
