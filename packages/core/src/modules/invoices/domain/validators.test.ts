import { describe, it, expect } from 'vitest';
import {
  buildAcompteLines,
  buildAcompteLinesByAmount,
  buildAvoirLines,
  buildSoldeLines,
  canEditInvoice,
  computeDueDate,
  computeInvoiceTotals,
  computeRemaining,
  isOverdue,
  validateInvoiceLine,
  validateInvoiceStatusTransition,
} from './validators.js';
import { computeTva } from '../../documents/domain/document-math.js';
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

describe('buildAcompteLines', () => {
  it('builds acompte lines with title — single TVA rate', () => {
    const lines = buildAcompteLines({
      quoteTitle: 'Rénovation SDB',
      percentage: 30,
      tvaGroups: [{ tvaRate: 1000, baseHt: 100000 }],
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]!.description).toBe('Acompte 30% — Rénovation SDB');
    expect(lines[0]!.unitPrice).toBe(30000);
    expect(lines[0]!.quantity).toBe(1);
    expect(lines[0]!.unit).toBe('forfait');
    expect(lines[0]!.tvaRate).toBe(1000);
  });

  it('builds acompte lines without title', () => {
    const lines = buildAcompteLines({
      quoteTitle: null,
      percentage: 50,
      tvaGroups: [{ tvaRate: 2000, baseHt: 50000 }],
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]!.description).toBe('Acompte 50%');
    expect(lines[0]!.unitPrice).toBe(25000);
  });

  it('rounds to nearest cent', () => {
    const lines = buildAcompteLines({
      quoteTitle: null,
      percentage: 30,
      tvaGroups: [{ tvaRate: 1000, baseHt: 33333 }],
    });

    expect(lines[0]!.unitPrice).toBe(10000); // 33333 * 30 / 100 = 9999.9 → 10000
  });

  it('prorates across multiple TVA rates', () => {
    const lines = buildAcompteLines({
      quoteTitle: 'Rénovation',
      percentage: 30,
      tvaGroups: [
        { tvaRate: 550, baseHt: 20000 },   // 200€ HT @5.5%
        { tvaRate: 2000, baseHt: 50000 },   // 500€ HT @20%
      ],
    });

    expect(lines).toHaveLength(2);
    // 30% of 20000 = 6000
    expect(lines[0]!.unitPrice).toBe(6000);
    expect(lines[0]!.tvaRate).toBe(550);
    // 30% of 50000 = 15000
    expect(lines[1]!.unitPrice).toBe(15000);
    expect(lines[1]!.tvaRate).toBe(2000);
    // Total HT = 6000 + 15000 = 21000 = 30% of 70000 ✓
  });
});

describe('buildAcompteLines with remaining base', () => {
  it('computes acompte on remaining balance (single TVA rate)', () => {
    // Quote: 200000 HT (2000€), existing acomptes: 26000 (260€ = 13% of total)
    // Remaining per group: 200000 - 26000 = 174000
    // 13% of remaining: 174000 * 13 / 100 = 22620
    const quoteTotalHt = 200000;
    const existingAcomptesHt = 26000;
    const tvaGroups = [{ tvaRate: 2000, baseHt: 200000 }];

    const baseGroups = tvaGroups.map((g) => ({
      ...g,
      baseHt: g.baseHt - Math.round(existingAcomptesHt * g.baseHt / quoteTotalHt),
    }));

    const lines = buildAcompteLines({
      quoteTitle: null,
      percentage: 13,
      tvaGroups: baseGroups,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]!.unitPrice).toBe(22620); // 13% of 174000
  });

  it('computes acompte on remaining balance (multi TVA rate)', () => {
    // Quote: 50000 @20% + 20000 @5.5% = 70000 HT
    // Existing acompte: 21000 HT (30% of total)
    // Remaining @20%: 50000 - round(21000 * 50000 / 70000) = 50000 - 15000 = 35000
    // Remaining @5.5%: 20000 - round(21000 * 20000 / 70000) = 20000 - 6000 = 14000
    // 30% of remaining @20%: round(35000 * 30 / 100) = 10500
    // 30% of remaining @5.5%: round(14000 * 30 / 100) = 4200
    const quoteTotalHt = 70000;
    const existingAcomptesHt = 21000;
    const tvaGroups = [
      { tvaRate: 2000, baseHt: 50000 },
      { tvaRate: 550, baseHt: 20000 },
    ];

    const baseGroups = tvaGroups.map((g) => ({
      ...g,
      baseHt: g.baseHt - Math.round(existingAcomptesHt * g.baseHt / quoteTotalHt),
    }));

    const lines = buildAcompteLines({
      quoteTitle: 'Rénovation',
      percentage: 30,
      tvaGroups: baseGroups,
    });

    expect(lines).toHaveLength(2);
    expect(lines[0]!.unitPrice).toBe(10500); // 30% of 35000
    expect(lines[0]!.tvaRate).toBe(2000);
    expect(lines[1]!.unitPrice).toBe(4200);  // 30% of 14000
    expect(lines[1]!.tvaRate).toBe(550);
  });

  it('remaining base with no existing acomptes equals total base', () => {
    const quoteTotalHt = 100000;
    const existingAcomptesHt = 0;
    const tvaGroups = [{ tvaRate: 2000, baseHt: 100000 }];

    const baseGroups = tvaGroups.map((g) => ({
      ...g,
      baseHt: g.baseHt - Math.round(existingAcomptesHt * g.baseHt / quoteTotalHt),
    }));

    const linesRemaining = buildAcompteLines({ quoteTitle: null, percentage: 30, tvaGroups: baseGroups });
    const linesTotal = buildAcompteLines({ quoteTitle: null, percentage: 30, tvaGroups });

    expect(linesRemaining[0]!.unitPrice).toBe(linesTotal[0]!.unitPrice);
  });
});

describe('buildAcompteLinesByAmount', () => {
  it('builds acompte lines from fixed TTC amount — single TVA rate', () => {
    // User says "240€ d'acompte" (TTC) on a 1000€ HT @20% quote (1200€ TTC)
    // HT = round(24000 * 10000 / 12000) = 20000
    const lines = buildAcompteLinesByAmount({
      quoteTitle: 'Rénovation SDB',
      amountTtc: 24000,
      tvaGroups: [{ tvaRate: 2000, baseHt: 100000 }],
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]!.description).toBe('Acompte — Rénovation SDB');
    expect(lines[0]!.unitPrice).toBe(20000); // 200€ HT
    expect(lines[0]!.quantity).toBe(1);
    expect(lines[0]!.unit).toBe('forfait');
    expect(lines[0]!.tvaRate).toBe(2000);

    // Recomputed TTC must match input
    const ttc = lines[0]!.unitPrice + computeTva({ totalHt: lines[0]!.unitPrice, tvaRate: lines[0]!.tvaRate });
    expect(ttc).toBe(24000);
  });

  it('prorates across multiple TVA rates', () => {
    // Quote: 50000 @20% (TTC=60000) + 20000 @5.5% (TTC=21100) = 81100 TTC
    // User says "243.30€ d'acompte" (TTC) = 24330 cents → 30% of 81100
    // @20% share: round(24330 * 60000 / 81100) = 18000 TTC → HT = round(18000 * 10000 / 12000) = 15000
    // @5.5% share: 24330 - 18000 = 6330 TTC → HT = round(6330 * 10000 / 10550) = 6000
    const lines = buildAcompteLinesByAmount({
      quoteTitle: null,
      amountTtc: 24330,
      tvaGroups: [
        { tvaRate: 2000, baseHt: 50000 },
        { tvaRate: 550, baseHt: 20000 },
      ],
    });

    expect(lines).toHaveLength(2);
    expect(lines[0]!.unitPrice).toBe(15000);
    expect(lines[0]!.tvaRate).toBe(2000);
    expect(lines[1]!.unitPrice).toBe(6000);
    expect(lines[1]!.tvaRate).toBe(550);

    // Recomputed TTC must match input
    const ttc = lines.reduce((sum, l) => sum + l.unitPrice + computeTva({ totalHt: l.unitPrice, tvaRate: l.tvaRate }), 0);
    expect(ttc).toBe(24330);
  });

  it('last group absorbs rounding remainder (mixed TVA rates)', () => {
    // 3 groups with different TVA rates to stress rounding
    // @20%: 33333 HT → TTC = 33333 + 6667 = 40000
    // @10%: 33333 HT → TTC = 33333 + 3333 = 36666
    // @5.5%: 33333 HT → TTC = 33333 + 1833 = 35166
    // Total TTC = 111832
    // amountTtc = 11000
    const lines = buildAcompteLinesByAmount({
      quoteTitle: null,
      amountTtc: 11000,
      tvaGroups: [
        { tvaRate: 2000, baseHt: 33333 },
        { tvaRate: 1000, baseHt: 33333 },
        { tvaRate: 550, baseHt: 33333 },
      ],
    });

    expect(lines).toHaveLength(3);
    // Recomputed TTC should be within 1 cent of input (rounding écart acceptable)
    const ttc = lines.reduce((sum, l) => sum + l.unitPrice + computeTva({ totalHt: l.unitPrice, tvaRate: l.tvaRate }), 0);
    expect(Math.abs(ttc - 11000)).toBeLessThanOrEqual(1);
  });

  it('returns empty array when quote has no lines', () => {
    const lines = buildAcompteLinesByAmount({
      quoteTitle: null,
      amountTtc: 20000,
      tvaGroups: [],
    });
    expect(lines).toEqual([]);
  });

  it('builds label without title', () => {
    const lines = buildAcompteLinesByAmount({
      quoteTitle: null,
      amountTtc: 6000,
      tvaGroups: [{ tvaRate: 2000, baseHt: 100000 }],
    });
    expect(lines[0]!.description).toBe('Acompte');
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

  it('adds negative deduction line per acompte line', () => {
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

  it('creates deduction lines per TVA rate for multi-rate acompte', () => {
    const mixedQuoteLines = [
      { description: 'Pose', quantity: 10, unit: 'm²', unit_price: 5000, tva_rate: 2000, total_ht: 50000, prestation_id: null },
      { description: 'Fourniture', quantity: 2, unit: 'm²', unit_price: 10000, tva_rate: 550, total_ht: 20000, prestation_id: null },
    ];

    const acompteInvoices = [{
      number: 'FAC-2026-0001',
      total_ht: 21000, // 30% of 70000
      lines: [
        { id: 'l1', invoice_id: 'i1', prestation_id: null, sort_order: 1, description: 'Acompte 30%', quantity: 1, unit: 'forfait', unit_price: 15000, tva_rate: 2000, total_ht: 15000 },
        { id: 'l2', invoice_id: 'i1', prestation_id: null, sort_order: 2, description: 'Acompte 30%', quantity: 1, unit: 'forfait', unit_price: 6000, tva_rate: 550, total_ht: 6000 },
      ] as InvoiceLineRow[],
    }];

    const lines = buildSoldeLines({ quoteLines: mixedQuoteLines, acompteInvoices });

    expect(lines).toHaveLength(4); // 2 quote + 2 deductions (one per TVA rate)
    // Deduction @20%
    expect(lines[2]!.unitPrice).toBe(-15000);
    expect(lines[2]!.tvaRate).toBe(2000);
    // Deduction @5.5%
    expect(lines[3]!.unitPrice).toBe(-6000);
    expect(lines[3]!.tvaRate).toBe(550);

    // Remaining HT = 70000 - 21000 = 49000
    const totalHt = lines.reduce((sum, l) => sum + l.totalHt, 0);
    expect(totalHt).toBe(49000);
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
