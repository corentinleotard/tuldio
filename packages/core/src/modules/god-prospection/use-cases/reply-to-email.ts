import { sendEmail } from '../domain/smtp-client.js';
import { logger } from '../../../lib/infra/logger.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function replyToEmail(input: {
  to: string;
  subject: string;
  body: string;
  inReplyTo: string;
}): Promise<void> {
  const senderName = process.env.PROSPECTION_SENDER_NAME || '';

  // Ensure subject starts with Re:
  const subject = input.subject.startsWith('Re:') ? input.subject : `Re: ${input.subject}`;

  const bodyHtml = escapeHtml(input.body).replace(/\n/g, '<br>');
  const senderHtml = escapeHtml(senderName);

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #1A1A1A; line-height: 1.6;">
${bodyHtml}
<br><br>
${senderHtml}
</div>`;

  await sendEmail({
    to: input.to,
    subject,
    html,
  });

  logger.info('god-prospection.replied', { to: input.to, subject });
}
