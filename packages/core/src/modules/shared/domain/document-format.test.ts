import { describe, expect, it } from 'vitest';
import { formatDocumentNumber } from './document-format.js';

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
