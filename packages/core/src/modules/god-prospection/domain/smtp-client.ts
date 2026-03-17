import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { logger } from '../../../lib/infra/logger.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.PROSPECTION_SMTP_HOST || 'ssl0.ovh.net',
    port: Number(process.env.PROSPECTION_SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.PROSPECTION_SMTP_USER || '',
      pass: process.env.PROSPECTION_SMTP_PASS || '',
    },
  });

  return transporter;
}

function getFromAddress(): string {
  const name = process.env.PROSPECTION_SENDER_NAME || '';
  const email = process.env.PROSPECTION_SMTP_USER || '';
  return name ? `${name} <${email}>` : email;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
}): Promise<{ messageId: string }> {
  const from = getFromAddress();
  const mailOptions = {
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.replyTo && { replyTo: input.replyTo }),
    ...(input.inReplyTo && {
      inReplyTo: input.inReplyTo,
      references: input.references || input.inReplyTo,
    }),
  };

  const result = await getTransporter().sendMail(mailOptions);

  // Save to IMAP Sent folder in background (don't block send)
  appendToSentFolder(mailOptions).catch((err) => {
    logger.error('god-prospection.imap-append-failed', {
      to: mailOptions.to,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  });

  return { messageId: result.messageId };
}

const SENT_FOLDER = 'Sent';

async function appendToSentFolder(mailOptions: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  // Build raw email
  const rawEmail = [
    `From: ${mailOptions.from}`,
    `To: ${mailOptions.to}`,
    `Subject: ${mailOptions.subject}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    '',
    mailOptions.html,
  ].join('\r\n');

  const client = new ImapFlow({
    host: process.env.PROSPECTION_IMAP_HOST || 'ssl0.ovh.net',
    port: Number(process.env.PROSPECTION_IMAP_PORT || '993'),
    secure: true,
    auth: {
      user: process.env.PROSPECTION_SMTP_USER || '',
      pass: process.env.PROSPECTION_SMTP_PASS || '',
    },
    logger: false,
  });

  try {
    await client.connect();

    // Create Sent folder if it doesn't exist
    try {
      await client.mailboxCreate(SENT_FOLDER);
    } catch { /* already exists */ }

    await client.append(SENT_FOLDER, Buffer.from(rawEmail), ['\\Seen']);
    await client.logout();
  } catch {
    try { await client.logout(); } catch { /* ignore */ }
  }
}
