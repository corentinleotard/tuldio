import { ImapFlow } from 'imapflow';

export interface ReceivedEmail {
  id: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  date: string;
  textBody: string;
  messageId: string;
  inReplyTo: string | null;
}

function getImapConfig() {
  return {
    host: process.env.PROSPECTION_IMAP_HOST || 'ssl0.ovh.net',
    port: Number(process.env.PROSPECTION_IMAP_PORT || '993'),
    secure: true,
    auth: {
      user: process.env.PROSPECTION_SMTP_USER || '',
      pass: process.env.PROSPECTION_SMTP_PASS || '',
    },
    logger: false as const,
  };
}

export async function fetchInboxEmails(input: {
  limit: number;
  olderThan: string | null;
}): Promise<ReceivedEmail[]> {
  const client = new ImapFlow(getImapConfig());
  const emails: ReceivedEmail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const status = await client.status('INBOX', { messages: true });
      const total = status.messages || 0;
      if (total === 0) return [];

      // Fetch enough recent messages to fill the page after optional date filtering
      const fetchCount = input.olderThan ? input.limit + 200 : input.limit + 50;
      const start = Math.max(1, total - fetchCount);
      const range = `${start}:*`;

      const cutoffDate = input.olderThan ? new Date(input.olderThan) : null;

      for await (const msg of client.fetch(range, {
        envelope: true,
        source: true,
        headers: ['in-reply-to', 'message-id'],
      })) {
        const envelope = msg.envelope;
        if (!envelope) continue;

        const msgDate = envelope.date || new Date();

        // For cursor pagination: skip messages at or after the cursor
        if (cutoffDate && msgDate >= cutoffDate) continue;

        const fromAddr = envelope.from?.[0]?.address?.toLowerCase() || '';
        const source = msg.source;
        const textBody = source ? extractTextFromSource(source) : '';

        emails.push({
          id: msg.uid.toString(),
          from: fromAddr,
          fromName: envelope.from?.[0]?.name || fromAddr,
          to: envelope.to?.[0]?.address || '',
          subject: envelope.subject || '(sans objet)',
          date: msgDate.toISOString(),
          textBody,
          messageId: envelope.messageId || '',
          inReplyTo: envelope.inReplyTo || null,
        });
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    try { await client.logout(); } catch { /* ignore */ }
    throw err;
  }

  emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return emails.slice(0, input.limit);
}

function extractTextFromSource(source: Buffer): string {
  const raw = source.toString('utf-8');

  // Try to find plain text part
  const textMatch = raw.match(/Content-Type: text\/plain[^\r\n]*\r?\n((?:Content-Transfer-Encoding:\s*(\S+)\r?\n)?)(?:\r?\n)([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i);
  if (textMatch?.[3]) {
    const encoding = textMatch[2]?.toLowerCase() || '7bit';
    return decodeBody(textMatch[3], encoding).trim().slice(0, 5000);
  }

  // Fallback: strip HTML tags from html part
  const htmlMatch = raw.match(/Content-Type: text\/html[^\r\n]*\r?\n((?:Content-Transfer-Encoding:\s*(\S+)\r?\n)?)(?:\r?\n)([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i);
  if (htmlMatch?.[3]) {
    return decodeBody(htmlMatch[3], htmlMatch[2]?.toLowerCase() || '7bit')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);
  }

  // Last resort: just return cleaned raw
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
}

function decodeBody(body: string, encoding: string): string {
  if (encoding === 'base64') {
    try {
      return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf-8');
    } catch {
      return body;
    }
  }

  if (encoding === 'quoted-printable') {
    return body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  }

  return body;
}
