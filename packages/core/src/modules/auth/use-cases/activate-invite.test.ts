import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { signInviteToken } from '../domain/invite-token.js';
import { activateInvite } from './activate-invite.js';

const SECRET = process.env.INVITE_JWT_SECRET || 'dev-invite-secret-change-in-production';

function makeToken(overrides?: Partial<{ name: string; address: string | null; phone: string | null; website: string | null; profession: string | null; firstName: string | null; expiresInDays: number }>) {
  return signInviteToken({
    payload: {
      name: overrides?.name ?? `Cabinet ${generateId().slice(0, 8)}`,
      address: '12 rue du Dr Finlay, 75015 Paris',
      phone: '01 45 67 89 10',
      website: 'osteo-paris15.fr',
      profession: 'Ostéopathe',
      firstName: 'Claire',
      ...overrides,
    },
    secret: SECRET,
    expiresInDays: overrides?.expiresInDays ?? 30,
  });
}

describe('activateInvite', () => {
  it('creates user + team for a valid token', async () => {
    const token = makeToken({ name: 'Cabinet Test' });

    const result = await activateInvite({ token });

    expect(result.auth.user.name).toBe('Claire');
    expect(result.auth.user.email).toBeNull();
    expect(result.auth.user.role).toBe('owner');
    expect(result.auth.team.name).toBe('Cabinet Test');
    expect(result.refreshToken).toBeTruthy();
  });

  it('pre-fills team fields from token data', async () => {
    const token = makeToken({
      address: '99 avenue des Champs, 75008 Paris',
      phone: '01 99 88 77 66',
      website: 'example.fr',
    });

    const result = await activateInvite({ token });

    const fields = await query<{ key: string; value: string }>(
      'SELECT key, value FROM team_fields WHERE team_id = $1 AND value != \'\'',
      [result.auth.team.id],
    );
    const fieldMap = Object.fromEntries(fields.rows.map((f) => [f.key, f.value]));

    expect(fieldMap.address).toBe('99 avenue des Champs, 75008 Paris');
    expect(fieldMap.phone).toBe('01 99 88 77 66');
    expect(fieldMap.website).toBe('example.fr');
  });

  it('sets subscription_status to null (trial starts on first message)', async () => {
    const token = makeToken();

    const result = await activateInvite({ token });

    const team = await query<{ subscription_status: string | null }>(
      'SELECT subscription_status FROM teams WHERE id = $1',
      [result.auth.team.id],
    );
    expect(team.rows[0]!.subscription_status).toBeNull();
  });

  it('creates a welcome message', async () => {
    const token = makeToken();

    const result = await activateInvite({ token });

    const messages = await query<{ content: string; role: string }>(
      'SELECT content, role FROM messages WHERE user_id = $1',
      [result.auth.user.id],
    );
    expect(messages.rows).toHaveLength(1);
    expect(messages.rows[0]!.role).toBe('assistant');
    expect(messages.rows[0]!.content).toContain('Claire');
  });

  it('returns same user on second activation (same token)', async () => {
    const token = makeToken();

    const first = await activateInvite({ token });
    const second = await activateInvite({ token });

    expect(second.auth.user.id).toBe(first.auth.user.id);
    expect(second.auth.team.id).toBe(first.auth.team.id);
  });

  it('does NOT create duplicate team on second activation', async () => {
    const token = makeToken();

    const first = await activateInvite({ token });
    await activateInvite({ token });

    // Only one user exists for this team
    const users = await query<{ id: string }>('SELECT id FROM users WHERE team_id = $1', [first.auth.team.id]);
    expect(users.rows).toHaveLength(1);
  });

  it('returns fresh refresh token on second activation', async () => {
    const token = makeToken();

    const first = await activateInvite({ token });
    const second = await activateInvite({ token });

    expect(second.refreshToken).not.toBe(first.refreshToken);
  });

  it('rejects expired token', async () => {
    const token = makeToken({ expiresInDays: -1 });

    await expect(activateInvite({ token })).rejects.toThrow("Lien d'invitation invalide ou expiré");
  });

  it('rejects malformed token', async () => {
    await expect(activateInvite({ token: 'not-a-jwt' })).rejects.toThrow("Lien d'invitation invalide ou expiré");
  });

  it('rejects empty token', async () => {
    await expect(activateInvite({ token: '' })).rejects.toThrow("Lien d'invitation invalide ou expiré");
  });

  it('creates user without email', async () => {
    const token = makeToken();

    const result = await activateInvite({ token });

    const user = await query<{ email: string | null }>(
      'SELECT email FROM users WHERE id = $1',
      [result.auth.user.id],
    );
    expect(user.rows[0]!.email).toBeNull();
  });

  it('uses firstName from token as user name', async () => {
    const token = makeToken({ firstName: 'Marie' });

    const result = await activateInvite({ token });

    expect(result.auth.user.name).toBe('Marie');
  });

  it('falls back to first word of name when firstName is null', async () => {
    const token = makeToken({ firstName: null, name: 'Plomberie Leblanc' });

    const result = await activateInvite({ token });

    expect(result.auth.user.name).toBe('Plomberie');
  });

  it('stores invite_accounts mapping', async () => {
    const token = makeToken();

    const result = await activateInvite({ token });

    const accounts = await query<{ user_id: string; expires_at: Date }>(
      'SELECT user_id, expires_at FROM invite_accounts WHERE user_id = $1',
      [result.auth.user.id],
    );
    expect(accounts.rows).toHaveLength(1);
    expect(accounts.rows[0]!.user_id).toBe(result.auth.user.id);
    expect(accounts.rows[0]!.expires_at).toBeTruthy();
  });
});
