import { formatCurrency } from '../../../lib/pdf/templates/shared.js';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function buildDocumentEmailHtml(input: {
  teamName: string;
  documentType: 'quote' | 'invoice';
  documentNumber: string;
  totalTtc: number;
  downloadUrl: string;
}): string {
  const docLabel = input.documentType === 'quote' ? 'devis' : 'facture';
  const docLabelArticle = input.documentType === 'quote' ? 'le devis' : 'la facture';
  const amount = formatCurrency(input.totalTtc);
  const teamName = escapeHtml(input.teamName);
  const docNumber = escapeHtml(input.documentNumber);
  const url = escapeHtml(input.downloadUrl);

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #F4F3F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #F4F3F0; padding: 40px 0;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background: #FFFFFF; border-radius: 8px; max-width: 520px; width: 100%;">
        <tr><td style="padding: 32px;">
          <p style="font-size: 15px; color: #1A1A1A; margin: 0 0 20px;">Bonjour,</p>
          <p style="font-size: 15px; color: #1A1A1A; margin: 0 0 24px; line-height: 1.6;">Veuillez trouver ci-dessous votre ${docLabel} <strong>${docNumber}</strong> d'un montant de <strong>${amount}</strong> TTC.</p>
          <div style="margin: 0 0 28px;">
            <a href="${url}" style="display: inline-block; background: #1B4D3E; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none;">Télécharger ${docLabelArticle}</a>
          </div>
          <p style="font-size: 15px; color: #1A1A1A; margin: 0 0 4px;">Cordialement,</p>
          <p style="font-size: 15px; color: #1A1A1A; font-weight: 600; margin: 0;">${teamName}</p>
        </td></tr>
        <tr><td style="padding: 16px 32px;">
          <p style="font-size: 11px; color: #9E9E9E; margin: 0;">Envoyé via <a href="https://www.tuldio.fr" style="color: #9E9E9E; text-decoration: underline;">Tuldio</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
