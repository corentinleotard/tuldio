import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { TeamRow } from '../domain/team.entity.js';

const TRIAL_DAYS = 14;

const insertTeamSchema = z.object({
  name: z.string().min(1),
});

export async function insertTeam(input: {
  name: string;
}): Promise<TeamRow> {
  const validated = insertTeamSchema.parse(input);
  const id = generateId();
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const result = await query<TeamRow>(
    `INSERT INTO teams (id, name, trial_ends_at, subscription_status)
     VALUES ($1, $2, $3, 'trial')
     RETURNING *`,
    [id, validated.name, trialEndsAt],
  );

  return result.rows[0]!;
}
