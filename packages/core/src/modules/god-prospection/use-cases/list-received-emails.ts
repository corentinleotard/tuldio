import { fetchInboxEmails, type ReceivedEmail } from '../domain/imap-client.js';

export type { ReceivedEmail };

export async function listReceivedEmails(input: {
  limit: number;
  olderThan: string | null;
}): Promise<ReceivedEmail[]> {
  return fetchInboxEmails({ limit: input.limit, olderThan: input.olderThan });
}
