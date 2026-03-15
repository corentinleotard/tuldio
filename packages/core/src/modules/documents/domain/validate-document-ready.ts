export type DocumentType = 'quote' | 'invoice';

/** Invoice-only mandatory team_field keys (French legal requirement since 2013) */
export const MANDATORY_INVOICE_FIELD_KEYS = ['early_payment_discount', 'late_penalty_rate', 'recovery_fee'] as const;

/** Quote-only mandatory team_field keys */
export const MANDATORY_QUOTE_FIELD_KEYS = ['payment_terms'] as const;

export interface DocumentReadyInput {
  documentType: DocumentType;
  team: {
    name: string;
  };
  teamFields: Array<{ key: string; value: string }>;
  client: {
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    siret: string | null;
    address: string | null;
  };
  lines: Array<{ description: string }>;
}

export interface DocumentReadyError {
  code: string;
  message: string;
}

/**
 * Validates that a document has all legally required fields before leaving draft.
 * This is the single source of truth for document readiness — called by both
 * quote and invoice status transition use-cases.
 *
 * French legal requirements:
 * - CGI art. 242 nonies A (invoices)
 * - Code de commerce L441-9 (quotes)
 */
export function validateDocumentReady(input: DocumentReadyInput): DocumentReadyError[] {
  const errors: DocumentReadyError[] = [];
  const { documentType, team, teamFields, client, lines } = input;

  const getFieldValue = (key: string): string | null => {
    const field = teamFields.find((f) => f.key === key);
    if (!field) return null;
    return field.value.trim() || null;
  };

  // --- Team (seller) mandatory fields ---

  if (!team.name.trim()) {
    errors.push({
      code: 'MISSING_TEAM_NAME',
      message: "Le nom de l'entreprise est requis",
    });
  }

  if (!getFieldValue('siret')) {
    errors.push({
      code: 'MISSING_TEAM_SIRET',
      message: "Le numéro SIRET de l'entreprise est requis",
    });
  }

  if (!getFieldValue('address')) {
    errors.push({
      code: 'MISSING_TEAM_ADDRESS',
      message: "L'adresse de l'entreprise est requise",
    });
  }

  // --- Client (buyer) mandatory fields ---

  if (!client.address?.trim()) {
    errors.push({
      code: 'MISSING_CLIENT_ADDRESS',
      message: "L'adresse du client est requise",
    });
  }

  // --- B2B: client SIRET required when company ---

  if (client.companyName?.trim() && !client.siret?.trim()) {
    errors.push({
      code: 'MISSING_CLIENT_SIRET',
      message: 'Le SIRET du client professionnel est requis',
    });
  }

  // --- Document lines ---

  if (lines.length === 0) {
    errors.push({
      code: 'MISSING_LINES',
      message: 'Le document doit contenir au moins une ligne',
    });
  }

  // --- TVA number required when not exempt (CGI art. 242 nonies A) ---

  const tvaExempt = getFieldValue('tva_exempt') === 'true';
  if (!tvaExempt && !getFieldValue('tva_number')) {
    errors.push({
      code: 'MISSING_TVA_NUMBER',
      message: "Le numéro de TVA intracommunautaire est requis (ou cochez 'Exonéré de TVA')",
    });
  }

  // --- Quote-specific mentions ---

  if (documentType === 'quote') {
    const quoteLabels: Record<string, { code: string; message: string }> = {
      payment_terms: { code: 'MISSING_PAYMENT_TERMS', message: 'Les conditions de paiement sont requises sur les devis' },
    };
    for (const key of MANDATORY_QUOTE_FIELD_KEYS) {
      if (!getFieldValue(key)) {
        errors.push(quoteLabels[key]!);
      }
    }
  }

  // --- Invoice-specific legal mentions (mandatory since 2013) ---

  if (documentType === 'invoice') {
    const invoiceLabels: Record<string, { code: string; message: string }> = {
      early_payment_discount: { code: 'MISSING_EARLY_PAYMENT_DISCOUNT', message: "La mention d'escompte est requise sur les factures" },
      late_penalty_rate: { code: 'MISSING_LATE_PENALTY_RATE', message: 'Les pénalités de retard sont requises sur les factures' },
      recovery_fee: { code: 'MISSING_RECOVERY_FEE', message: "L'indemnité de recouvrement est requise sur les factures" },
    };
    for (const key of MANDATORY_INVOICE_FIELD_KEYS) {
      if (!getFieldValue(key)) {
        errors.push(invoiceLabels[key]!);
      }
    }
  }

  return errors;
}
