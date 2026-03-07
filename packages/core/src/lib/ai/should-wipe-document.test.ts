import { describe, it, expect } from 'vitest';
import { shouldWipeDocument } from './should-wipe-document.js';
import type { DemandDocument } from '@tuldio/types';

describe('shouldWipeDocument', () => {
  // --- Wipe cases ---

  it('returns true when document is null (no document in progress — nothing to preserve)', () => {
    expect(shouldWipeDocument(null)).toBe(true);
  });

  it('returns true when document has a generatedId (document was already created — new client means new demand)', () => {
    const doc: DemandDocument = {
      type: 'quote',
      tvaContext: 'réno',
      lines: [{ description: 'Carrelage', quantity: 10, unit: 'm2', unitPrice: 4500, tvaRate: 1000 }],
      generatedId: 'aaaaaaaa-0001-4000-8000-000000000001',
    };
    expect(shouldWipeDocument(doc)).toBe(true);
  });

  it('returns true when invoice document has a generatedId (same rule applies to invoices)', () => {
    const doc: DemandDocument = {
      type: 'invoice',
      lines: [{ description: 'Plomberie', quantity: 1, unit: 'forfait', unitPrice: 15000, tvaRate: 2000 }],
      generatedId: 'bbbbbbbb-0002-4000-8000-000000000002',
    };
    expect(shouldWipeDocument(doc)).toBe(true);
  });

  // --- Keep cases ---

  it('returns false when document has lines but no generatedId (user is switching recipient mid-flow — keep lines)', () => {
    const doc: DemandDocument = {
      type: 'quote',
      tvaContext: 'réno',
      lines: [
        { description: 'Terrassement', quantity: 30, unit: 'm' },
        { description: 'Polyane', quantity: 25, unit: 'm2' },
      ],
    };
    expect(shouldWipeDocument(doc)).toBe(false);
  });

  it('returns false when document has priced lines but no generatedId (ready to generate — just changing client)', () => {
    const doc: DemandDocument = {
      type: 'quote',
      tvaContext: 'neuf',
      lines: [
        { description: 'Carrelage', quantity: 10, unit: 'm2', unitPrice: 4500, tvaRate: 2000 },
      ],
    };
    expect(shouldWipeDocument(doc)).toBe(false);
  });

  it('returns false when document has empty lines and no generatedId (just initialized — keep the document shell)', () => {
    const doc: DemandDocument = {
      type: 'invoice',
      lines: [],
    };
    expect(shouldWipeDocument(doc)).toBe(false);
  });

  it('returns false when document has title and tvaContext but no generatedId (metadata set, not yet generated)', () => {
    const doc: DemandDocument = {
      type: 'quote',
      title: 'Rénovation salle de bain',
      tvaContext: 'réno',
      lines: [{ description: 'Pose carrelage', quantity: 15, unit: 'm2' }],
    };
    expect(shouldWipeDocument(doc)).toBe(false);
  });
});
