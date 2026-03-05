import type { TeamSummary } from '@tuldio/types';
import { insertTeam } from '../repository/insert-team.js';

export async function createTeam(input: {
  name: string;
  siret: string;
}): Promise<TeamSummary> {
  const team = await insertTeam(input);

  return {
    id: team.id,
    name: team.name,
    siret: team.siret,
    subscriptionStatus: team.subscription_status,
    trialEndsAt: team.trial_ends_at?.toISOString() ?? null,
  };
}
