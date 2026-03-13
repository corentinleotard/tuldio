import type { TeamFieldRow } from '../../teams/domain/team-field.entity.js';

export type DocumentType = 'quote' | 'invoice';

export interface DocumentReadyInput {
  documentType: DocumentType;
  team: {
    name: string;
  };
  teamFields: TeamFieldRow[];
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

  // --- Invoice-specific legal mentions (mandatory since 2013) ---

  if (documentType === 'invoice') {
    if (!getFieldValue('early_payment_discount')) {
      errors.push({
        code: 'MISSING_EARLY_PAYMENT_DISCOUNT',
        message: "La mention d'escompte est requise sur les factures",
      });
    }

    if (!getFieldValue('late_penalty_rate')) {
      errors.push({
        code: 'MISSING_LATE_PENALTY_RATE',
        message: 'Les pénalités de retard sont requises sur les factures',
      });
    }

    if (!getFieldValue('recovery_fee')) {
      errors.push({
        code: 'MISSING_RECOVERY_FEE',
        message: "L'indemnité de recouvrement est requise sur les factures",
      });
    }
  }

  return errors;
}
