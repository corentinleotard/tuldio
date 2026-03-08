import { describe, it, expect } from 'vitest';
import { shouldWipeDocument } from './should-wipe-document.js';
import type { DemandDocument } from '@tuldio/types';

const clientA = 'aaaaaaaa-0001-4000-8000-000000000001';
const clientB = 'bbbbbbbb-0002-4000-8000-000000000002';

const draftQuote: DemandDocument = {
  type: 'quote',
  tvaContext: 'réno',
  lines: [
    { description: 'Terrassement', quantity: 30, unit: 'm' },
    { description: 'Polyane', quantity: 25, unit: 'm2' },
  ],
};

const generatedQuote: DemandDocument = {
  type: 'quote',
  lines: [{ description: 'Carrelage', quantity: 10, unit: 'm2', unitPrice: 4500, tvaRate: 1000 }],
  generatedId: 'cccccccc-0003-4000-8000-000000000003',
};

describe('shouldWipeDocument', () => {
  // --- Wipe cases ---

  it('returns true when document is null (nothing to preserve)', () => {
    expect(shouldWipeDocument({ document: null, currentClientId: clientA, newClientId: clientB, intent: 'new' })).toBe(true);
  });

  it('returns true when different client with "new" intent (new demand)', () => {
    expect(shouldWipeDocument({ document: draftQuote, currentClientId: clientA, newClientId: clientB, intent: 'new' })).toBe(true);
  });

  it('returns true when different client with generated document', () => {
    expect(shouldWipeDocument({ document: generatedQuote, currentClientId: clientA, newClientId: clientB, intent: 'new' })).toBe(true);
  });

  it('returns true when same client but document already generated (new demand)', () => {
    expect(shouldWipeDocument({ document: generatedQuote, currentClientId: clientA, newClientId: clientA, intent: 'new' })).toBe(true);
  });

  it('returns true when currentClientId is null with "new" intent', () => {
    const doc: DemandDocument = { type: 'quote', lines: [{ description: 'Peinture', quantity: 5, unit: 'm2' }] };
    expect(shouldWipeDocument({ document: doc, currentClientId: null, newClientId: clientA, intent: 'new' })).toBe(true);
  });

  // --- Keep cases ---

  it('returns false when "switch_recipient" intent (user correcting client on current draft)', () => {
    expect(shouldWipeDocument({ document: draftQuote, currentClientId: clientA, newClientId: clientB, intent: 'switch_recipient' })).toBe(false);
  });

  it('returns false when "switch_recipient" intent even with generated document', () => {
    expect(shouldWipeDocument({ document: generatedQuote, currentClientId: clientA, newClientId: clientB, intent: 'switch_recipient' })).toBe(false);
  });

  it('returns false when same client and draft document with "new" intent (refining same quote)', () => {
    expect(shouldWipeDocument({ document: draftQuote, currentClientId: clientA, newClientId: clientA, intent: 'new' })).toBe(false);
  });

  it('returns false when same client and empty document', () => {
    const doc: DemandDocument = { type: 'invoice', lines: [] };
    expect(shouldWipeDocument({ document: doc, currentClientId: clientA, newClientId: clientA, intent: 'new' })).toBe(false);
  });
});
