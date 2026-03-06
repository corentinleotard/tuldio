import { describe, expect, it } from 'vitest';
import { formatDocumentNumber, isValidUnit } from './document-format.js';

describe('isValidUnit', () => {
  it('accepts valid units', () => {
    expect(isValidUnit('u')).toBe(true);
    expect(isValidUnit('m²')).toBe(true);
    expect(isValidUnit('m')).toBe(true);
    expect(isValidUnit('h')).toBe(true);
    expect(isValidUnit('forfait')).toBe(true);
    expect(isValidUnit('kg')).toBe(true);
    expect(isValidUnit('L')).toBe(true);
    expect(isValidUnit('lot')).toBe(true);
  });

  it('rejects invalid units', () => {
    expect(isValidUnit('pieces')).toBe(false);
    expect(isValidUnit('')).toBe(false);
    expect(isValidUnit('M²')).toBe(false);
  });
});

describe('formatDocumentNumber', () => {
  it('formats quote numbers with D- prefix', () => {
    expect(formatDocumentNumber({ type: 'quote', number: 1 })).toBe('D-0001');
    expect(formatDocumentNumber({ type: 'quote', number: 42 })).toBe('D-0042');
    expect(formatDocumentNumber({ type: 'quote', number: 999 })).toBe('D-0999');
    expect(formatDocumentNumber({ type: 'quote', number: 10000 })).toBe('D-10000');
  });

  it('formats invoice numbers with F- prefix', () => {
    expect(formatDocumentNumber({ type: 'invoice', number: 1 })).toBe('F-0001');
    expect(formatDocumentNumber({ type: 'invoice', number: 123 })).toBe('F-0123');
  });
});
