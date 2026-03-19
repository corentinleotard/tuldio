import { query } from '../../../lib/database/db.js';

export async function insertReceivedMessage(input: {
  channel: 'email' | 'whatsapp';
  sender: string;
  senderName: string | null;
  subject: string | null;
  body: string;
}): Promise<void> {
  await query(
    `INSERT INTO god_received_messages (id, channel, sender, sender_name, subject, body)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
    [input.channel, input.sender, input.senderName, input.subject, input.body],
  );
}
