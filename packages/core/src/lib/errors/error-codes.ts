export const errorCodes = {
  invalidOtp: {
    code: 'INVALID_OTP',
    statusCode: 400,
    message: 'Code invalide',
  },
  otpExpired: {
    code: 'OTP_EXPIRED',
    statusCode: 400,
    message: 'Ce code a expiré',
  },
  otpAlreadyUsed: {
    code: 'OTP_ALREADY_USED',
    statusCode: 400,
    message: 'Ce code a déjà été utilisé',
  },
  emailRequired: {
    code: 'EMAIL_REQUIRED',
    statusCode: 400,
    message: 'Email requis',
  },
  unauthorized: {
    code: 'UNAUTHORIZED',
    statusCode: 401,
    message: 'Authentification requise',
  },
  forbidden: {
    code: 'FORBIDDEN',
    statusCode: 403,
    message: 'Accès interdit',
  },
  teamNotFound: {
    code: 'TEAM_NOT_FOUND',
    statusCode: 404,
    message: 'Équipe introuvable',
  },
  userNotFound: {
    code: 'USER_NOT_FOUND',
    statusCode: 404,
    message: 'Utilisateur introuvable',
  },
  clientNotFound: {
    code: 'CLIENT_NOT_FOUND',
    statusCode: 404,
    message: 'Client introuvable',
  },
  duplicateExpense: {
    code: 'DUPLICATE_EXPENSE',
    statusCode: 409,
    message: 'Cette dépense semble être un doublon',
  },
  quoteNotFound: {
    code: 'QUOTE_NOT_FOUND',
    statusCode: 404,
    message: 'Devis introuvable',
  },
  quoteNotDraft: {
    code: 'QUOTE_NOT_DRAFT',
    statusCode: 409,
    message: 'Ce devis ne peut plus être modifié',
  },
  quoteNotInvoiceable: {
    code: 'QUOTE_NOT_INVOICEABLE',
    statusCode: 409,
    message: 'Ce devis ne peut pas être facturé',
  },
  invoiceNotFound: {
    code: 'INVOICE_NOT_FOUND',
    statusCode: 404,
    message: 'Facture introuvable',
  },
  invoiceNotDraft: {
    code: 'INVOICE_NOT_DRAFT',
    statusCode: 409,
    message: 'Cette facture ne peut plus être modifiée',
  },
  invalidStatusTransition: {
    code: 'INVALID_STATUS_TRANSITION',
    statusCode: 400,
    message: 'Transition de statut invalide',
  },
  expenseNotFound: {
    code: 'EXPENSE_NOT_FOUND',
    statusCode: 404,
    message: 'Dépense introuvable',
  },
  siretAlreadyUsed: {
    code: 'SIRET_ALREADY_USED',
    statusCode: 409,
    message: 'Ce SIRET est déjà utilisé',
  },
  invalidSiret: {
    code: 'INVALID_SIRET',
    statusCode: 400,
    message: 'Numéro SIRET invalide',
  },
  invalidRefreshToken: {
    code: 'INVALID_REFRESH_TOKEN',
    statusCode: 401,
    message: 'Session expirée, veuillez vous reconnecter',
  },
  nameRequired: {
    code: 'NAME_REQUIRED',
    statusCode: 400,
    message: 'Le nom de l\'entreprise est requis',
  },
  nameTooLong: {
    code: 'NAME_TOO_LONG',
    statusCode: 400,
    message: 'Le nom de l\'entreprise ne peut pas dépasser 200 caractères',
  },
  invalidEmail: {
    code: 'INVALID_EMAIL',
    statusCode: 400,
    message: 'Adresse email invalide',
  },
  invalidPhone: {
    code: 'INVALID_PHONE',
    statusCode: 400,
    message: 'Numéro de téléphone fixe invalide',
  },
  invalidMobile: {
    code: 'INVALID_MOBILE',
    statusCode: 400,
    message: 'Numéro de téléphone mobile invalide',
  },
  addressTooLong: {
    code: 'ADDRESS_TOO_LONG',
    statusCode: 400,
    message: 'L\'adresse ne peut pas dépasser 500 caractères',
  },
  invalidTvaNumber: {
    code: 'INVALID_TVA_NUMBER',
    statusCode: 400,
    message: 'Numéro de TVA invalide (format attendu : FRXX999999999)',
  },
  clientDuplicateEmail: {
    code: 'CLIENT_DUPLICATE_EMAIL',
    statusCode: 409,
    message: 'Un client avec cet email existe déjà',
  },
  clientDuplicatePhone: {
    code: 'CLIENT_DUPLICATE_PHONE',
    statusCode: 409,
    message: 'Un client avec ce numéro de téléphone existe déjà',
  },
  clientDuplicateSiret: {
    code: 'CLIENT_DUPLICATE_SIRET',
    statusCode: 409,
    message: 'Un client avec ce SIRET existe déjà',
  },
  invalidInput: {
    code: 'INVALID_INPUT',
    statusCode: 400,
    message: 'Données invalides',
  },
  noActiveClient: {
    code: 'NO_ACTIVE_CLIENT',
    statusCode: 400,
    message: 'Aucun client sélectionné',
  },
  noDocumentPrepared: {
    code: 'NO_DOCUMENT_PREPARED',
    statusCode: 400,
    message: 'Aucune ligne préparée',
  },
  documentLinesIncomplete: {
    code: 'DOCUMENT_LINES_INCOMPLETE',
    statusCode: 400,
    message: 'Certaines lignes n\'ont pas de prix unitaire',
  },
  invoiceAlreadyHasAvoir: {
    code: 'INVOICE_ALREADY_HAS_AVOIR',
    statusCode: 409,
    message: 'Cette facture a déjà un avoir',
  },
  avoirNotEditable: {
    code: 'AVOIR_NOT_EDITABLE',
    statusCode: 409,
    message: 'Les lignes d\'un avoir ne peuvent pas être modifiées',
  },
  acompteExceedsQuote: {
    code: 'ACOMPTE_EXCEEDS_QUOTE',
    statusCode: 409,
    message: 'Le total des acomptes dépasse le montant du devis',
  },
  soldeAlreadyExists: {
    code: 'SOLDE_ALREADY_EXISTS',
    statusCode: 409,
    message: 'Une facture de solde existe déjà pour ce devis',
  },
  documentNotReady: {
    code: 'DOCUMENT_NOT_READY',
    statusCode: 422,
    message: 'Le document ne peut pas être envoyé : informations obligatoires manquantes',
  },
  mandatoryFieldCannotBeEmpty: {
    code: 'MANDATORY_FIELD_CANNOT_BE_EMPTY',
    statusCode: 400,
    message: 'Ce champ est obligatoire sur vos documents et ne peut pas être vide',
  },
  messageAlreadyProcessing: {
    code: 'MESSAGE_ALREADY_PROCESSING',
    statusCode: 409,
    message: 'Un message est déjà en cours de traitement',
  },
  subscriptionInactive: {
    code: 'SUBSCRIPTION_INACTIVE',
    statusCode: 403,
    message: 'Ton abonnement n\'est plus actif',
  },
  aiLimitReached: {
    code: 'AI_LIMIT_REACHED',
    statusCode: 429,
    message: 'Une erreur est survenue, reessaie plus tard',
  },
  checkoutFailed: {
    code: 'CHECKOUT_FAILED',
    statusCode: 500,
    message: 'Impossible de creer la session de paiement',
  },
  clientEmailRequired: {
    code: 'CLIENT_EMAIL_REQUIRED',
    statusCode: 400,
    message: "L'adresse email du client est requise pour l'envoi",
  },
  emailRateLimited: {
    code: 'EMAIL_RATE_LIMITED',
    statusCode: 429,
    message: 'Un email a déjà été envoyé il y a moins d\'une minute',
  },
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];
