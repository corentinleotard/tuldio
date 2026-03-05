import type Anthropic from '@anthropic-ai/sdk';

export const chatTools: Anthropic.Tool[] = [
  {
    name: 'search_clients',
    description:
      "Rechercher des clients par nom (fuzzy matching). Utilise cet outil quand l'utilisateur mentionne un client.",
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Nom du client à rechercher' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_client',
    description: 'Créer un nouveau client.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nom du client' },
        email: { type: 'string', description: 'Email du client' },
        phone: { type: 'string', description: 'Téléphone du client' },
        address: { type: 'string', description: 'Adresse du client' },
      },
      required: ['name'],
    },
  },
  {
    name: 'generate_quote',
    description: 'Générer un devis pour un client. Montants en centimes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'string', description: 'ID du client' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'number', description: 'Prix unitaire en centimes' },
            },
            required: ['description', 'quantity', 'unitPrice'],
          },
          description: 'Lignes du devis',
        },
        tvaRate: { type: 'number', description: 'Taux de TVA en pourcentage (ex: 20)' },
      },
      required: ['clientId', 'lines', 'tvaRate'],
    },
  },
  {
    name: 'generate_invoice',
    description: 'Générer une facture pour un client. Montants en centimes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'string', description: 'ID du client' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'number', description: 'Prix unitaire en centimes' },
            },
            required: ['description', 'quantity', 'unitPrice'],
          },
          description: 'Lignes de la facture',
        },
        tvaRate: { type: 'number', description: 'Taux de TVA en pourcentage (ex: 20)' },
      },
      required: ['clientId', 'lines', 'tvaRate'],
    },
  },
  {
    name: 'record_expense',
    description: 'Enregistrer une dépense. Montant en centimes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: { type: 'number', description: 'Montant en centimes' },
        category: { type: 'string', description: 'Catégorie' },
        vendor: { type: 'string', description: 'Fournisseur' },
        date: { type: 'string', description: 'Date au format ISO' },
      },
      required: ['amount', 'vendor', 'date'],
    },
  },
  {
    name: 'get_stats',
    description: 'Obtenir les statistiques du mois.',
    input_schema: {
      type: 'object' as const,
      properties: {
        month: { type: 'number', description: 'Mois (1-12)' },
        year: { type: 'number', description: 'Année' },
      },
      required: ['month', 'year'],
    },
  },
  {
    name: 'mark_as_paid',
    description: 'Marquer une facture comme payée.',
    input_schema: {
      type: 'object' as const,
      properties: {
        invoiceId: { type: 'string', description: 'ID de la facture' },
      },
      required: ['invoiceId'],
    },
  },
  {
    name: 'add_client_note',
    description: 'Ajouter une note à un client.',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'string', description: 'ID du client' },
        content: { type: 'string', description: 'Contenu de la note' },
      },
      required: ['clientId', 'content'],
    },
  },
];
