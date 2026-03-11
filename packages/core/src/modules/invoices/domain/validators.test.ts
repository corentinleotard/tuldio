import { describe, it, expect } from 'vitest';
import {
  buildAcompteLine,
  buildAvoirLines,
  buildSoldeLines,
  canCancelInvoice,
  canEditInvoice,
  computeDueDate,
  computeInvoiceTotals,
  computeRemaining,
  isOverdue,
  validateInvoiceLine,
  validateInvoiceStatusTransition,
} from './validators.js';
import type { InvoiceLineRow } from './invoice.entity.js';

describe('validateInvoiceLine', () => {
  const validLine = { description: 'Pose carrelage', quantity: 10, unit: 'm²', unitPrice: 4500, tvaRate: 1000 };

  it('accepts a valid line', () => {
    expect(validateInvoiceLine(validLine)).toEqual([]);
  });

  it('rejects empty description', () => {
    expect(validateInvoiceLine({ ...validLine, description: '' })).toContain('description is required');
  });

  it('accepts any unit string (validation happens in resolveUnit)', () => {
    expect(validateInvoiceLine({ ...validLine, unit: 'invalid' })).toEqual([]);
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

  it('allows draft → paid (skip sent)', () => {
    expect(validateInvoiceStatusTransition({ from: 'draft', to: 'paid' })).toBe(true);
  });

  it('allows draft → cancelled', () => {
    expect(validateInvoiceStatusTransition({ from: 'draft', to: 'cancelled' })).toBe(true);
  });

  it('allows sent → cancelled', () => {
    expect(validateInvoiceStatusTransition({ from: 'sent', to: 'cancelled' })).toBe(true);
  });

  it('allows paid → cancelled (avoir flow)', () => {
    expect(validateInvoiceStatusTransition({ from: 'paid', to: 'cancelled' })).toBe(true);
  });

  it('rejects paid → other statuses', () => {
    expect(validateInvoiceStatusTransition({ from: 'paid', to: 'sent' })).toBe(false);
    expect(validateInvoiceStatusTransition({ from: 'paid', to: 'draft' })).toBe(false);
  });

  it('rejects going backwards (sent → draft)', () => {
    expect(validateInvoiceStatusTransition({ from: 'sent', to: 'draft' })).toBe(false);
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

describe('canCancelInvoice', () => {
  it('allows draft', () => expect(canCancelInvoice('draft')).toBe(true));
  it('allows sent', () => expect(canCancelInvoice('sent')).toBe(true));
  it('allows overdue', () => expect(canCancelInvoice('overdue')).toBe(true));
  it('rejects paid', () => expect(canCancelInvoice('paid')).toBe(false));
  it('rejects already cancelled', () => expect(canCancelInvoice('cancelled')).toBe(false));
});

describe('computeDueDate', () => {
  it('adds delay days to createdAt', () => {
    const createdAt = new Date(2026, 2, 10); // March 10
    const result = computeDueDate({ createdAt, delayDays: 30 });
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(9);
  });

  it('handles month boundary', () => {
    const createdAt = new Date(2026, 0, 31); // Jan 31
    const result = computeDueDate({ createdAt, delayDays: 30 });
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(2);
  });

  it('handles 1 day delay', () => {
    const createdAt = new Date(2026, 2, 10); // March 10
    const result = computeDueDate({ createdAt, delayDays: 1 });
    expect(result.getDate()).toBe(11);
  });
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

describe('avoir status transitions', () => {
  it('allows avoir draft → sent', () => {
    expect(validateInvoiceStatusTransition({ from: 'draft', to: 'sent', invoiceType: 'avoir' })).toBe(true);
  });

  it('rejects avoir draft → paid', () => {
    expect(validateInvoiceStatusTransition({ from: 'draft', to: 'paid', invoiceType: 'avoir' })).toBe(false);
  });

  it('rejects avoir draft → cancelled', () => {
    expect(validateInvoiceStatusTransition({ from: 'draft', to: 'cancelled', invoiceType: 'avoir' })).toBe(false);
  });

  it('rejects avoir sent → paid', () => {
    expect(validateInvoiceStatusTransition({ from: 'sent', to: 'paid', invoiceType: 'avoir' })).toBe(false);
  });

  it('rejects avoir sent → cancelled', () => {
    expect(validateInvoiceStatusTransition({ from: 'sent', to: 'cancelled', invoiceType: 'avoir' })).toBe(false);
  });

  it('standard transitions unchanged when invoiceType is standard', () => {
    expect(validateInvoiceStatusTransition({ from: 'draft', to: 'paid', invoiceType: 'standard' })).toBe(true);
    expect(validateInvoiceStatusTransition({ from: 'sent', to: 'cancelled', invoiceType: 'standard' })).toBe(true);
  });

  it('standard transitions used when invoiceType is omitted', () => {
    expect(validateInvoiceStatusTransition({ from: 'draft', to: 'paid' })).toBe(true);
  });
});

describe('buildAvoirLines', () => {
  const makeLineRow = (overrides: Partial<InvoiceLineRow> = {}): InvoiceLineRow => ({
    id: 'line-1',
    invoice_id: 'inv-1',
    prestation_id: null,
    sort_order: 1,
    description: 'Pose carrelage',
    quantity: 10,
    unit: 'm²',
    unit_price: 6200,
    tva_rate: 2000,
    total_ht: 62000,
    ...overrides,
  });

  it('negates all line amounts', () => {
    const lines = buildAvoirLines([makeLineRow()]);

    expect(lines).toHaveLength(1);
    expect(lines[0]!.unitPrice).toBe(-6200);
    expect(lines[0]!.totalHt).toBe(-62000);
  });

  it('preserves description, quantity, unit, tvaRate', () => {
    const lines = buildAvoirLines([makeLineRow()]);

    expect(lines[0]!.description).toBe('Pose carrelage');
    expect(lines[0]!.quantity).toBe(10);
    expect(lines[0]!.unit).toBe('m²');
    expect(lines[0]!.tvaRate).toBe(2000);
  });

  it('preserves prestationId', () => {
    const lines = buildAvoirLines([makeLineRow({ prestation_id: 'prest-1' })]);
    expect(lines[0]!.prestationId).toBe('prest-1');
  });

  it('handles multiple lines', () => {
    const lines = buildAvoirLines([
      makeLineRow({ unit_price: 5000, total_ht: 50000 }),
      makeLineRow({ id: 'line-2', description: 'Joints', unit_price: 1500, total_ht: 15000 }),
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0]!.unitPrice).toBe(-5000);
    expect(lines[1]!.unitPrice).toBe(-1500);
    expect(lines[0]!.totalHt).toBe(-50000);
    expect(lines[1]!.totalHt).toBe(-15000);
  });

  it('returns empty array for empty source', () => {
    expect(buildAvoirLines([])).toEqual([]);
  });
});

describe('buildSoldeLines', () => {
  const quoteLines = [
    { description: 'Pose carrelage', quantity: 10, unit: 'm²', unit_price: 6200, tva_rate: 2000, total_ht: 62000, prestation_id: null },
    { description: 'Joints', quantity: 1, unit: 'forfait', unit_price: 8000, tva_rate: 2000, total_ht: 8000, prestation_id: null },
  ];

  it('returns quote lines only when no acomptes', () => {
    const lines = buildSoldeLines({ quoteLines, acompteInvoices: [] });

    expect(lines).toHaveLength(2);
    expect(lines[0]!.unitPrice).toBe(6200);
    expect(lines[1]!.unitPrice).toBe(8000);
  });

  it('adds negative deduction line per acompte', () => {
    const acompteInvoices = [{
      number: 'FAC-2026-0001',
      total_ht: 21000, // 30% of 70000
      lines: [{ id: 'l1', invoice_id: 'i1', prestation_id: null, sort_order: 1, description: 'Acompte 30%', quantity: 1, unit: 'forfait', unit_price: 21000, tva_rate: 2000, total_ht: 21000 }] as InvoiceLineRow[],
    }];

    const lines = buildSoldeLines({ quoteLines, acompteInvoices });

    expect(lines).toHaveLength(3); // 2 quote lines + 1 deduction
    expect(lines[2]!.description).toBe('Déduction acompte FAC-2026-0001');
    expect(lines[2]!.unitPrice).toBe(-21000);
    expect(lines[2]!.totalHt).toBe(-21000);
    expect(lines[2]!.quantity).toBe(1);
    expect(lines[2]!.unit).toBe('forfait');
    expect(lines[2]!.tvaRate).toBe(2000);
  });

  it('handles multiple acomptes', () => {
    const acompteInvoices = [
      {
        number: 'FAC-2026-0001',
        total_ht: 21000,
        lines: [{ id: 'l1', invoice_id: 'i1', prestation_id: null, sort_order: 1, description: 'Acompte 30%', quantity: 1, unit: 'forfait', unit_price: 21000, tva_rate: 2000, total_ht: 21000 }] as InvoiceLineRow[],
      },
      {
        number: 'FAC-2026-0002',
        total_ht: 14000,
        lines: [{ id: 'l2', invoice_id: 'i2', prestation_id: null, sort_order: 1, description: 'Acompte 20%', quantity: 1, unit: 'forfait', unit_price: 14000, tva_rate: 2000, total_ht: 14000 }] as InvoiceLineRow[],
      },
    ];

    const lines = buildSoldeLines({ quoteLines, acompteInvoices });

    expect(lines).toHaveLength(4); // 2 quote + 2 deductions
    expect(lines[2]!.unitPrice).toBe(-21000);
    expect(lines[3]!.unitPrice).toBe(-14000);
  });

  it('solde totals equal remaining after acompte deductions', () => {
    const acompteInvoices = [{
      number: 'FAC-2026-0001',
      total_ht: 21000,
      lines: [{ id: 'l1', invoice_id: 'i1', prestation_id: null, sort_order: 1, description: 'Acompte', quantity: 1, unit: 'forfait', unit_price: 21000, tva_rate: 2000, total_ht: 21000 }] as InvoiceLineRow[],
    }];

    const lines = buildSoldeLines({ quoteLines, acompteInvoices });
    const totalHt = lines.reduce((sum, l) => sum + l.totalHt, 0);

    // Quote total = 62000 + 8000 = 70000, acompte = 21000, remaining = 49000
    expect(totalHt).toBe(49000);
  });
});
