import { query } from '../../../lib/database/db.js';

const TRIAL_DAYS = 14;

/**
 * Set subscription_status to 'trial' and trial_ends_at to 14 days from now.
 * Idempotent: only applies if subscription_status is currently NULL.
 */
export async function activateTrialForTeam(input: { teamId: string }): Promise<void> {
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await query(
    `UPDATE teams SET subscription_status = 'trial', trial_ends_at = $2
     WHERE id = $1 AND subscription_status IS NULL`,
    [input.teamId, trialEndsAt],
  );
}
