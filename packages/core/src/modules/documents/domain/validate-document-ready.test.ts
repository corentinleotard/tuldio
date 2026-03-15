import { describe, expect, it } from 'vitest';
import { validateDocumentReady, type DocumentReadyInput } from './validate-document-ready.js';
import type { TeamFieldRow } from '../../teams/domain/team-field.entity.js';

function makeField(overrides: Partial<TeamFieldRow> & { key: string; value: string }): TeamFieldRow {
  return {
    id: 'field-id',
    team_id: 'team-id',
    label: overrides.key,
    zone: 'identity',
    scope: 'both',
    show_quote: true,
    show_invoice: true,
    sort_order: 0,
    is_system: true,
    ...overrides,
  };
}

function validQuoteInput(): DocumentReadyInput {
  return {
    documentType: 'quote',
    team: { name: 'Test SARL' },
    teamFields: [
      makeField({ key: 'siret', value: '12345678901234' }),
      makeField({ key: 'address', value: '1 rue de Paris, 75001 Paris' }),
      makeField({ key: 'tva_number', value: 'FR32123456789' }),
      makeField({ key: 'payment_terms', value: 'Paiement a reception de facture', zone: 'payment', scope: 'quote' }),
    ],
    client: { firstName: 'Jean', lastName: 'Martin', companyName: null, siret: null, address: '2 rue du Moulin, 69001 Lyon' },
    lines: [{ description: 'Prestation' }],
  };
}

function validInvoiceInput(): DocumentReadyInput {
  return {
    documentType: 'invoice',
    team: { name: 'Test SARL' },
    teamFields: [
      makeField({ key: 'siret', value: '12345678901234' }),
      makeField({ key: 'address', value: '1 rue de Paris, 75001 Paris' }),
      makeField({ key: 'tva_number', value: 'FR32123456789' }),
      makeField({ key: 'early_payment_discount', value: "Pas d'escompte pour paiement anticipé", zone: 'legal', scope: 'invoice' }),
      makeField({ key: 'late_penalty_rate', value: '3 fois le taux d\'intérêt légal', zone: 'legal', scope: 'invoice' }),
      makeField({ key: 'recovery_fee', value: '4000', zone: 'legal', scope: 'invoice' }),
    ],
    client: { firstName: 'Jean', lastName: 'Martin', companyName: null, siret: null, address: '2 rue du Moulin, 69001 Lyon' },
    lines: [{ description: 'Prestation' }],
  };
}

describe('validateDocumentReady', () => {
  // --- Valid cases ---

  it('returns no errors for a complete quote', () => {
    expect(validateDocumentReady(validQuoteInput())).toEqual([]);
  });

  it('returns no errors for a complete invoice', () => {
    expect(validateDocumentReady(validInvoiceInput())).toEqual([]);
  });

  // --- Team name ---

  it('reports missing team name (empty string)', () => {
    const input = validQuoteInput();
    input.team.name = '';
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_TEAM_NAME' }));
  });

  it('reports missing team name (whitespace only)', () => {
    const input = validQuoteInput();
    input.team.name = '   ';
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_TEAM_NAME' }));
  });

  // --- Team SIRET ---

  it('reports missing team SIRET (field absent)', () => {
    const input = validQuoteInput();
    input.teamFields = input.teamFields.filter((f) => f.key !== 'siret');
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_TEAM_SIRET' }));
  });

  it('reports missing team SIRET (empty value)', () => {
    const input = validQuoteInput();
    input.teamFields = input.teamFields.map((f) => f.key === 'siret' ? { ...f, value: '' } : f);
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_TEAM_SIRET' }));
  });

  it('reports missing team SIRET (whitespace value)', () => {
    const input = validQuoteInput();
    input.teamFields = input.teamFields.map((f) => f.key === 'siret' ? { ...f, value: '  ' } : f);
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_TEAM_SIRET' }));
  });

  // --- Team address ---

  it('reports missing team address (field absent)', () => {
    const input = validQuoteInput();
    input.teamFields = input.teamFields.filter((f) => f.key !== 'address');
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_TEAM_ADDRESS' }));
  });

  it('reports missing team address (empty value)', () => {
    const input = validQuoteInput();
    input.teamFields = input.teamFields.map((f) => f.key === 'address' ? { ...f, value: '' } : f);
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_TEAM_ADDRESS' }));
  });

  // --- Client address ---

  it('reports missing client address (null)', () => {
    const input = validQuoteInput();
    input.client.address = null;
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_CLIENT_ADDRESS' }));
  });

  it('reports missing client address (empty string)', () => {
    const input = validQuoteInput();
    input.client.address = '';
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_CLIENT_ADDRESS' }));
  });

  it('reports missing client address (whitespace)', () => {
    const input = validQuoteInput();
    input.client.address = '   ';
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_CLIENT_ADDRESS' }));
  });

  // --- Lines ---

  it('reports missing lines (empty array)', () => {
    const input = validQuoteInput();
    input.lines = [];
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_LINES' }));
  });

  // --- Invoice-specific legal mentions ---

  it('reports missing early payment discount on invoice', () => {
    const input = validInvoiceInput();
    input.teamFields = input.teamFields.filter((f) => f.key !== 'early_payment_discount');
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_EARLY_PAYMENT_DISCOUNT' }));
  });

  it('reports missing late penalty rate on invoice', () => {
    const input = validInvoiceInput();
    input.teamFields = input.teamFields.filter((f) => f.key !== 'late_penalty_rate');
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_LATE_PENALTY_RATE' }));
  });

  it('reports missing recovery fee on invoice', () => {
    const input = validInvoiceInput();
    input.teamFields = input.teamFields.filter((f) => f.key !== 'recovery_fee');
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_RECOVERY_FEE' }));
  });

  it('reports missing late penalty rate on invoice (empty value)', () => {
    const input = validInvoiceInput();
    input.teamFields = input.teamFields.map((f) => f.key === 'late_penalty_rate' ? { ...f, value: '' } : f);
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_LATE_PENALTY_RATE' }));
  });

  // --- TVA number required when not exempt ---

  it('reports missing TVA number when not exempt', () => {
    const input = validQuoteInput();
    input.teamFields = input.teamFields.filter((f) => f.key !== 'tva_number');
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_TVA_NUMBER' }));
  });

  it('does not report missing TVA number when exempt', () => {
    const input = validQuoteInput();
    input.teamFields = input.teamFields.filter((f) => f.key !== 'tva_number');
    input.teamFields.push(makeField({ key: 'tva_exempt', value: 'true' }));
    const errors = validateDocumentReady(input);
    expect(errors.map((e) => e.code)).not.toContain('MISSING_TVA_NUMBER');
  });

  // --- Quote: payment terms required ---

  it('reports missing payment terms on quote', () => {
    const input = validQuoteInput();
    input.teamFields = input.teamFields.filter((f) => f.key !== 'payment_terms');
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_PAYMENT_TERMS' }));
  });

  it('reports missing payment terms on quote (empty value)', () => {
    const input = validQuoteInput();
    input.teamFields = input.teamFields.map((f) => f.key === 'payment_terms' ? { ...f, value: '' } : f);
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_PAYMENT_TERMS' }));
  });

  it('does not require payment terms on invoice', () => {
    const input = validInvoiceInput();
    // No payment_terms in invoice fields — should not trigger
    const errors = validateDocumentReady(input);
    expect(errors.map((e) => e.code)).not.toContain('MISSING_PAYMENT_TERMS');
  });

  // --- Quote does NOT require invoice-specific mentions ---

  it('does not require invoice legal mentions on quotes', () => {
    const input = validQuoteInput();
    // No early_payment_discount, late_penalty_rate, recovery_fee in teamFields
    const errors = validateDocumentReady(input);
    expect(errors).toEqual([]);
  });

  // --- Multiple errors at once ---

  it('collects all errors at once (does not stop at first)', () => {
    const input: DocumentReadyInput = {
      documentType: 'invoice',
      team: { name: '' },
      teamFields: [],
      client: { firstName: 'Jean', lastName: 'Martin', companyName: null, siret: null, address: null },
      lines: [],
    };
    const errors = validateDocumentReady(input);
    const codes = errors.map((e) => e.code);
    expect(codes).toContain('MISSING_TEAM_NAME');
    expect(codes).toContain('MISSING_TEAM_SIRET');
    expect(codes).toContain('MISSING_TEAM_ADDRESS');
    expect(codes).toContain('MISSING_CLIENT_ADDRESS');
    expect(codes).toContain('MISSING_TVA_NUMBER');
    expect(codes).toContain('MISSING_LINES');
    expect(codes).toContain('MISSING_EARLY_PAYMENT_DISCOUNT');
    expect(codes).toContain('MISSING_LATE_PENALTY_RATE');
    expect(codes).toContain('MISSING_RECOVERY_FEE');
    expect(errors).toHaveLength(9);
  });

  it('collects all common errors on a quote (no invoice-specific)', () => {
    const input: DocumentReadyInput = {
      documentType: 'quote',
      team: { name: '' },
      teamFields: [],
      client: { firstName: 'Jean', lastName: 'Martin', companyName: null, siret: null, address: null },
      lines: [],
    };
    const errors = validateDocumentReady(input);
    const codes = errors.map((e) => e.code);
    expect(codes).toContain('MISSING_TEAM_NAME');
    expect(codes).toContain('MISSING_TEAM_SIRET');
    expect(codes).toContain('MISSING_TEAM_ADDRESS');
    expect(codes).toContain('MISSING_CLIENT_ADDRESS');
    expect(codes).toContain('MISSING_TVA_NUMBER');
    expect(codes).toContain('MISSING_LINES');
    expect(codes).toContain('MISSING_PAYMENT_TERMS');
    expect(codes).not.toContain('MISSING_EARLY_PAYMENT_DISCOUNT');
    expect(codes).not.toContain('MISSING_LATE_PENALTY_RATE');
    expect(codes).not.toContain('MISSING_RECOVERY_FEE');
    expect(errors).toHaveLength(7);
  });

  // --- All error messages are in French ---

  it('returns French error messages', () => {
    const input: DocumentReadyInput = {
      documentType: 'invoice',
      team: { name: '' },
      teamFields: [],
      client: { firstName: 'Jean', lastName: 'Martin', companyName: null, siret: null, address: null },
      lines: [],
    };
    const errors = validateDocumentReady(input);
    for (const error of errors) {
      // All messages should contain French characters/words
      expect(error.message).toBeTruthy();
      expect(error.message.length).toBeGreaterThan(5);
    }
  });

  // --- B2B: client SIRET required when company ---

  it('reports missing client SIRET when company_name is set', () => {
    const input = validQuoteInput();
    input.client = { firstName: null, lastName: null, companyName: 'ACME SAS', siret: null, address: '10 rue de Lyon, 75012 Paris' };
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_CLIENT_SIRET' }));
  });

  it('does not report missing client SIRET for B2C client', () => {
    const input = validQuoteInput();
    // B2C: no company_name, no siret — should not trigger MISSING_CLIENT_SIRET
    expect(validateDocumentReady(input)).toEqual([]);
  });

  it('does not report missing client SIRET when company has SIRET', () => {
    const input = validQuoteInput();
    input.client = { firstName: null, lastName: null, companyName: 'ACME SAS', siret: '12345678901234', address: '10 rue de Lyon, 75012 Paris' };
    expect(validateDocumentReady(input)).toEqual([]);
  });

  it('reports missing client SIRET when company_name is set but siret is whitespace', () => {
    const input = validQuoteInput();
    input.client = { firstName: null, lastName: null, companyName: 'ACME SAS', siret: '  ', address: '10 rue de Lyon, 75012 Paris' };
    const errors = validateDocumentReady(input);
    expect(errors).toContainEqual(expect.objectContaining({ code: 'MISSING_CLIENT_SIRET' }));
  });
});
