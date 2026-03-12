/**
 * Eval: Post-creation edit — after creating a document, the user wants to add/modify lines.
 *
 * The AI must use update_quote (not create_document again).
 * This was a real production bug: generation cleared state and the AI lost context.
 *
 * Run with: pnpm eval
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runEval, userMsg, assistantMsg, type EvalScenario } from './eval-harness.js';
import type { StoredToolRounds } from '../build-context.js';

const TIMEOUT = 30_000;
const RATE_LIMIT_DELAY = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('post-creation edit evals', () => {
  beforeEach(async () => {
    await sleep(RATE_LIMIT_DELAY);
  });

  it('calls update_quote (not create_document) when user wants to add a line after creation', async () => {
    const createRounds: StoredToolRounds = [[
      {
        toolUseId: 'tu-create',
        name: 'create_document',
        input: { type: 'quote', lines: [{ description: 'Terrassement', quantity: 30, unit: 'm', unitPrice: 4500, tvaRate: 1000 }] },
        result: { id: 'aaaaaaaa-0001-4000-8000-000000000001', number: 1, totalHt: 135000, totalTtc: 148500 },
      },
    ]];

    const scenario: EvalScenario = {
      name: 'add line after creation uses update_quote',
      history: [
        userMsg('Fais un devis pour Léotard, 30m de terrassement à 45€/m'),
        assistantMsg('Voilà le devis #1 pour Titi Léotard : 30m de terrassement à 45€/m = 1 350€ HT.', createRounds),
      ],
      activeState: {
        client: { id: 'c-leo', name: 'Titi Léotard' },
        document: { id: 'aaaaaaaa-0001-4000-8000-000000000001', type: 'quote', number: 'D-2026-001' },
      },
      userMessage: 'Attends j\'ai oublié, ajoute 25m2 de polyane à 8€/m2',
      expectToolCall: {
        name: 'update_quote',
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

  it('calls update_quote or get_document when user wants to change a price after creation', async () => {
    const createRounds: StoredToolRounds = [[
      {
        toolUseId: 'tu-create',
        name: 'create_document',
        input: { type: 'quote' },
        result: { id: 'aaaaaaaa-0002-4000-8000-000000000002', number: 2, totalHt: 260000, totalTtc: 286000 },
      },
    ]];

    const scenario: EvalScenario = {
      name: 'price change after creation uses update_quote',
      history: [
        userMsg('Devis pour Martin, 30m terrassement à 45€ et 25m2 polyane à 50€'),
        assistantMsg('Devis #2 créé : terrassement 30m à 45€ + polyane 25m² à 50€ = 2 600€ HT.', createRounds),
      ],
      activeState: {
        client: { id: 'c-martin', name: 'Jean Martin' },
        document: { id: 'aaaaaaaa-0002-4000-8000-000000000002', type: 'quote', number: 'D-2026-002' },
      },
      userMessage: 'Finalement mets le polyane à 8€/m2',
      expectToolCall: {
        // AI may call get_document first to see line IDs, or update_quote directly
        // if create_document result with line IDs is still in the message window
        name: 'update_quote',
      },
    };

    const result = await runEval(scenario);
    // Accept either update_quote or get_document as first call
    const firstName = result.toolCalls[0]?.name;
    expect(
      firstName === 'update_quote' || firstName === 'get_document',
      `Expected update_quote or get_document, got ${firstName}`,
    ).toBe(true);
  }, TIMEOUT);

  it('does NOT call create_document when document already exists in state', async () => {
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
      activeState: {
        client: { id: 'c-leo', name: 'Titi Léotard' },
        document: { id: 'aaaaaaaa-0003-4000-8000-000000000003', type: 'quote', number: 'D-2026-003' },
      },
      userMessage: 'Ajoute aussi la fourniture carrelage 15m2 à 35€/m2',
      expectToolCall: {
        name: 'update_quote',
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);
});
