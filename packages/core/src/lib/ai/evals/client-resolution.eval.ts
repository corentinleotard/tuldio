/**
 * Eval: Client resolution — the AI must search for the correct client.
 *
 * These tests verify the core bug we fixed: the AI must use the client
 * mentioned in the CURRENT message, not one from previous context.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { runEval, userMsg, assistantMsg, type EvalScenario } from './eval-harness.js';
import type { StoredToolRounds } from '../build-context.js';

// Increase timeout — these hit the real API
const TIMEOUT = 30_000;
const RATE_LIMIT_DELAY = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('client resolution evals', () => {
  beforeEach(async () => {
    await sleep(RATE_LIMIT_DELAY);
  });

  it('searches for the client mentioned in the message', async () => {
    const scenario: EvalScenario = {
      name: 'basic client search',
      userMessage: 'Fais un devis pour Dupont',
      expectToolCall: {
        name: 'find_clients',
        inputContains: { search: 'Dupont' },
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);

  it('does NOT reuse previous client when a new one is mentioned', async () => {
    // Simulate: previous turn resolved "Martin" with clientId "aaa-111"
    const martinRounds: StoredToolRounds = [[{
      toolUseId: 'tu-prev',
      name: 'find_clients',
      input: { search: 'Martin' },
      result: { status: 'exact_match', client: { id: 'aaa-111', firstName: 'Jean', lastName: 'Martin' } },
    }]];

    const scenario: EvalScenario = {
      name: 'new client after previous resolution',
      history: [
        userMsg('Devis pour Martin'),
        assistantMsg('Je pars sur Jean Martin ?', martinRounds),
      ],
      userMessage: 'Non finalement, fais un devis pour Dupont',
      expectToolCall: {
        name: 'find_clients',
        inputContains: { search: 'Dupont' },
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);

  it('does NOT use clientId from history to generate a quote directly', async () => {
    // Previous turn resolved Martin — now user asks for Dupont quote
    // AI MUST search for Dupont first, not use Martin's ID
    const martinRounds: StoredToolRounds = [[{
      toolUseId: 'tu-prev',
      name: 'find_clients',
      input: { search: 'Martin' },
      result: { status: 'exact_match', client: { id: 'aaa-111', firstName: 'Jean', lastName: 'Martin' } },
    }]];

    const scenario: EvalScenario = {
      name: 'must not skip client search',
      history: [
        userMsg('Devis pour Martin'),
        assistantMsg('Devis cree pour Jean Martin !', martinRounds),
      ],
      userMessage: 'Fais un devis pour Dupont aussi, 5m2 de peinture a 30 euros',
      expectToolCall: {
        // Must search for Dupont, not jump to generate_quote with Martin's ID
        name: 'find_clients',
        inputContains: { search: 'Dupont' },
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);

  it('strips civilities from client name', async () => {
    const scenario: EvalScenario = {
      name: 'strip civilities',
      userMessage: 'Fais un devis pour Madame Lefebvre',
      expectToolCall: {
        name: 'find_clients',
        inputContains: { search: 'Lefebvre' },
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);
});
