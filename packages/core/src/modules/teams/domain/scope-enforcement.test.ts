import { describe, it, expect } from 'vitest';

/**
 * Replicates the scope enforcement logic from update-team-field use-case.
 *
 * Rules:
 * - scope='quote'   -> showInvoice is always forced to false
 * - scope='invoice'  -> showQuote is always forced to false
 * - scope='both'     -> both toggles are free to change
 */
function enforceScope(input: {
  scope: 'both' | 'quote' | 'invoice';
  showQuote: boolean;
  showInvoice: boolean;
}): { showQuote: boolean; showInvoice: boolean } {
  const { scope } = input;
  let { showQuote, showInvoice } = input;

  if (scope === 'quote') {
    showInvoice = false;
  } else if (scope === 'invoice') {
    showQuote = false;
  }

  return { showQuote, showInvoice };
}

describe('scope enforcement', () => {
  it('scope=quote forces showInvoice to false even if requested true', () => {
    const result = enforceScope({ scope: 'quote', showQuote: true, showInvoice: true });
    expect(result).toEqual({ showQuote: true, showInvoice: false });
  });

  it('scope=invoice forces showQuote to false even if requested true', () => {
    const result = enforceScope({ scope: 'invoice', showQuote: true, showInvoice: true });
    expect(result).toEqual({ showQuote: false, showInvoice: true });
  });

  it('scope=both keeps both true when both requested true', () => {
    const result = enforceScope({ scope: 'both', showQuote: true, showInvoice: true });
    expect(result).toEqual({ showQuote: true, showInvoice: true });
  });

  it('scope=both keeps both false when both requested false', () => {
    const result = enforceScope({ scope: 'both', showQuote: false, showInvoice: false });
    expect(result).toEqual({ showQuote: false, showInvoice: false });
  });

  it('scope=quote preserves showQuote=true', () => {
    const result = enforceScope({ scope: 'quote', showQuote: true, showInvoice: false });
    expect(result).toEqual({ showQuote: true, showInvoice: false });
  });

  it('scope=invoice preserves showInvoice=true', () => {
    const result = enforceScope({ scope: 'invoice', showQuote: false, showInvoice: true });
    expect(result).toEqual({ showQuote: false, showInvoice: true });
  });
});
