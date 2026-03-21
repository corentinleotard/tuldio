import { buildTemplateVariables, interpolateVariables } from './sequence-template.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Turn raw URLs into clickable <a> links */
function linkifyUrls(html: string): string {
  return html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#1a6be0;">$1</a>',
  );
}

const EMAIL_SUBJECT = 'Vos devis et factures, vous les faites comment ?';

/** Returns the email subject line */
export function getSubjectForProfession(_profession: string): string {
  return EMAIL_SUBJECT;
}

export function buildProspectionEmailHtml(input: {
  firstName: string;
  fullName: string;
  profession: string;
  body: string;
  inviteUrl: string | null;
  linkText: string | null;
}): string {
  const variables = buildTemplateVariables({
    firstName: input.firstName,
    fullName: input.fullName,
    profession: input.profession,
  });

  let resolvedBody = interpolateVariables(input.body, variables);
  // Clean up "Bonjour ," when firstName is empty
  resolvedBody = resolvedBody.replace(/ +([,!?])/g, '$1').trim();

  const bodyHtml = linkifyUrls(escapeHtml(resolvedBody)).replace(/\n/g, '<br>');

  const inviteBlock = input.linkText && input.inviteUrl
    ? `<br><br>${escapeHtml(input.linkText)} <a href="${escapeHtml(input.inviteUrl)}" style="color:#1a6be0;">Essayer Tuldio</a>`
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
