/**
 * End-to-end test: Token invite flow
 *
 * Simulates: prospect clicks invite link -> creates account -> sends first message (trial starts)
 * -> creates a draft quote -> tries to send it -> gets COMPANY_INFO_REQUIRED
 * -> fills company info -> accepts terms -> retries send -> succeeds
 */
import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { signInviteToken } from '../domain/invite-token.js';
import { activateInvite } from './activate-invite.js';
import { activateTrial } from '../../subscriptions/use-cases/activate-trial.js';
import { updateQuoteStatusUc } from '../../quotes/use-cases/update-quote-status-uc.js';
import { acceptTerms } from '../../teams/use-cases/accept-terms.js';
import { updateTeamField } from '../../teams/use-cases/update-team-field.js';
import { updateTeam } from '../../teams/use-cases/update-team.js';

const SECRET = process.env.INVITE_JWT_SECRET || 'dev-invite-secret-change-in-production';

function makeToken() {
  return signInviteToken({
    payload: {
      name: 'Cabinet Durand',
      address: '12 rue du Dr Finlay, 75015 Paris',
      phone: '01 45 67 89 10',
      website: 'osteo-paris15.fr',
      profession: 'Ostéopathe',
      firstName: 'Claire',
    },
    secret: SECRET,
    expiresInDays: 30,
  });
}

async function insertQuoteForTeam(teamId: string, userId: string) {
  const clientId = generateId();
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name, address)
     VALUES ($1, $2, 'Jean', 'Martin', '5 rue des Lilas, 75011 Paris')`,
    [clientId, teamId],
  );

  const quoteId = generateId();
  await query(
    `INSERT INTO quotes (id, team_id, created_by, client_id, number, total_ht, total_ttc, status, pdf_url)
     VALUES ($1, $2, $3, $4, $5, 18000, 18000, 'draft', '/files/pdfs/test.pdf')`,
    [quoteId, teamId, userId, clientId, `D-${generateId().slice(0, 8)}`],
  );
  await query(
    `INSERT INTO quote_lines (id, quote_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
     VALUES ($1, $2, 1, 'Séance ostéopathie', 3, 'u', 6000, 0, 18000)`,
    [generateId(), quoteId],
  );

  return quoteId;
}

describe('invite flow e2e', () => {
  it('full flow: token -> account -> trial -> draft -> company info required -> fill -> send', async () => {
    // 1. Prospect clicks invite link
    const token = makeToken();
    const { auth } = await activateInvite({ token });

    expect(auth.user.name).toBe('Claire');
    expect(auth.user.email).toBeNull();
    expect(auth.team.name).toBe('Cabinet Durand');

    const teamId = auth.team.id;
    const userId = auth.user.id;

    // 2. Verify subscription_status is null (no trial yet)
    const subBefore = await query<{ subscription_status: string | null }>(
      'SELECT subscription_status FROM teams WHERE id = $1', [teamId],
    );
    expect(subBefore.rows[0]!.subscription_status).toBeNull();

    // 3. First message activates trial
    await activateTrial({ teamId });

    const subAfter = await query<{ subscription_status: string | null }>(
      'SELECT subscription_status FROM teams WHERE id = $1', [teamId],
    );
    expect(subAfter.rows[0]!.subscription_status).toBe('trial');

    // 4. Create a draft quote
    const quoteId = await insertQuoteForTeam(teamId, userId);

    // 5. Try to send it - should fail with COMPANY_INFO_REQUIRED (missing SIRET, TVA)
    try {
      await updateQuoteStatusUc({ teamId, quoteId, status: 'sent' });
      expect.fail('Should have thrown COMPANY_INFO_REQUIRED');
    } catch (err: unknown) {
      const error = err as { code: string; details: Array<{ code: string }> };
      expect(error.code).toBe('COMPANY_INFO_REQUIRED');
      const codes = error.details.map((d) => d.code);
      expect(codes).toContain('MISSING_TEAM_SIRET');
    }

    // 6. Fill missing company info (simulate modal step 1)
    const fields = await query<{ id: string; key: string }>(
      'SELECT id, key FROM team_fields WHERE team_id = $1', [teamId],
    );
    const fieldMap = Object.fromEntries(fields.rows.map((f) => [f.key, f.id]));

    // Update team name (already set from token, but make sure it's not empty)
    await updateTeam({ teamId, name: 'Cabinet Durand Ostéopathie' });

    // Fill SIRET
    await updateTeamField({ teamId, fieldId: fieldMap.siret!, value: '82345678900014' });

    // Fill TVA number
    await updateTeamField({ teamId, fieldId: fieldMap.tva_number!, value: 'FR82823456789' });

    // Fill payment_terms (required for quotes)
    await updateTeamField({ teamId, fieldId: fieldMap.payment_terms!, value: 'Paiement à réception' });

    // 7. Accept terms (triggers ensure-legal-defaults)
    await acceptTerms({ teamId });

    // Verify terms_accepted_at is set
    const teamAfter = await query<{ terms_accepted_at: Date | null }>(
      'SELECT terms_accepted_at FROM teams WHERE id = $1', [teamId],
    );
    expect(teamAfter.rows[0]!.terms_accepted_at).not.toBeNull();

    // 8. Retry sending - should succeed now
    const result = await updateQuoteStatusUc({ teamId, quoteId, status: 'sent' });
    expect(result.status).toBe('sent');
  });

  it('second click on same token returns same account', async () => {
    const token = makeToken();

    const first = await activateInvite({ token });
    const second = await activateInvite({ token });

    expect(second.auth.user.id).toBe(first.auth.user.id);
    expect(second.auth.team.id).toBe(first.auth.team.id);

    // Only one user exists for this team
    const users = await query('SELECT id FROM users WHERE team_id = $1', [first.auth.team.id]);
    expect(users.rows).toHaveLength(1);
  });
});
