import type { TeamSummary, TeamField } from '@tuldio/types';
import type { TeamRow } from './team.entity.js';

export function toTeamSummary(row: TeamRow, fields: TeamField[]): TeamSummary {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url || null,
    fields,
    termsAcceptedAt: row.terms_accepted_at?.toISOString() ?? null,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at?.toISOString() ?? null,
  };
}
