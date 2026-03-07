/**
 * Eval: Post-generation edit — after generating a quote, the user wants to add/modify lines.
 *
 * The AI must use update_quote with the generatedId from state, NOT try to regenerate from scratch.
 * This was a real production bug: generate_quote cleared state, so the AI lost context and spiraled.
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

describe('post-generation edit evals', () => {
  beforeEach(async () => {
    await sleep(RATE_LIMIT_DELAY);
  });

  it('calls update_quote (not generate_quote) when user wants to add a line after generation', async () => {
    const generateRounds: StoredToolRounds = [[
      {
        toolUseId: 'tu-init',
        name: 'init_document',
        input: { type: 'quote', tvaContext: 'réno' },
        result: { type: 'quote', tvaContext: 'réno', lineCount: 0 },
      },
    ], [
      {
        toolUseId: 'tu-add',
        name: 'add_lines',
        input: { lines: [{ description: 'Terrassement', quantity: 30, unit: 'm', unitPrice: 4500, tvaRate: 1000 }] },
        result: { addedCount: 1, totalLineCount: 1, allPriced: true },
      },
    ], [
      {
        toolUseId: 'tu-gen',
        name: 'generate_quote',
        input: {},
        result: { id: 'q-abc-123', number: 'D-001', totalHt: 135000, totalTtc: 148500 },
      },
    ]];

    const scenario: EvalScenario = {
      name: 'add line after quote generation uses update_quote',
      history: [
        userMsg('Fais un devis pour Léotard, 30m de terrassement à 45€/m, réno'),
        assistantMsg('Voilà le devis D-001 pour Titi Léotard : 30m de terrassement à 45€/m = 1 350€ HT.', generateRounds),
      ],
      demandState: {
        client: { id: 'c-leo', name: 'Titi Léotard' },
        document: {
          type: 'quote',
          tvaContext: 'réno',
          lines: [
            { description: 'Terrassement', quantity: 30, unit: 'm', unitPrice: 4500, tvaRate: 1000 },
          ],
          generatedId: 'q-abc-123',
        },
      },
      userMessage: 'Attends j\'ai oublié, ajoute 25m2 de polyane à 8€/m2',
      expectToolCall: {
        name: 'update_quote',
        inputContains: { quoteId: 'q-abc-123' },
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);

    // Verify the lines include BOTH old and new
    const lines = result.toolCalls[0]!.input.lines as Array<{ description: string }>;
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const descriptions = lines.map((l) => l.description.toLowerCase());
    expect(descriptions.some((d) => d.includes('terrassement'))).toBe(true);
    expect(descriptions.some((d) => d.includes('polyane'))).toBe(true);
  }, TIMEOUT);

  it('calls update_quote when user wants to change a price after generation', async () => {
    const generateRounds: StoredToolRounds = [[
      {
        toolUseId: 'tu-gen',
        name: 'generate_quote',
        input: {},
        result: { id: 'q-def-456', number: 'D-002', totalHt: 270000, totalTtc: 297000 },
      },
    ]];

    const scenario: EvalScenario = {
      name: 'price change after generation uses update_quote',
      history: [
        userMsg('Devis pour Martin, 30m terrassement à 45€ et 25m2 polyane à 50€, réno'),
        assistantMsg('Devis D-002 créé : terrassement 30m à 45€ + polyane 25m² à 50€ = 2 700€ HT.', generateRounds),
      ],
      demandState: {
        client: { id: 'c-martin', name: 'Jean Martin' },
        document: {
          type: 'quote',
          tvaContext: 'réno',
          lines: [
            { description: 'Terrassement', quantity: 30, unit: 'm', unitPrice: 4500, tvaRate: 1000 },
            { description: 'Polyane', quantity: 25, unit: 'm2', unitPrice: 5000, tvaRate: 550 },
          ],
          generatedId: 'q-def-456',
        },
      },
      userMessage: 'Finalement mets le polyane à 8€/m2',
      expectToolCall: {
        name: 'update_quote',
        inputContains: { quoteId: 'q-def-456' },
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);

  it('does NOT call generate_quote when generatedId already exists in state', async () => {
    const generateRounds: StoredToolRounds = [[
      {
        toolUseId: 'tu-gen',
        name: 'generate_quote',
        input: {},
        result: { id: 'q-ghi-789', number: 'D-003', totalHt: 93000, totalTtc: 102300 },
      },
    ]];

    const scenario: EvalScenario = {
      name: 'no re-generation when quote already exists',
      history: [
        userMsg('Devis pour Léotard, pose carrelage 15m2 à 62€'),
        assistantMsg('Devis D-003 créé pour Titi Léotard : pose carrelage 15m² à 62€ = 930€ HT.', generateRounds),
      ],
      demandState: {
        client: { id: 'c-leo', name: 'Titi Léotard' },
        document: {
          type: 'quote',
          tvaContext: 'réno',
          lines: [
            { description: 'Pose carrelage', quantity: 15, unit: 'm2', unitPrice: 6200, tvaRate: 1000 },
          ],
          generatedId: 'q-ghi-789',
        },
      },
      userMessage: 'Ajoute aussi la fourniture carrelage 15m2 à 35€/m2',
      expectToolCall: {
        name: 'update_quote',
        inputContains: { quoteId: 'q-ghi-789' },
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);
});
