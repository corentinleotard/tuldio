import { describe, it, expect } from 'vitest';
import { categorizeReadinessErrors } from './categorize-readiness-errors.js';
import type { DocumentReadyError } from './validate-document-ready.js';

function err(code: string): DocumentReadyError {
  return { code, message: `Error: ${code}` };
}

describe('categorizeReadinessErrors', () => {
  it('categorizes team errors', () => {
    const result = categorizeReadinessErrors({
      errors: [
        err('MISSING_TEAM_NAME'),
        err('MISSING_TEAM_SIRET'),
        err('MISSING_TEAM_ADDRESS'),
        err('MISSING_TVA_NUMBER'),
      ],
    });

    expect(result.teamErrors).toHaveLength(4);
    expect(result.clientErrors).toHaveLength(0);
    expect(result.documentErrors).toHaveLength(0);
  });

  it('categorizes client errors', () => {
    const result = categorizeReadinessErrors({
      errors: [err('MISSING_CLIENT_ADDRESS'), err('MISSING_CLIENT_SIRET')],
    });

    expect(result.teamErrors).toHaveLength(0);
    expect(result.clientErrors).toHaveLength(2);
    expect(result.documentErrors).toHaveLength(0);
  });

  it('categorizes document errors (lines)', () => {
    const result = categorizeReadinessErrors({
      errors: [err('MISSING_LINES')],
    });

    expect(result.teamErrors).toHaveLength(0);
    expect(result.clientErrors).toHaveLength(0);
    expect(result.documentErrors).toHaveLength(1);
  });

  it('categorizes legal mention errors as team errors', () => {
    const result = categorizeReadinessErrors({
      errors: [
        err('MISSING_EARLY_PAYMENT_DISCOUNT'),
        err('MISSING_LATE_PENALTY_RATE'),
        err('MISSING_RECOVERY_FEE'),
        err('MISSING_PAYMENT_TERMS'),
      ],
    });

    expect(result.teamErrors).toHaveLength(4);
    expect(result.clientErrors).toHaveLength(0);
    expect(result.documentErrors).toHaveLength(0);
  });

  it('splits mixed errors correctly', () => {
    const result = categorizeReadinessErrors({
      errors: [
        err('MISSING_TEAM_NAME'),
        err('MISSING_CLIENT_ADDRESS'),
        err('MISSING_LINES'),
        err('MISSING_TVA_NUMBER'),
      ],
    });

    expect(result.teamErrors).toHaveLength(2);
    expect(result.clientErrors).toHaveLength(1);
    expect(result.documentErrors).toHaveLength(1);
  });

  it('returns empty arrays for empty input', () => {
    const result = categorizeReadinessErrors({ errors: [] });

    expect(result.teamErrors).toHaveLength(0);
    expect(result.clientErrors).toHaveLength(0);
    expect(result.documentErrors).toHaveLength(0);
  });
});
