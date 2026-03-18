import { insertMessage } from '../repository/insert-message.js';
import { findMessageById } from '../repository/find-message-by-id.js';
import { toMessageView, type MessageView } from '../domain/message.view.js';

export async function createMessage(input: {
  userId: string;
  teamId: string;
  role: string;
  content: string;
  attachments?: { type: string; url: string; name: string }[];
  toolCalls?: unknown;
  richCard?: unknown;
  quickReplies?: string[];
  debugTrace?: unknown;
}): Promise<MessageView> {
  const { id } = await insertMessage(input);
  const message = await findMessageById({ id, userId: input.userId });

  return toMessageView(message!);
}
