import { describe, expect, it } from 'vitest';
import { getClientDisplayName } from './get-client-display-name.js';

describe('getClientDisplayName', () => {
  it('returns "firstName lastName" for B2C client', () => {
    expect(getClientDisplayName({ first_name: 'Jean', last_name: 'Martin', company_name: null }))
      .toBe('Jean Martin');
  });

  it('returns company name for B2B client without contact', () => {
    expect(getClientDisplayName({ first_name: null, last_name: null, company_name: 'ACME SAS' }))
      .toBe('ACME SAS');
  });

  it('returns "companyName (contact)" for B2B client with contact', () => {
    expect(getClientDisplayName({ first_name: 'Jean', last_name: 'Martin', company_name: 'ACME SAS' }))
      .toBe('ACME SAS (Jean Martin)');
  });

  it('returns "companyName (firstName)" when only firstName set', () => {
    expect(getClientDisplayName({ first_name: 'Jean', last_name: null, company_name: 'ACME SAS' }))
      .toBe('ACME SAS (Jean)');
  });

  it('returns lastName only when firstName is null (B2C)', () => {
    expect(getClientDisplayName({ first_name: null, last_name: 'Martin', company_name: null }))
      .toBe('Martin');
  });

  it('returns empty string when all null', () => {
    expect(getClientDisplayName({ first_name: null, last_name: null, company_name: null }))
      .toBe('');
  });
});
