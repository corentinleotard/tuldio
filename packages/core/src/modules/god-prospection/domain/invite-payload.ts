import type { InviteTokenPayload } from '../../auth/domain/invite-token.js';

const INVITE_EXPIRY_DAYS = 30;

/** Build a standardized invite payload from prospect data */
export function buildInvitePayload(input: {
  fullName: string;
  firstName: string;
  phone: string | null;
  website: string | null;
  profession: string;
}): { payload: Omit<InviteTokenPayload, 'exp'>; expiresAt: Date } {
  const capitalize = (w: string) =>
    w.toLowerCase().replace(/(^|[-' ])(\w)/g, (_, sep: string, c: string) => sep + c.toUpperCase());

  return {
    payload: {
      name: input.fullName.split(' ').map(capitalize).join(' '),
      address: null,
      phone: input.phone,
      website: input.website,
      profession: input.profession,
      firstName: input.firstName || null,
    },
    expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  };
}
