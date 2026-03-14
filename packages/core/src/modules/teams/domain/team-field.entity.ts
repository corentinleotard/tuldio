import { z } from 'zod';

export const teamFieldSchema = z.object({
  id: z.string(),
  team_id: z.string(),
  key: z.string(),
  label: z.string(),
  value: z.string(),
  zone: z.enum(['identity', 'payment', 'legal']),
  scope: z.enum(['both', 'quote', 'invoice']),
  show_quote: z.boolean(),
  show_invoice: z.boolean(),
  sort_order: z.number().int(),
  is_system: z.boolean(),
});

export type TeamFieldRow = z.infer<typeof teamFieldSchema>;

export type FieldZone = 'identity' | 'payment' | 'legal';
export type FieldScope = 'both' | 'quote' | 'invoice';

export interface SystemFieldDef {
  key: string;
  label: string;
  zone: FieldZone;
  scope: FieldScope;
  showQuote: boolean;
  showInvoice: boolean;
  sortOrder: number;
  defaultValue?: string;
}

/** Parse a field value as boolean (stored as 'true' / '' in team_fields) */
export function isFieldTrue(field: { value: string } | null | undefined): boolean {
  return field?.value === 'true';
}

export const SYSTEM_FIELDS: SystemFieldDef[] = [
  // identity — top-left company block on PDF
  { key: 'siret', label: 'SIRET', zone: 'identity', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 0 },
  { key: 'address', label: 'Adresse', zone: 'identity', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 1 },
  { key: 'phone', label: 'Telephone', zone: 'identity', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 2 },
  { key: 'mobile', label: 'Mobile', zone: 'identity', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 3 },
  { key: 'email', label: 'Email', zone: 'identity', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 4 },
  { key: 'website', label: 'Site web', zone: 'identity', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 5 },
  { key: 'tva_number', label: 'N TVA', zone: 'identity', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 6 },
  { key: 'tva_exempt', label: 'Exonere de TVA', zone: 'identity', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 7 },
  { key: 'activity_description', label: 'Activite', zone: 'identity', scope: 'both', showQuote: false, showInvoice: false, sortOrder: 8 },
  // payment — payment box on PDF
  { key: 'payment_terms', label: 'Conditions de paiement', zone: 'payment', scope: 'quote', showQuote: true, showInvoice: false, sortOrder: 0 },
  { key: 'iban', label: 'IBAN', zone: 'payment', scope: 'invoice', showQuote: false, showInvoice: true, sortOrder: 2 },
  // legal — bottom footer mentions on PDF
  { key: 'early_payment_discount', label: 'Escompte', zone: 'legal', scope: 'invoice', showQuote: false, showInvoice: true, sortOrder: 0, defaultValue: "Pas d'escompte pour paiement anticipe" },
  { key: 'late_penalty_rate', label: 'Penalites de retard', zone: 'legal', scope: 'invoice', showQuote: false, showInvoice: true, sortOrder: 1, defaultValue: 'Penalites de retard : 3 fois le taux d\'interet legal' },
  { key: 'recovery_fee', label: 'Indemnite de recouvrement', zone: 'legal', scope: 'invoice', showQuote: false, showInvoice: true, sortOrder: 2, defaultValue: 'Indemnité forfaitaire de recouvrement : 40,00 €' },
  { key: 'insurance_company', label: 'Assurance', zone: 'legal', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 3 },
  { key: 'insurance_policy_number', label: 'N police assurance', zone: 'legal', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 4 },
  { key: 'insurance_coverage_zone', label: 'Zone couverture assurance', zone: 'legal', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 5 },
  { key: 'legal_form', label: 'Forme juridique', zone: 'legal', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 6 },
  { key: 'capital_social', label: 'Capital social', zone: 'legal', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 7 },
  { key: 'rcs_city', label: 'Ville RCS', zone: 'legal', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 8 },
  { key: 'rm_city', label: 'Ville RM', zone: 'legal', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 9 },
  { key: 'ape_code', label: 'Code APE', zone: 'legal', scope: 'both', showQuote: true, showInvoice: true, sortOrder: 10 },
];
