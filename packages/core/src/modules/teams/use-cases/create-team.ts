import type { TeamSummary } from '@tuldio/common';
import { insertTeam } from '../repository/insert-team.js';
import { findTeamById } from '../repository/find-team-by-id.js';
import { seedTeamFields } from '../repository/seed-team-fields.js';
import { toTeamSummary } from '../domain/team.view.js';

export async function createTeam(input: {
  name: string;
}): Promise<TeamSummary> {
  const { id } = await insertTeam(input);
  await seedTeamFields(id);

  const team = await findTeamById(id);
  return toTeamSummary(team!, []);
}
