import type { TeamSummary } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { extractDocumentInfo } from '../../../lib/ai/extract-document.js';
import { extractLogoFromPdf } from '../../../lib/ai/extract-logo.js';
import { findTeamById } from '../repository/find-team-by-id.js';
import { findTeamFields } from '../repository/find-team-fields.js';
import { upsertTeamField } from '../repository/upsert-team-field.js';
import { toTeamSummary } from '../domain/team.view.js';
import { toTeamField } from '../domain/team-field.view.js';

// Mapping from extraction camelCase keys to DB field keys
const EXTRACTION_KEY_MAP: Record<string, string> = {
  name: 'name', // handled separately on teams table
  siret: 'siret',
  address: 'address',
  phone: 'phone',
  mobile: 'mobile',
  email: 'email',
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
};

export async function processTeamDocument(input: {
  teamId: string;
  filePath: string;
  mimeType: string;
  documentUrl: string;
}): Promise<TeamSummary> {
  const existing = await findTeamById(input.teamId);
  if (!existing) {
    throw new HandledError(errorCodes.teamNotFound);
  }

  const extractedFields = await extractDocumentInfo({
    filePath: input.filePath,
    mimeType: input.mimeType,
    teamId: input.teamId,
  });

  // Extract logo from PDF
  let logoUrl: string | null = null;
  if (input.mimeType === 'application/pdf') {
    logoUrl = await extractLogoFromPdf({
      filePath: input.filePath,
      teamId: input.teamId,
    });
  }

  // Get all current fields to find IDs
  const fieldRows = await findTeamFields(input.teamId);
  const fieldByKey = new Map(fieldRows.map((f) => [f.key, f]));

  // 1. Reset all field values to empty
  for (const row of fieldRows) {
    if (row.key === 'original_document_url') continue;
    const resetValue = row.key === 'tva_exempt' ? '' : '';
    await upsertTeamField({ teamId: input.teamId, fieldId: row.id, value: resetValue });
  }

  // 2. Update team name if extracted
  if (extractedFields.name) {
    const { updateTeamName } = await import('../repository/update-team.js');
    await updateTeamName({ teamId: input.teamId, name: extractedFields.name });
  }

  // 3. Apply extracted fields
  for (const [camelKey, value] of Object.entries(extractedFields)) {
    if (camelKey === 'name') continue; // already handled
    if (camelKey === 'customClauses') continue; // handled below

    const dbKey = EXTRACTION_KEY_MAP[camelKey];
    if (!dbKey) continue;

    const field = fieldByKey.get(dbKey);
    if (!field) continue;

    const strValue = typeof value === 'boolean'
      ? (value ? 'true' : '')
      : String(value);

    await upsertTeamField({ teamId: input.teamId, fieldId: field.id, value: strValue });
  }

  // 4. Handle custom clauses
  if (extractedFields.customClauses && Array.isArray(extractedFields.customClauses)) {
    const { insertTeamField } = await import('../repository/insert-team-field.js');
    for (let i = 0; i < extractedFields.customClauses.length; i++) {
      const clause = extractedFields.customClauses[i];
      if (typeof clause === 'string' && clause.trim()) {
        await insertTeamField({
          teamId: input.teamId,
          key: `custom_clause_${i + 1}`,
          label: `Clause personnalisee ${i + 1}`,
          value: clause,
          zone: 'legal',
          showQuote: true,
          showInvoice: true,
          sortOrder: 10 + i,
          isSystem: false,
        });
      }
    }
  }

  // 5. Set logo URL and original document URL on teams table
  {
    const { updateTeamMeta } = await import('../repository/update-team.js');
    await updateTeamMeta({
      teamId: input.teamId,
      logoUrl: logoUrl ?? undefined,
      originalDocumentUrl: input.documentUrl,
    });
  }

  // Return updated team
  const updatedTeam = await findTeamById(input.teamId);
  const updatedFields = await findTeamFields(input.teamId);
  return toTeamSummary(updatedTeam!, updatedFields.map(toTeamField));
}
