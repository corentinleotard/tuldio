import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { TeamRow } from '../domain/team.entity.js';

const TRIAL_DAYS = 14;

const insertTeamSchema = z.object({
  name: z.string().min(1),
  siret: z.string().min(1),
});

export async function insertTeam(input: {
  name: string;
  siret: string;
}): Promise<TeamRow> {
  const validated = insertTeamSchema.parse(input);
  const id = generateId();
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const result = await query<TeamRow>(
    `INSERT INTO teams (id, name, siret, trial_ends_at, subscription_status)
     VALUES ($1, $2, $3, $4, 'trial')
     RETURNING *`,
    [id, validated.name, validated.siret, trialEndsAt],
  );

  return result.rows[0]!;
}
