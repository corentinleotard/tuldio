import type { DocumentReadyError } from './validate-document-ready.js';

const TEAM_ERROR_CODES = new Set([
  'MISSING_TEAM_NAME',
  'MISSING_TEAM_SIRET',
  'MISSING_TEAM_ADDRESS',
  'MISSING_TVA_NUMBER',
  'MISSING_EARLY_PAYMENT_DISCOUNT',
  'MISSING_LATE_PENALTY_RATE',
  'MISSING_RECOVERY_FEE',
  'MISSING_PAYMENT_TERMS',
]);

const CLIENT_ERROR_CODES = new Set([
  'MISSING_CLIENT_ADDRESS',
  'MISSING_CLIENT_SIRET',
]);

export interface CategorizedErrors {
  teamErrors: DocumentReadyError[];
  clientErrors: DocumentReadyError[];
  documentErrors: DocumentReadyError[];
}

export function categorizeReadinessErrors(input: { errors: DocumentReadyError[] }): CategorizedErrors {
  const teamErrors: DocumentReadyError[] = [];
  const clientErrors: DocumentReadyError[] = [];
  const documentErrors: DocumentReadyError[] = [];

  for (const error of input.errors) {
    if (TEAM_ERROR_CODES.has(error.code)) {
      teamErrors.push(error);
    } else if (CLIENT_ERROR_CODES.has(error.code)) {
      clientErrors.push(error);
    } else {
      documentErrors.push(error);
    }
  }

  return { teamErrors, clientErrors, documentErrors };
}
