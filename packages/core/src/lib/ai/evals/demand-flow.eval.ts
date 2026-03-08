/**
 * Eval: Document creation flow — the AI must use the right tools in the right order.
 *
 * Tests:
 * - AI calls search_past_pricing or create_document when user gives line items
 * - AI calls resolve_client when user switches client mid-flow
 * - AI calls create_document when user confirms and all info is ready
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

describe('document creation flow evals', () => {
  beforeEach(async () => {
    await sleep(RATE_LIMIT_DELAY);
  });

  it('calls search_past_pricing or create_document when user provides line items with prices', async () => {
    const resolveRounds: StoredToolRounds = [[{
      toolUseId: 'tu-resolve',
      name: 'resolve_client',
      input: { search: 'Martin' },
      result: { status: 'exact_match', client: { id: 'c1', firstName: 'Jean', lastName: 'Martin' } },
    }]];

    const scenario: EvalScenario = {
      name: 'line items trigger tool action',
      history: [
        userMsg('Fais un devis pour Martin'),
        assistantMsg('J\'ai trouvé Jean Martin. Quels travaux ?', resolveRounds),
      ],
      demandState: {
        client: { id: 'c1', name: 'Jean Martin' },
        document: null,
      },
      userMessage: '30 metres lineaires de terrassement à 45€/m et 25m2 de polyane à 50€/m2',
      expectToolCall: {
        name: 'create_document',
      },
    };

    const result = await runEval(scenario);
    // Accept create_document or search_past_pricing (proactive pricing lookup)
    if (!result.pass) {
      const firstTool = result.toolCalls[0]?.name;
      expect(firstTool, result.error).toBe('search_past_pricing');
    }
  }, TIMEOUT);

  it('calls resolve_client when user switches client mid-flow', async () => {
    const resolveRounds: StoredToolRounds = [[{
      toolUseId: 'tu-resolve',
      name: 'resolve_client',
      input: { search: 'Martin' },
      result: { status: 'exact_match', client: { id: 'c1', firstName: 'Jean', lastName: 'Martin' } },
    }]];

    const scenario: EvalScenario = {
      name: 'client switch triggers resolve_client',
      history: [
        userMsg('Devis pour Martin, 10m2 carrelage à 45€'),
        assistantMsg('J\'ai trouvé Jean Martin. Je prépare le devis ?', resolveRounds),
      ],
      demandState: {
        client: { id: 'c1', name: 'Jean Martin' },
        document: null,
      },
      userMessage: 'Finalement c\'est pour Dupont pas Martin',
      expectToolCall: {
        name: 'resolve_client',
        inputContains: { search: 'Dupont' },
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);

  it('calls create_document when user confirms and all info is ready', async () => {
    const resolveRounds: StoredToolRounds = [[{
      toolUseId: 'tu-resolve',
      name: 'resolve_client',
      input: { search: 'Martin' },
      result: { status: 'exact_match', client: { id: 'c1', firstName: 'Jean', lastName: 'Martin' } },
    }]];

    const scenario: EvalScenario = {
      name: 'create_document when all info ready',
      history: [
        userMsg('Devis pour Martin, 30m terrassement à 45€ et 25m2 polyane à 50€'),
        assistantMsg('J\'ai trouvé Jean Martin. Terrassement 30m à 45€/m et polyane 25m² à 50€/m². Je crée le devis ?', resolveRounds),
      ],
      demandState: {
        client: { id: 'c1', name: 'Jean Martin' },
        document: null,
      },
      userMessage: 'oui vas-y',
      expectToolCall: {
        name: 'create_document',
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);

  it('does NOT create document without resolving client first', async () => {
    const scenario: EvalScenario = {
      name: 'no document without client',
      demandState: {
        client: null,
        document: null,
      },
      userMessage: 'Fais un devis pour Dupont, 10m2 carrelage à 45€',
      expectToolCall: {
        name: 'resolve_client',
        inputContains: { search: 'Dupont' },
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);
});
