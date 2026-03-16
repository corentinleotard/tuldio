import type { TeamSummary } from '@tuldio/common';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { extractDocumentInfo } from '../../../lib/ai/extract-document.js';
import { extractLogoFromPdf } from '../../../lib/ai/extract-logo.js';
import { findTeamById } from '../repository/find-team-by-id.js';
import { findTeamFields } from '../repository/find-team-fields.js';
import { upsertTeamField } from '../repository/upsert-team-field.js';
import { updateTeamName, updateTeamMeta } from '../repository/update-team.js';
import { insertTeamField } from '../repository/insert-team-field.js';
import { findMissingLegalDefaults } from '../domain/ensure-legal-defaults.js';
import { toTeamSummary } from '../domain/team.view.js';
import { toTeamField } from '../domain/team-field.view.js';

// Mapping from extraction camelCase keys to DB field keys
const CAMEL_TO_DB: Record<string, string> = {
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
  earlyPaymentDiscount: 'early_payment_discount',
  latePenaltyRate: 'late_penalty_rate',
  recoveryFee: 'recovery_fee',
};

// Reverse mapping: DB field key → camelCase extraction key
const DB_TO_CAMEL = new Map(Object.entries(CAMEL_TO_DB).map(([camel, db]) => [db, camel]));

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

  // Build set of extracted DB keys
  const extractedDbKeys = new Set<string>();
  for (const camelKey of Object.keys(extractedFields)) {
    const dbKey = CAMEL_TO_DB[camelKey];
    if (dbKey) extractedDbKeys.add(dbKey);
  }

  // 1. Update team name if extracted
  if (extractedFields.name) {
    await updateTeamName({ teamId: input.teamId, name: extractedFields.name });
  }

  // 2. Apply extracted fields (reset-then-apply in one pass, skip empty overwrites)
  for (const row of fieldRows) {
    if (!extractedDbKeys.has(row.key)) continue;

    // Find the extracted value for this DB key
    const camelKey = DB_TO_CAMEL.get(row.key);
    if (!camelKey || camelKey === 'name') continue;

    const rawValue = extractedFields[camelKey as keyof typeof extractedFields];
    const strValue = rawValue === undefined ? ''
      : typeof rawValue === 'boolean' ? (rawValue ? 'true' : '')
      : String(rawValue);

    // Never overwrite a non-empty value with empty — protects seeded defaults
    if (!strValue && row.value) continue;

    await upsertTeamField({ teamId: input.teamId, fieldId: row.id, value: strValue });
  }

  // 3. Handle custom clauses
  if (extractedFields.customClauses && Array.isArray(extractedFields.customClauses)) {
    for (let i = 0; i < extractedFields.customClauses.length; i++) {
      const clause = extractedFields.customClauses[i];
      if (typeof clause === 'string' && clause.trim()) {
        await insertTeamField({
          teamId: input.teamId,
          key: `custom_clause_${i + 1}`,
          label: `Clause personnalisee ${i + 1}`,
          value: clause,
          zone: 'legal',
          scope: 'both',
          showQuote: true,
          showInvoice: true,
          sortOrder: 10 + i,
          isSystem: false,
        });
      }
    }
  }

  // 4. Set logo URL and original document URL on teams table
  {
    await updateTeamMeta({
      teamId: input.teamId,
      logoUrl: logoUrl ?? undefined,
      originalDocumentUrl: input.documentUrl,
    });
  }

  logger.info('team.document_processed', { teamId: input.teamId, mimeType: input.mimeType, logoExtracted: !!logoUrl });

  // 5. Ensure mandatory invoice legal fields have values (restore defaults if wiped)
  const updatedFields = await findTeamFields(input.teamId);
  const missingDefaults = findMissingLegalDefaults(updatedFields);
  for (const { fieldId, defaultValue } of missingDefaults) {
    await upsertTeamField({ teamId: input.teamId, fieldId, value: defaultValue });
  }

  // Return updated team
  const updatedTeam = await findTeamById(input.teamId);
  const finalFields = missingDefaults.length > 0 ? await findTeamFields(input.teamId) : updatedFields;
  return toTeamSummary(updatedTeam!, finalFields.map(toTeamField));
}
