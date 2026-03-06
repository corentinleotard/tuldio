import type { TeamSummary } from '@tuldio/types';
import type { TeamRow } from './team.entity.js';

export function toTeamSummary(row: TeamRow): TeamSummary {
  return {
    id: row.id,
    name: row.name,
    siret: row.siret,
    address: row.address,
    phone: row.phone,
    email: row.email,
    mobile: row.mobile,
    website: row.website,
    logoUrl: row.logo_url,
    tvaNumber: row.tva_number,
    tvaExempt: row.tva_exempt,
    apeCode: row.ape_code,
    legalForm: row.legal_form,
    capitalSocial: row.capital_social,
    rcsCity: row.rcs_city,
    rmCity: row.rm_city,
    activityDescription: row.activity_description,
    insuranceCompany: row.insurance_company,
    insurancePolicyNumber: row.insurance_policy_number,
    insuranceCoverageZone: row.insurance_coverage_zone,
    paymentTerms: row.payment_terms,
    depositPercent: row.deposit_percent,
    earlyPaymentDiscount: row.early_payment_discount,
    latePenaltyRate: row.late_penalty_rate,
    recoveryFee: row.recovery_fee,
    customClauses: row.custom_clauses,
    originalDocumentUrl: row.original_document_url,
    termsAcceptedAt: row.terms_accepted_at?.toISOString() ?? null,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at?.toISOString() ?? null,
  };
}
