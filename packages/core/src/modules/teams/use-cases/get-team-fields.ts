import type { TeamField } from '@tuldio/common';
import { findTeamFields } from '../repository/find-team-fields.js';
import { toTeamField } from '../domain/team-field.view.js';

export async function getTeamFields(teamId: string): Promise<TeamField[]> {
  const rows = await findTeamFields(teamId);
  return rows.map(toTeamField);
}
