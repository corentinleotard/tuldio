import { describe, it, expect } from 'vitest';
import { decodeInviteToken, signInviteToken, hashInviteToken } from './invite-token.js';

const SECRET = 'test-secret-for-invite-tokens-32chars';

function makeValidToken(overrides?: Partial<{ name: string; address: string | null; phone: string | null; website: string | null; profession: string | null; firstName: string | null }>) {
  return signInviteToken({
    payload: {
      name: 'Cabinet Durand',
      address: '12 rue du Dr Finlay, 75015 Paris',
      phone: '01 45 67 89 10',
      website: 'osteo-paris15.fr',
      profession: 'Ostéopathe',
      firstName: 'Claire',
      ...overrides,
    },
    secret: SECRET,
    expiresInDays: 30,
  });
}

describe('signInviteToken + decodeInviteToken', () => {
  it('encodes and decodes a valid token', () => {
    const token = makeValidToken();
    const payload = decodeInviteToken({ token, secret: SECRET });

    expect(payload.name).toBe('Cabinet Durand');
    expect(payload.address).toBe('12 rue du Dr Finlay, 75015 Paris');
    expect(payload.phone).toBe('01 45 67 89 10');
    expect(payload.website).toBe('osteo-paris15.fr');
    expect(payload.profession).toBe('Ostéopathe');
    expect(payload.firstName).toBe('Claire');
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('handles null optional fields', () => {
    const token = makeValidToken({ address: null, phone: null, website: null, profession: null, firstName: null });
    const payload = decodeInviteToken({ token, secret: SECRET });

    expect(payload.name).toBe('Cabinet Durand');
    expect(payload.address).toBeNull();
    expect(payload.phone).toBeNull();
    expect(payload.website).toBeNull();
    expect(payload.profession).toBeNull();
    expect(payload.firstName).toBeNull();
  });

  it('handles unicode characters (accents)', () => {
    const token = makeValidToken({ name: 'Léotard Ostéopathie', firstName: 'Héloïse' });
    const payload = decodeInviteToken({ token, secret: SECRET });

    expect(payload.name).toBe('Léotard Ostéopathie');
    expect(payload.firstName).toBe('Héloïse');
  });

  it('rejects token with wrong secret', () => {
    const token = makeValidToken();
    expect(() => decodeInviteToken({ token, secret: 'wrong-secret' })).toThrow('Invalid token signature');
  });

  it('rejects expired token', () => {
    const token = signInviteToken({
      payload: { name: 'Expired', address: null, phone: null, website: null, profession: null, firstName: null },
      secret: SECRET,
      expiresInDays: -1,
    });
    expect(() => decodeInviteToken({ token, secret: SECRET })).toThrow('Token expired');
  });

  it('rejects malformed token (not 3 parts)', () => {
    expect(() => decodeInviteToken({ token: 'not-a-jwt', secret: SECRET })).toThrow('Invalid token format');
    expect(() => decodeInviteToken({ token: 'a.b', secret: SECRET })).toThrow('Invalid token format');
    expect(() => decodeInviteToken({ token: '', secret: SECRET })).toThrow('Invalid token format');
  });

  it('rejects truncated token (valid format but corrupt payload)', () => {
    const token = makeValidToken();
    const parts = token.split('.');
    const corrupted = `${parts[0]}.${parts[1]!.slice(0, 10)}.${parts[2]}`;
    expect(() => decodeInviteToken({ token: corrupted, secret: SECRET })).toThrow();
  });
});

describe('hashInviteToken', () => {
  it('produces deterministic hash', () => {
    const token = makeValidToken();
    const hash1 = hashInviteToken({ token });
    const hash2 = hashInviteToken({ token });
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different tokens', () => {
    const token1 = makeValidToken({ name: 'A' });
    const token2 = makeValidToken({ name: 'B' });
    expect(hashInviteToken({ token: token1 })).not.toBe(hashInviteToken({ token: token2 }));
  });

  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = hashInviteToken({ token: 'anything' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
