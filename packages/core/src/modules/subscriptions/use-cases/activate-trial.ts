import { activateTrialForTeam } from '../repository/activate-trial.js';

/**
 * Activate the 14-day free trial for a team.
 * Called on the first message in the chat.
 * Idempotent: does nothing if trial/subscription already active.
 */
export async function activateTrial(input: { teamId: string }): Promise<void> {
  await activateTrialForTeam({ teamId: input.teamId });
}
