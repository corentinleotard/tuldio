import { describe, it, expect } from 'vitest';
import type { TeamField } from '@tuldio/types';
import { getField, getCustomFields, getVisibleFields, renderLegalMentions } from './shared.js';

function makeField(overrides: Partial<TeamField> & { key: string; value: string }): TeamField {
  return {
    id: 'test-id',
    label: overrides.key,
    zone: 'identity' as const,
    scope: 'both' as const,
    showQuote: true,
    showInvoice: true,
    isSystem: true,
    sortOrder: 0,
    ...overrides,
  };
}

describe('getField', () => {
  const fields: TeamField[] = [
    makeField({ key: 'siret', value: '12345678901234' }),
    makeField({ key: 'hidden_on_quote', value: 'secret', showQuote: false }),
    makeField({ key: 'hidden_on_invoice', value: 'secret', showInvoice: false }),
  ];

  it('returns value for matching key', () => {
    expect(getField(fields, 'siret')).toBe('12345678901234');
  });

  it('returns empty string for non-existent key', () => {
    expect(getField(fields, 'nonexistent')).toBe('');
  });

  it('returns empty string when showQuote=false and docType=quote', () => {
    expect(getField(fields, 'hidden_on_quote', 'quote')).toBe('');
  });

  it('returns empty string when showInvoice=false and docType=invoice', () => {
    expect(getField(fields, 'hidden_on_invoice', 'invoice')).toBe('');
  });

  it('returns value when showQuote=true and docType=quote', () => {
    expect(getField(fields, 'siret', 'quote')).toBe('12345678901234');
  });

  it('returns value regardless of visibility when docType is undefined', () => {
    expect(getField(fields, 'hidden_on_quote')).toBe('secret');
    expect(getField(fields, 'hidden_on_invoice')).toBe('secret');
  });
});

describe('getCustomFields', () => {
  const fields: TeamField[] = [
    makeField({ key: 'system_field', value: 'sys', zone: 'identity', isSystem: true }),
    makeField({ key: 'custom_1', value: 'val1', zone: 'identity', isSystem: false }),
    makeField({ key: 'custom_2', value: '', zone: 'identity', isSystem: false }),
    makeField({ key: 'custom_3', value: 'val3', zone: 'payment', isSystem: false }),
    makeField({ key: 'custom_hidden', value: 'val4', zone: 'identity', isSystem: false, showQuote: false }),
  ];

  it('returns only non-system fields for given zone and docType', () => {
    const result = getCustomFields(fields, 'identity', 'invoice');
    expect(result.map((f) => f.key)).toEqual(['custom_1', 'custom_hidden']);
  });

  it('filters out fields with empty value', () => {
    const result = getCustomFields(fields, 'identity', 'invoice');
    expect(result.find((f) => f.key === 'custom_2')).toBeUndefined();
  });

  it('respects showQuote/showInvoice visibility', () => {
    // custom_hidden has showQuote=false, showInvoice=true
    const quoteResult = getCustomFields(fields, 'identity', 'quote');
    expect(quoteResult.find((f) => f.key === 'custom_hidden')).toBeUndefined();

    // Should be included for invoice since showInvoice=true
    const invoiceResult = getCustomFields(fields, 'identity', 'invoice');
    expect(invoiceResult.find((f) => f.key === 'custom_hidden')).toBeDefined();
  });
});

describe('getVisibleFields', () => {
  const fields: TeamField[] = [
    makeField({ key: 'visible', value: 'yes', zone: 'payment' }),
    makeField({ key: 'empty', value: '', zone: 'payment' }),
    makeField({ key: 'hidden_quote', value: 'yes', zone: 'payment', showQuote: false }),
    makeField({ key: 'other_zone', value: 'yes', zone: 'identity' }),
  ];

  it('returns visible fields for zone and docType', () => {
    const result = getVisibleFields(fields, 'payment', 'invoice');
    expect(result.map((f) => f.key)).toEqual(['visible', 'hidden_quote']);
  });

  it('filters out empty-value fields', () => {
    const result = getVisibleFields(fields, 'payment', 'invoice');
    expect(result.find((f) => f.key === 'empty')).toBeUndefined();
  });

  it('respects visibility for docType=quote', () => {
    const result = getVisibleFields(fields, 'payment', 'quote');
    expect(result.map((f) => f.key)).toEqual(['visible']);
  });
});

describe('renderLegalMentions', () => {
  it('includes invoice-scoped legal fields for docType=invoice', () => {
    const fields: TeamField[] = [
      makeField({ key: 'early_payment_discount', value: 'Pas d\'escompte', zone: 'legal', showQuote: false, showInvoice: true }),
      makeField({ key: 'late_penalty_rate', value: 'Taux de penalite: 3x taux legal', zone: 'legal', showQuote: false, showInvoice: true }),
      makeField({ key: 'recovery_fee', value: 'Indemnité forfaitaire de recouvrement : 40,00 €', zone: 'legal', showQuote: false, showInvoice: true }),
    ];

    const result = renderLegalMentions(fields, 'invoice');
    expect(result).toContain('Pas d\'escompte');
    expect(result).toContain('Taux de penalite: 3x taux legal');
    expect(result).toContain('Indemnité forfaitaire de recouvrement : 40,00 €');
  });

  it('excludes invoice-scoped fields for docType=quote when showQuote=false', () => {
    const fields: TeamField[] = [
      makeField({ key: 'early_payment_discount', value: 'Pas d\'escompte', zone: 'legal', showQuote: false, showInvoice: true }),
      makeField({ key: 'late_penalty_rate', value: 'Taux de penalite: 3x taux legal', zone: 'legal', showQuote: false, showInvoice: true }),
      makeField({ key: 'recovery_fee', value: 'Indemnité forfaitaire de recouvrement : 40,00 €', zone: 'legal', showQuote: false, showInvoice: true }),
    ];

    const result = renderLegalMentions(fields, 'quote');
    expect(result).not.toContain('escompte');
    expect(result).not.toContain('penalite');
    expect(result).not.toContain('recouvrement');
  });
});
