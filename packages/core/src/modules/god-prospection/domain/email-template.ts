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

export function buildProspectionEmailHtml(input: {
  firstName: string;
  fullName: string;
  profession: string;
  body: string;
  inviteUrl: string | null;
}): string {
  const isHealth = HEALTH_PROFESSIONS.has(input.profession);
  const variables: Record<string, string> = {
    firstName: capitalizeFirstName(input.firstName),
    fullName: input.fullName.split(' ').map((w) => capitalizeFirstName(w)).join(' '),
    profession: input.profession,
    clients: isHealth ? 'patients' : 'clients',
  };

  // Remove placeholders for empty variables (e.g. artisans with no firstName)
  // instead of throwing — allows the same template to work for both persons and companies
  for (const [key, value] of Object.entries(variables)) {
    if (!value) {
      variables[key] = '';
    }
  }

  const resolvedBody = interpolateVariables(input.body, variables);

  const bodyHtml = linkifyUrls(escapeHtml(resolvedBody)).replace(/\n/g, '<br>');

  const inviteBlock = input.inviteUrl
    ? `<br><br>
<div style="margin-top:12px;">
  <span style="font-size:small;">Votre espace est déjà prêt avec vos informations, c'est gratuit 14 jours, sans carte bancaire :</span><br><br>
  <a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;background-color:#1B4D3E;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:small;font-weight:600;">Essayer Tuldio gratuitement</a>
</div>`
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
