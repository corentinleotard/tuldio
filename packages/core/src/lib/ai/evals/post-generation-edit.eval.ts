/**
 * Eval: Post-creation edit — after creating a document, the user wants to add/modify lines.
 *
 * The AI must use update_document (not create_document again).
 * This was a real production bug: generation cleared state and the AI lost context.
 *
 * Run with: pnpm eval
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runEval, userMsg, assistantMsg, type EvalScenario } from './eval-harness.js';
import type { StoredToolRounds } from '../build-context.js';
import type { QuoteView } from '@tuldio/types';

const TIMEOUT = 30_000;
const RATE_LIMIT_DELAY = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockQuoteView(overrides: Partial<QuoteView> = {}): QuoteView {
  return {
    id: 'aaaaaaaa-0001-4000-8000-000000000001',
    number: 'D-001',
    clientId: 'c-leo',
    clientName: 'Titi Léotard',
    title: 'Travaux',
    lines: [
      { id: 'l1', description: 'Terrassement', quantity: 30, unit: 'm', unitPrice: 4500, tvaRate: 1000, totalHt: 135000, prestationId: null },
    ],
    totalHt: 135000,
    totalTtc: 148500,
    tvaGroups: [{ tvaRate: 1000, baseHt: 135000, tvaMontant: 13500 }],
    status: 'draft',
    pdfUrl: null,
    validUntil: null,
    sentAt: null,
    acceptedAt: null,
    refusedAt: null,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('post-creation edit evals', () => {
  beforeEach(async () => {
    await sleep(RATE_LIMIT_DELAY);
  });

  it('calls update_document (not create_document) when user wants to add a line after creation', async () => {
    const createRounds: StoredToolRounds = [[
      {
        toolUseId: 'tu-create',
        name: 'create_document',
        input: { type: 'quote', lines: [{ description: 'Terrassement', quantity: 30, unit: 'm', unitPrice: 4500, tvaRate: 1000 }] },
        result: { id: 'aaaaaaaa-0001-4000-8000-000000000001', number: 1, totalHt: 135000, totalTtc: 148500 },
      },
    ]];

    const scenario: EvalScenario = {
      name: 'add line after creation uses update_document',
      history: [
        userMsg('Fais un devis pour Léotard, 30m de terrassement à 45€/m'),
        assistantMsg('Voilà le devis #1 pour Titi Léotard : 30m de terrassement à 45€/m = 1 350€ HT.', createRounds),
      ],
      demandState: {
        client: { id: 'c-leo', name: 'Titi Léotard' },
        document: { id: 'aaaaaaaa-0001-4000-8000-000000000001', type: 'quote' },
      },
      activeDocument: mockQuoteView(),
      userMessage: 'Attends j\'ai oublié, ajoute 25m2 de polyane à 8€/m2',
      expectToolCall: {
        name: 'update_document',
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);

    // Verify the AI uses addedLines (delta) with the new line
    const input = result.toolCalls[0]!.input as { addedLines?: Array<{ description: string }> };
    expect(input.addedLines).toBeDefined();
    expect(input.addedLines!.length).toBeGreaterThanOrEqual(1);
    const descriptions = input.addedLines!.map((l) => l.description.toLowerCase());
    expect(descriptions.some((d) => d.includes('polyane'))).toBe(true);
  }, TIMEOUT);

  it('calls update_document when user wants to change a price after creation', async () => {
    const quoteView = mockQuoteView({
      id: 'aaaaaaaa-0002-4000-8000-000000000002',
      number: 'D-002',
      lines: [
        { id: 'l1', description: 'Terrassement', quantity: 30, unit: 'm', unitPrice: 4500, tvaRate: 1000, totalHt: 135000, prestationId: null },
        { id: 'l2', description: 'Polyane', quantity: 25, unit: 'm2', unitPrice: 5000, tvaRate: 550, totalHt: 125000, prestationId: null },
      ],
      totalHt: 260000,
      totalTtc: 286000,
    });

    const createRounds: StoredToolRounds = [[
      {
        toolUseId: 'tu-create',
        name: 'create_document',
        input: { type: 'quote' },
        result: { id: 'aaaaaaaa-0002-4000-8000-000000000002', number: 2, totalHt: 260000, totalTtc: 286000 },
      },
    ]];

    const scenario: EvalScenario = {
      name: 'price change after creation uses update_document',
      history: [
        userMsg('Devis pour Martin, 30m terrassement à 45€ et 25m2 polyane à 50€'),
        assistantMsg('Devis #2 créé : terrassement 30m à 45€ + polyane 25m² à 50€ = 2 600€ HT.', createRounds),
      ],
      demandState: {
        client: { id: 'c-martin', name: 'Jean Martin' },
        document: { id: 'aaaaaaaa-0002-4000-8000-000000000002', type: 'quote' },
      },
      activeDocument: quoteView,
      userMessage: 'Finalement mets le polyane à 8€/m2',
      expectToolCall: {
        name: 'update_document',
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);

  it('does NOT call create_document when document already exists in state', async () => {
    const quoteView = mockQuoteView({
      id: 'aaaaaaaa-0003-4000-8000-000000000003',
      number: 'D-003',
      lines: [
        { id: 'l1', description: 'Pose carrelage', quantity: 15, unit: 'm2', unitPrice: 6200, tvaRate: 1000, totalHt: 93000, prestationId: null },
      ],
      totalHt: 93000,
      totalTtc: 102300,
    });

    const createRounds: StoredToolRounds = [[
      {
        toolUseId: 'tu-create',
        name: 'create_document',
        input: { type: 'quote' },
        result: { id: 'aaaaaaaa-0003-4000-8000-000000000003', number: 3, totalHt: 93000, totalTtc: 102300 },
      },
    ]];

    const scenario: EvalScenario = {
      name: 'no re-creation when document already exists',
      history: [
        userMsg('Devis pour Léotard, pose carrelage 15m2 à 62€'),
        assistantMsg('Devis #3 créé pour Titi Léotard : pose carrelage 15m² à 62€ = 930€ HT.', createRounds),
      ],
      demandState: {
        client: { id: 'c-leo', name: 'Titi Léotard' },
        document: { id: 'aaaaaaaa-0003-4000-8000-000000000003', type: 'quote' },
      },
      activeDocument: quoteView,
      userMessage: 'Ajoute aussi la fourniture carrelage 15m2 à 35€/m2',
      expectToolCall: {
        name: 'update_document',
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);
});
