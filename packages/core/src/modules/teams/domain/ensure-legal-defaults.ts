import { SYSTEM_FIELDS } from './team-field.entity.js';
import { MANDATORY_INVOICE_FIELD_KEYS, MANDATORY_QUOTE_FIELD_KEYS } from '../../documents/domain/validate-document-ready.js';

/** Returns the legal default value for a system field key */
export function getLegalDefault(key: string): string | null {
  const field = SYSTEM_FIELDS.find((f) => f.key === key);
  return field?.defaultValue ?? null;
}

/** All mandatory field keys that have a default value (invoice + quote) */
const ALL_MANDATORY_KEYS_WITH_DEFAULTS = [...MANDATORY_INVOICE_FIELD_KEYS, ...MANDATORY_QUOTE_FIELD_KEYS] as const;

/**
 * Given the current team fields, returns a list of { fieldId, key, defaultValue }
 * for mandatory fields that are currently empty and need restoring.
 */
export function findMissingLegalDefaults(fields: Array<{ id: string; key: string; value: string }>): Array<{
  fieldId: string;
  key: string;
  defaultValue: string;
}> {
  const missing: Array<{ fieldId: string; key: string; defaultValue: string }> = [];

  for (const key of ALL_MANDATORY_KEYS_WITH_DEFAULTS) {
    const field = fields.find((f) => f.key === key);
    if (!field) continue;
    if (field.value.trim()) continue;

    const defaultValue = getLegalDefault(key);
    if (!defaultValue) continue;

    missing.push({ fieldId: field.id, key, defaultValue });
  }

  return missing;
}
