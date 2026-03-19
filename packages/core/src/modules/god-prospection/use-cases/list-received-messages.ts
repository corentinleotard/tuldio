import { fetchInboxEmails } from '../domain/imap-client.js';
import { query } from '../../../lib/database/db.js';

export interface ReceivedMessageView {
  id: string;
  channel: 'email' | 'whatsapp';
  from: string;
  fromName: string;
  subject: string | null;
  body: string;
  date: string;
  messageId: string | null;
  inReplyTo: string | null;
}

export async function listReceivedMessages(input: {
  channel: 'all' | 'email' | 'whatsapp';
  limit: number;
  olderThan: string | null;
}): Promise<ReceivedMessageView[]> {
  const results: ReceivedMessageView[] = [];

  // Fetch emails from IMAP
  if (input.channel === 'all' || input.channel === 'email') {
    try {
      const emails = await fetchInboxEmails({ limit: input.limit, olderThan: input.olderThan });
      for (const e of emails) {
        results.push({
          id: `email-${e.id}`,
          channel: 'email',
          from: e.from,
          fromName: e.fromName,
          subject: e.subject,
          body: e.textBody,
          date: e.date,
          messageId: e.messageId,
          inReplyTo: e.inReplyTo,
        });
      }
    } catch {
      // IMAP may not be configured -- skip silently
    }
  }

  // Fetch WhatsApp messages from DB
  if (input.channel === 'all' || input.channel === 'whatsapp') {
    const params: Array<string | number> = [];
    const conditions: string[] = [];

    if (input.olderThan) {
      params.push(input.olderThan);
      conditions.push(`m.created_at < $${params.length}::timestamptz`);
    }

    const where = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
    params.push(input.limit);

    const waMessages = await query<{
      id: string;
      sender: string;
      senderName: string | null;
      body: string;
      createdAt: string;
    }>(
      `SELECT m.id, m.sender, m.sender_name AS "senderName",
              m.body, m.created_at AS "createdAt"
       FROM god_received_messages m
       WHERE m.channel = 'whatsapp'
       ${where}
       ORDER BY m.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    for (const w of waMessages.rows) {
      results.push({
        id: w.id,
        channel: 'whatsapp',
        from: w.sender,
        fromName: w.senderName || w.sender,
        subject: null,
        body: w.body,
        date: w.createdAt,
        messageId: null,
        inReplyTo: null,
      });
    }
  }

  // Sort merged results by date DESC, take limit
  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return results.slice(0, input.limit);
}
