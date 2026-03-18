import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { activateTrial } from './activate-trial.js';

async function seedTeam(teamId: string, subscriptionStatus: string | null = null) {
  if (subscriptionStatus) {
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO teams (id, name, subscription_status, trial_ends_at) VALUES ($1, 'Test SARL', $2, $3)`,
      [teamId, subscriptionStatus, trialEndsAt],
    );
  } else {
    await query(`INSERT INTO teams (id, name) VALUES ($1, 'Test SARL')`, [teamId]);
  }
}

describe('activateTrial', () => {
  it('activates trial for team with null subscription_status', async () => {
    const teamId = generateId();
    await seedTeam(teamId, null);

    await activateTrial({ teamId });

    const result = await query<Record<string, unknown>>(
      'SELECT subscription_status, trial_ends_at FROM teams WHERE id = $1',
      [teamId],
    );
    const row = result.rows[0]!;
    expect(row.subscription_status).toBe('trial');
    expect(row.trial_ends_at).not.toBeNull();

    // trial_ends_at should be ~14 days from now (± 5 seconds tolerance)
    const trialEnd = new Date(row.trial_ends_at as string);
    const diff = trialEnd.getTime() - Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    expect(diff).toBeGreaterThan(fourteenDaysMs - 5000);
    expect(diff).toBeLessThan(fourteenDaysMs + 5000);
  });

  it('does not overwrite existing trial', async () => {
    const teamId = generateId();
    await seedTeam(teamId, 'trial');

    const before = await query<{ trial_ends_at: Date }>(
      'SELECT trial_ends_at FROM teams WHERE id = $1',
      [teamId],
    );
    const originalTrialEnd = before.rows[0]!.trial_ends_at;

    await activateTrial({ teamId });

    const after = await query<{ subscription_status: string; trial_ends_at: Date }>(
      'SELECT subscription_status, trial_ends_at FROM teams WHERE id = $1',
      [teamId],
    );
    expect(after.rows[0]!.subscription_status).toBe('trial');
    expect(after.rows[0]!.trial_ends_at.getTime()).toBe(originalTrialEnd.getTime());
  });

  it('does not overwrite active subscription', async () => {
    const teamId = generateId();
    await seedTeam(teamId, 'active');

    await activateTrial({ teamId });

    const result = await query<{ subscription_status: string }>(
      'SELECT subscription_status FROM teams WHERE id = $1',
      [teamId],
    );
    expect(result.rows[0]!.subscription_status).toBe('active');
  });

  it('does not overwrite expired status', async () => {
    const teamId = generateId();
    await seedTeam(teamId, 'expired');

    await activateTrial({ teamId });

    const result = await query<{ subscription_status: string }>(
      'SELECT subscription_status FROM teams WHERE id = $1',
      [teamId],
    );
    expect(result.rows[0]!.subscription_status).toBe('expired');
  });

  it('is idempotent — calling twice on null does not error', async () => {
    const teamId = generateId();
    await seedTeam(teamId, null);

    await activateTrial({ teamId });
    await activateTrial({ teamId }); // second call — should be a no-op

    const result = await query<{ subscription_status: string }>(
      'SELECT subscription_status FROM teams WHERE id = $1',
      [teamId],
    );
    expect(result.rows[0]!.subscription_status).toBe('trial');
  });
});
