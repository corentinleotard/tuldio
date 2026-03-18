function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Replace {{variable}} placeholders in template text — throws on unknown variables */
function interpolateVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in variables)) {
      throw new Error(`Variable inconnue : {{${key}}}`);
    }
    return variables[key] as string;
  });
}

/** Turn raw URLs into clickable <a> links */
function linkifyUrls(html: string): string {
  return html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#1a6be0;">$1</a>',
  );
}

/** "CLAIRE" → "Claire", "JEAN-PIERRE" → "Jean-Pierre" */
function capitalizeFirstName(name: string): string {
  return name.toLowerCase().replace(/(^|[-' ])(\w)/g, (_, sep: string, c: string) => sep + c.toUpperCase());
}

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

const SUBJECT_BY_PROFESSION: Record<string, string> = {
  'Ostéopathe': 'Vos mains soignent, laissez Tuldio s\'occuper de vos factures',
  'Chiropracteur': 'Vos mains soignent, laissez Tuldio s\'occuper de vos factures',
  'Diététicien': 'Moins de temps sur la paperasse, plus de temps pour vos patients',
  'Wedding planner': 'Prêt à enfin découvrir le grand amour avec vos factures ?',
  'Photographe mariage': 'Vos photos sont nettes, vos factures devraient l\'être aussi',
  'Traiteur mariage': 'Vous régalez vos clients, on s\'occupe de la note',
  'Maçon': 'Un devis en 30 secondes, sans poser la truelle',
  'Terrassier': 'Un devis en 30 secondes, sans quitter le chantier',
  'Plombier': 'Un devis en 30 secondes, sans quitter le chantier',
  'Electricien': 'Un devis en 30 secondes, sans quitter le chantier',
  'Menuisier': 'Des devis bien taillés, sans quitter l\'atelier',
  'Peintre': 'Un devis en 30 secondes, sans poser le rouleau',
  'Carreleur': 'Un devis en 30 secondes, sans quitter le chantier',
};

const DEFAULT_SUBJECT = 'Vos factures en 30 secondes, sans logiciel compliqué';

/** Returns a catchy subject line tailored to the prospect's profession */
export function getSubjectForProfession(profession: string): string {
  return SUBJECT_BY_PROFESSION[profession] || DEFAULT_SUBJECT;
}

export function buildProspectionEmailHtml(input: {
  firstName: string;
  fullName: string;
  profession: string;
  body: string;
  inviteUrl: string | null;
}): string {
  const isHealth = HEALTH_PROFESSIONS.has(input.profession);
  const variables: Record<string, string> = {
    firstName: input.firstName ? capitalizeFirstName(input.firstName) : '',
    fullName: input.fullName.split(' ').map((w) => capitalizeFirstName(w)).join(' '),
    profession: input.profession,
    professionPlural: getProfessionPlural(input.profession),
    clients: isHealth ? 'patients' : 'clients',
  };

  // Remove placeholders for empty variables (e.g. artisans with no firstName)
  // instead of throwing — allows the same template to work for both persons and companies
  for (const [key, value] of Object.entries(variables)) {
    if (!value) {
      variables[key] = '';
    }
  }

  let resolvedBody = interpolateVariables(input.body, variables);
  // Clean up "Bonjour ," when firstName is empty
  resolvedBody = resolvedBody.replace(/ +([,!?])/g, '$1');

  const bodyHtml = linkifyUrls(escapeHtml(resolvedBody)).replace(/\n/g, '<br>');

  const inviteBlock = input.inviteUrl
    ? `<br><br>Votre espace est déjà prêt avec vos informations : <a href="${escapeHtml(input.inviteUrl)}" style="color:#1a6be0;">Essayer Tuldio</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body>
<div style="font-size:small;">
${bodyHtml}
${inviteBlock}
</div>
</body>
</html>`;
}
