import { describe, expect, it } from 'vitest';
import { validateDocumentLine } from './document-validators.js';

const validLine = { description: 'Pose carrelage', quantity: 10, unit: 'm²', unitPrice: 4500, tvaRate: 2000 };

describe('validateDocumentLine', () => {
  it('accepts a valid line', () => {
    expect(validateDocumentLine(validLine)).toEqual([]);
  });

  it('accepts zero unitPrice (free line)', () => {
    expect(validateDocumentLine({ ...validLine, unitPrice: 0 })).toEqual([]);
  });

  it('accepts decimal quantity', () => {
    expect(validateDocumentLine({ ...validLine, quantity: 2.5 })).toEqual([]);
  });

  // --- description ---

  it('rejects empty description', () => {
    expect(validateDocumentLine({ ...validLine, description: '' })).toContain('description is required');
  });

  it('rejects whitespace-only description', () => {
    expect(validateDocumentLine({ ...validLine, description: '   ' })).toContain('description is required');
  });

  // --- quantity ---

  it('rejects zero quantity', () => {
    expect(validateDocumentLine({ ...validLine, quantity: 0 })).toContain('quantity must be > 0');
  });

  it('rejects negative quantity', () => {
    expect(validateDocumentLine({ ...validLine, quantity: -5 })).toContain('quantity must be > 0');
  });

  it('rejects NaN quantity', () => {
    expect(validateDocumentLine({ ...validLine, quantity: NaN })).toContain('quantity must be > 0');
  });

  it('rejects Infinity quantity', () => {
    expect(validateDocumentLine({ ...validLine, quantity: Infinity })).toContain('quantity must be > 0');
  });

  // --- unitPrice ---

  it('rejects negative unitPrice', () => {
    expect(validateDocumentLine({ ...validLine, unitPrice: -100 })).toContain('unitPrice must be >= 0');
  });

  it('rejects decimal unitPrice', () => {
    expect(validateDocumentLine({ ...validLine, unitPrice: 45.5 })).toContain('unitPrice must be an integer (cents)');
  });

  it('rejects NaN unitPrice', () => {
    expect(validateDocumentLine({ ...validLine, unitPrice: NaN })).toContain('unitPrice must be >= 0');
  });

  it('rejects Infinity unitPrice', () => {
    expect(validateDocumentLine({ ...validLine, unitPrice: Infinity })).toContain('unitPrice must be >= 0');
  });

  // --- tvaRate ---

  it('rejects invalid tvaRate', () => {
    expect(validateDocumentLine({ ...validLine, tvaRate: 1500 })).toContain('invalid tvaRate: 1500');
  });

  it('rejects decimal tvaRate', () => {
    expect(validateDocumentLine({ ...validLine, tvaRate: 20.5 })).toContain('tvaRate must be an integer (basis points)');
  });

  it('accepts all valid French TVA rates', () => {
    for (const rate of [0, 550, 1000, 2000]) {
      expect(validateDocumentLine({ ...validLine, tvaRate: rate })).toEqual([]);
    }
  });

  // --- multiple errors ---

  it('returns all errors at once', () => {
    const errors = validateDocumentLine({
      description: '',
      quantity: -1,
      unit: 'm²',
      unitPrice: -50.5,
      tvaRate: 9999,
    });
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});
