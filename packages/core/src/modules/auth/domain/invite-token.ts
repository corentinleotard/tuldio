import crypto from 'node:crypto';

export interface InviteTokenPayload {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  profession: string | null;
  firstName: string | null;
  exp: number;
}

/**
 * Decode and verify an invite JWT token (HS256).
 * Uses Node built-in crypto to avoid adding jsonwebtoken as a core dependency.
 */
export function decodeInviteToken(input: { token: string; secret: string }): InviteTokenPayload {
  const parts = input.token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const expectedSignature = crypto
    .createHmac('sha256', input.secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  if (signatureB64 !== expectedSignature) {
    throw new Error('Invalid token signature');
  }

  const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
  const payload = JSON.parse(payloadJson) as Record<string, unknown>;

  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  if (Date.now() / 1000 > exp) {
    throw new Error('Token expired');
  }

  return {
    name: typeof payload.name === 'string' ? payload.name : '',
    address: typeof payload.address === 'string' ? payload.address : null,
    phone: typeof payload.phone === 'string' ? payload.phone : null,
    website: typeof payload.website === 'string' ? payload.website : null,
    profession: typeof payload.profession === 'string' ? payload.profession : null,
    firstName: typeof payload.firstName === 'string' ? payload.firstName : null,
    exp,
  };
}

/**
 * Create a signed invite JWT token (for use in the prospection script).
 */
export function signInviteToken(input: {
  payload: Omit<InviteTokenPayload, 'exp'>;
  secret: string;
  expiresInDays: number;
}): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    ...input.payload,
    exp: Math.floor(Date.now() / 1000) + input.expiresInDays * 24 * 60 * 60,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', input.secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Hash a token for DB lookups (deterministic).
 */
export function hashInviteToken(input: { token: string }): string {
  return crypto.createHash('sha256').update(input.token).digest('hex');
}
