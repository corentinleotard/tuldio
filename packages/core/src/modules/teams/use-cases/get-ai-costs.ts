import type { AiCostsSummary } from '@tuldio/types';
import { findAiCalls } from '../repository/find-ai-calls.js';

export async function getAiCosts(input: { teamId: string }): Promise<AiCostsSummary> {
  return findAiCalls({ teamId: input.teamId });
}
