/**
 * End-to-end test: Classic OTP login flow
 *
 * Simulates: user logs in via email OTP -> lands in chat -> sends first message (trial starts)
 * -> creates a draft quote -> tries to send it -> gets COMPANY_INFO_REQUIRED
 * -> fills company info -> accepts terms -> retries send -> succeeds
 */
import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { verifyOtp } from './verify-otp.js';
import { activateTrial } from '../../subscriptions/use-cases/activate-trial.js';
import { updateQuoteStatusUc } from '../../quotes/use-cases/update-quote-status-uc.js';
import { acceptTerms } from '../../teams/use-cases/accept-terms.js';
import { updateTeamField } from '../../teams/use-cases/update-team-field.js';
import { updateTeam } from '../../teams/use-cases/update-team.js';

async function insertQuoteForTeam(teamId: string, userId: string) {
  const clientId = generateId();
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name, address)
     VALUES ($1, $2, 'Dupont', 'Pierre', '3 avenue de la République, 69001 Lyon')`,
    [clientId, teamId],
  );

  const quoteId = generateId();
  await query(
    `INSERT INTO quotes (id, team_id, created_by, client_id, number, total_ht, total_ttc, status, pdf_url)
     VALUES ($1, $2, $3, $4, $5, 110000, 132000, 'draft', '/files/pdfs/test.pdf')`,
    [quoteId, teamId, userId, clientId, `D-${generateId().slice(0, 8)}`],
  );
  await query(
    `INSERT INTO quote_lines (id, quote_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
     VALUES ($1, $2, 1, 'Pose carrelage 20m²', 20, 'm²', 5500, 2000, 110000)`,
    [generateId(), quoteId],
  );

  return quoteId;
}

describe('classic OTP flow e2e', () => {
  it('full flow: OTP login -> trial -> draft -> company info required -> fill -> send', async () => {
    const email = `e2e-${generateId().slice(0, 8)}@test.com`;

    // 1. Login via OTP (dev bypass - any code works)
    const { auth } = await verifyOtp({ email, code: '123456' });

    expect(auth.user.email).toBe(email);
    expect(auth.team.name).toBe(''); // Empty for new users

    const teamId = auth.team.id;
    const userId = auth.user.id;

    // 2. Verify subscription_status is null (no trial yet)
    const subBefore = await query<{ subscription_status: string | null }>(
      'SELECT subscription_status FROM teams WHERE id = $1', [teamId],
    );
    expect(subBefore.rows[0]!.subscription_status).toBeNull();

    // 3. Verify welcome message was created
    const messages = await query<{ role: string; content: string }>(
      'SELECT role, content FROM messages WHERE user_id = $1', [userId],
    );
    expect(messages.rows).toHaveLength(1);
    expect(messages.rows[0]!.role).toBe('assistant');
    expect(messages.rows[0]!.content).toContain('Bienvenue');

    // 4. First message activates trial
    await activateTrial({ teamId });

    const subAfter = await query<{ subscription_status: string | null }>(
      'SELECT subscription_status FROM teams WHERE id = $1', [teamId],
    );
    expect(subAfter.rows[0]!.subscription_status).toBe('trial');

    // 5. Create a draft quote
    const quoteId = await insertQuoteForTeam(teamId, userId);

    // 6. Try to send it - should fail (no company info at all)
    try {
      await updateQuoteStatusUc({ teamId, quoteId, status: 'sent' });
      expect.fail('Should have thrown COMPANY_INFO_REQUIRED');
    } catch (err: unknown) {
      const error = err as { code: string; details: Array<{ code: string }> };
      expect(error.code).toBe('COMPANY_INFO_REQUIRED');
      const codes = error.details.map((d) => d.code);
      expect(codes).toContain('MISSING_TEAM_NAME');
      expect(codes).toContain('MISSING_TEAM_SIRET');
      expect(codes).toContain('MISSING_TEAM_ADDRESS');
      expect(codes).toContain('MISSING_TVA_NUMBER');
      // MISSING_PAYMENT_TERMS is NOT expected here because seedTeamFields sets a default value
    }

    // 7. Fill all company info (simulate modal)
    await updateTeam({ teamId, name: 'Dupont Renovation' });

    const fields = await query<{ id: string; key: string }>(
      'SELECT id, key FROM team_fields WHERE team_id = $1', [teamId],
    );
    const fieldMap = Object.fromEntries(fields.rows.map((f) => [f.key, f.id]));

    await updateTeamField({ teamId, fieldId: fieldMap.siret!, value: '51234567800021' });
    await updateTeamField({ teamId, fieldId: fieldMap.address!, value: '8 rue du Moulin, 69001 Lyon' });
    await updateTeamField({ teamId, fieldId: fieldMap.tva_number!, value: 'FR51512345678' });

    // 8. Accept terms
    await acceptTerms({ teamId });

    // 9. Retry sending - should succeed
    const result = await updateQuoteStatusUc({ teamId, quoteId, status: 'sent' });
    expect(result.status).toBe('sent');
    expect(result.number).not.toContain('D-'); // Should have a real number now
  });

  it('returning user login does not create duplicate team', async () => {
    const email = `e2e-${generateId().slice(0, 8)}@test.com`;

    // First login - creates account
    const first = await verifyOtp({ email, code: '123456' });

    // Second login - returns same account
    const second = await verifyOtp({ email, code: '123456' });

    expect(second.auth.user.id).toBe(first.auth.user.id);
    expect(second.auth.team.id).toBe(first.auth.team.id);

    // Only one team
    const teams = await query('SELECT id FROM teams WHERE id = $1', [first.auth.team.id]);
    expect(teams.rows).toHaveLength(1);
  });
});
