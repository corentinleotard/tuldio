import fs from 'node:fs';
import type Anthropic from '@anthropic-ai/sdk';
import { callClaude } from './claude-client.js';
import { logger } from '../infra/logger.js';

export interface ExtractedFields {
  name?: string;
  siret?: string;
  address?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  tvaNumber?: string;
  tvaExempt?: boolean;
  apeCode?: string;
  legalForm?: string;
  capitalSocial?: number;
  rcsCity?: string;
  rmCity?: string;
  activityDescription?: string;
  insuranceCompany?: string;
  insurancePolicyNumber?: string;
  insuranceCoverageZone?: string;
  paymentTerms?: string;
  earlyPaymentDiscount?: string;
  latePenaltyRate?: string;
  recoveryFee?: string;
  customClauses?: string[];
}

const EXTRACTION_PROMPT = `Tu es un assistant qui extrait les informations d'entreprise à partir de documents professionnels français (devis, factures).
Analyse le document fourni et extrais les informations de l'entreprise ÉMETTRICE (celle qui a créé le document, PAS le client destinataire).

RÈGLE ABSOLUE : Extrais UNIQUEMENT les informations qui sont EXPLICITEMENT ÉCRITES sur le document.
- Si une information n'apparaît PAS textuellement sur le document, mets null.
- Ne déduis JAMAIS une information. Ne complète JAMAIS à partir du SIRET, de l'adresse ou d'autres champs.
- Ne devine JAMAIS une ville RCS/RM à partir de l'adresse postale.
- Ne génère JAMAIS un numéro de TVA à partir du SIRET.
- Si tu n'es pas sûr à 100% qu'un texte correspond à un champ, mets null.

Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après.

{
  "name": "Nom de l'entreprise",
  "siret": "Numéro SIRET (14 chiffres sans espaces)",
  "address": "Adresse complète",
  "phone": "Téléphone fixe",
  "mobile": "Téléphone mobile",
  "email": "Email de contact",
  "website": "Site web",
  "tvaNumber": "Numéro de TVA intracommunautaire",
  "tvaExempt": false,
  "apeCode": "Code APE/NAF",
  "legalForm": "Forme juridique (SARL, SAS, EI, auto-entrepreneur, etc.)",
  "capitalSocial": null,
  "rcsCity": "Ville d'immatriculation RCS (UNIQUEMENT si 'RCS xxx' est écrit sur le document)",
  "rmCity": "Ville d'immatriculation RM (UNIQUEMENT si 'RM xxx' est écrit sur le document)",
  "activityDescription": "Description de l'activité (UNIQUEMENT si explicitement mentionnée)",
  "insuranceCompany": "Nom de l'assurance décennale/RC pro",
  "insurancePolicyNumber": "Numéro de police d'assurance",
  "insuranceCoverageZone": "Zone de couverture géographique de l'assurance",
  "paymentTerms": "Conditions de paiement (texte complet)",
  "earlyPaymentDiscount": "Conditions d'escompte",
  "latePenaltyRate": "Taux de pénalités de retard",
  "recoveryFee": "Texte exact de la mention d'indemnité de recouvrement",
  "customClauses": []
}

Règles de format :
- "siret" : 14 chiffres sans espaces, UNIQUEMENT si le numéro est écrit sur le document
- "tvaExempt" : true UNIQUEMENT si "TVA non applicable, art. 293 B du CGI" ou formulation équivalente est écrite
- "tvaNumber" : UNIQUEMENT si un numéro commençant par "FR" est écrit sur le document
- "capitalSocial" : montant en centimes d'euros, entier (ex: 1000000 pour 10 000 €)
- "recoveryFee" : texte exact tel qu'écrit sur le document (ex: "Indemnité forfaitaire de recouvrement : 40 €")
- "customClauses" : tableau de clauses spécifiques trouvées sur le document
- Extrais UNIQUEMENT les infos de l'émetteur, jamais du client`;

const ALLOWED_KEYS: (keyof ExtractedFields)[] = [
  'name', 'siret', 'address', 'phone', 'email', 'mobile', 'website',
  'tvaNumber', 'tvaExempt', 'apeCode', 'legalForm', 'capitalSocial',
  'rcsCity', 'rmCity', 'activityDescription',
  'insuranceCompany', 'insurancePolicyNumber', 'insuranceCoverageZone',
  'paymentTerms', 'earlyPaymentDiscount',
  'latePenaltyRate', 'recoveryFee', 'customClauses',
];

export async function extractDocumentInfo(input: {
  filePath: string;
  mimeType: string;
  teamId: string;
}): Promise<ExtractedFields> {
  const fileBuffer = fs.readFileSync(input.filePath);
  const base64Data = fileBuffer.toString('base64');

  const isImage = input.mimeType.startsWith('image/');

  const contentBlock: Anthropic.ContentBlockParam = isImage
    ? {
        type: 'image',
        source: {
          type: 'base64',
          media_type: input.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data: base64Data,
        },
      }
    : {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf' as const,
          data: base64Data,
        },
      };

  const { message: response } = await callClaude({
    systemPrompt: EXTRACTION_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          contentBlock,
          {
            type: 'text',
            text: "Extrais les informations de l'entreprise émettrice de ce document.",
          },
        ],
      },
    ],
    teamId: input.teamId,
    purpose: 'document_extraction',
  });

  const textContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  try {
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('No JSON found in extraction response', { text: textContent });
      return {};
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const fields: ExtractedFields = {};
    for (const key of ALLOWED_KEYS) {
      const value = parsed[key];
      if (value !== null && value !== undefined && value !== '') {
        (fields as Record<string, unknown>)[key] = value;
      }
    }

    return fields;
  } catch (err) {
    logger.error('Failed to parse extraction response', { error: err, text: textContent });
    return {};
  }
}
