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
  invoiceNotFound: {
    code: 'INVOICE_NOT_FOUND',
    statusCode: 404,
    message: 'Facture introuvable',
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
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];
