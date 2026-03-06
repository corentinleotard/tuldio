import type { TeamSummary } from '@tuldio/types';
import { insertTeam } from '../repository/insert-team.js';
import { toTeamSummary } from '../domain/team.view.js';

export async function createTeam(input: {
  name: string;
}): Promise<TeamSummary> {
  const team = await insertTeam(input);

  return toTeamSummary(team);
}
