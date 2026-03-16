import type { TeamSummary, TeamField } from '@tuldio/common';
import type { TeamRow } from './team.entity.js';

export function toTeamSummary(row: TeamRow, fields: TeamField[]): TeamSummary {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url || null,
    fields,
    quoteLastNumber: row.quote_last_number,
    quoteValidityDays: row.quote_validity_days,
    invoiceLastNumber: row.invoice_last_number,
    invoicePaymentDelayDays: row.invoice_payment_delay_days,
    termsAcceptedAt: row.terms_accepted_at?.toISOString() ?? null,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at?.toISOString() ?? null,
    subscriptionPeriodEnd: row.subscription_period_end?.toISOString() ?? null,
  };
}
