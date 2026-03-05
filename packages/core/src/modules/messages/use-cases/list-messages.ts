import { findMessagesByUser } from '../repository/find-messages-by-user.js';
import { toMessageView, type MessageView } from '../domain/message.view.js';

export async function listMessages(input: {
  userId: string;
  limit?: number;
  cursor?: string;
}): Promise<MessageView[]> {
  const messages = await findMessagesByUser(input);

  return messages.reverse().map(toMessageView);
}
