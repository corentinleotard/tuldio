const HEALTH_PROFESSIONS = new Set([
  'Ostéopathe', 'Chiropracteur', 'Diététicien',
]);

const PROFESSION_PLURAL: Record<string, string> = {
  'Photographe mariage': 'photographes de mariage',
  'Vidéaste mariage': 'vidéastes de mariage',
  'DJ / Musicien mariage': 'DJ et musiciens de mariage',
  'Traiteur mariage': 'traiteurs de mariage',
  'Décorateur mariage': 'décorateurs de mariage',
  'Wedding planner': 'wedding planners',
  'Fleuriste mariage': 'fleuristes de mariage',
  'Pâtissier mariage': 'pâtissiers de mariage',
  'Organisateur événementiel': 'organisateurs événementiels',
};

function getProfessionPlural(profession: string): string {
  return PROFESSION_PLURAL[profession] || profession.toLowerCase() + 's';
}

/** "CLAIRE" -> "Claire", "JEAN-PIERRE" -> "Jean-Pierre" */
function capitalizeFirstName(name: string): string {
  return name.toLowerCase().replace(/(^|[-' ])(\w)/g, (_, sep: string, c: string) => sep + c.toUpperCase());
}

/** Build template variables for a prospect */
export function buildTemplateVariables(input: {
  firstName: string;
  fullName: string;
  profession: string;
}): Record<string, string> {
  const isHealth = HEALTH_PROFESSIONS.has(input.profession);
  const variables: Record<string, string> = {
    firstName: input.firstName ? capitalizeFirstName(input.firstName) : '',
    fullName: input.fullName.split(' ').map((w) => capitalizeFirstName(w)).join(' '),
    profession: input.profession,
    professionPlural: getProfessionPlural(input.profession),
    clients: isHealth ? 'patients' : 'clients',
  };

  // Replace empty values with empty string (e.g. artisans with no firstName)
  for (const [key, value] of Object.entries(variables)) {
    if (!value) {
      variables[key] = '';
    }
  }

  return variables;
}

/** Replace {{variable}} placeholders in template text -- throws on unknown variables */
export function interpolateVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in variables)) {
      throw new Error(`Variable inconnue : {{${key}}}`);
    }
    return variables[key] as string;
  });
}

/** Build resolved plain text message from a template + prospect data */
export function buildMessageText(input: {
  template: string;
  prospect: { firstName: string; fullName: string; profession: string };
  inviteUrl: string | null;
}): string {
  const variables = buildTemplateVariables(input.prospect);

  let resolved = interpolateVariables(input.template, variables);
  // Clean up "Bonjour ," when firstName is empty
  resolved = resolved.replace(/ +([,!?])/g, '$1');

  if (input.inviteUrl) {
    resolved += `\n\nVotre espace est déjà prêt avec vos informations : ${input.inviteUrl}`;
  }

  return resolved;
}
