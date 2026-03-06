import type { UpdateTeamRequest } from '@tuldio/types';
import { query } from '../../../lib/database/db.js';
import type { TeamRow } from '../domain/team.entity.js';

const FIELD_MAP: Record<keyof UpdateTeamRequest, string> = {
  name: 'name',
  siret: 'siret',
  address: 'address',
  phone: 'phone',
  email: 'email',
  mobile: 'mobile',
  website: 'website',
  tvaNumber: 'tva_number',
  tvaExempt: 'tva_exempt',
  apeCode: 'ape_code',
  legalForm: 'legal_form',
  capitalSocial: 'capital_social',
  rcsCity: 'rcs_city',
  rmCity: 'rm_city',
  activityDescription: 'activity_description',
  insuranceCompany: 'insurance_company',
  insurancePolicyNumber: 'insurance_policy_number',
  insuranceCoverageZone: 'insurance_coverage_zone',
  paymentTerms: 'payment_terms',
  depositPercent: 'deposit_percent',
  earlyPaymentDiscount: 'early_payment_discount',
  latePenaltyRate: 'late_penalty_rate',
  recoveryFee: 'recovery_fee',
  customClauses: 'custom_clauses',
};

export async function updateTeam(input: {
  teamId: string;
} & UpdateTeamRequest): Promise<TeamRow> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [camelKey, dbColumn] of Object.entries(FIELD_MAP)) {
    const value = input[camelKey as keyof UpdateTeamRequest];
    if (value !== undefined) {
      fields.push(`${dbColumn} = $${idx++}`);
      params.push(camelKey === 'customClauses' ? JSON.stringify(value) : value);
    }
  }

  if (fields.length === 0) {
    const result = await query<TeamRow>(
      'SELECT * FROM teams WHERE id = $1',
      [input.teamId],
    );
    return result.rows[0]!;
  }

  params.push(input.teamId);
  const teamIdIdx = idx;

  const result = await query<TeamRow>(
    `UPDATE teams SET ${fields.join(', ')} WHERE id = $${teamIdIdx} RETURNING *`,
    params,
  );

  return result.rows[0]!;
}
