/**
 * Returns a profession-specific example message for the chat welcome.
 * Add new professions here when expanding prospection targets.
 */

const EXAMPLES: Array<{ keywords: string[]; example: string }> = [
  {
    keywords: ['osteo', 'ostéo', 'chiro', 'diét', 'diet', 'kiné', 'kine', 'podologue', 'sage-femme'],
    example: 'Fais un devis pour Jean Martin, 3 séances à 60€',
  },
  {
    keywords: ['plomb'],
    example: 'Fais un devis pour Jean Martin, remplacement chauffe-eau 850€',
  },
  {
    keywords: ['élect', 'elect'],
    example: 'Fais un devis pour Jean Martin, mise aux normes tableau électrique 1200€',
  },
  {
    keywords: ['maçon', 'macon'],
    example: 'Fais un devis pour Jean Martin, réfection mur 15m² à 65€/m²',
  },
  {
    keywords: ['menuisier', 'carrelage', 'peintre', 'platr', 'plâtr'],
    example: 'Fais un devis pour Jean Martin, pose carrelage 35m² à 55€/m²',
  },
  {
    keywords: ['wedding', 'événement', 'evenement', 'traiteur'],
    example: 'Fais un devis pour Jean Martin, organisation réception 80 personnes 4500€',
  },
  {
    keywords: ['coach', 'consultant', 'formateur', 'formation'],
    example: 'Fais un devis pour Jean Martin, accompagnement 10 séances à 120€',
  },
  {
    keywords: ['photograph', 'vidéo', 'video'],
    example: 'Fais un devis pour Jean Martin, reportage photo mariage 1200€',
  },
];

const DEFAULT_EXAMPLE = 'Fais un devis pour Jean Martin, prestation à 500€';

export function getProfessionExample(input: { profession: string | null }): string {
  if (!input.profession) return DEFAULT_EXAMPLE;

  const profLower = input.profession.toLowerCase();
  for (const entry of EXAMPLES) {
    if (entry.keywords.some((kw) => profLower.includes(kw))) {
      return entry.example;
    }
  }

  return DEFAULT_EXAMPLE;
}
