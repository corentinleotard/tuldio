import { insertMessage } from '../repository/insert-message.js';
import { toMessageView, type MessageView } from '../domain/message.view.js';

export async function createMessage(input: {
  userId: string;
  teamId: string;
  role: string;
  content: string;
  attachments?: { type: string; url: string; name: string }[];
  toolCalls?: unknown;
  richCard?: unknown;
  debugTrace?: unknown;
}): Promise<MessageView> {
  const message = await insertMessage(input);

  return toMessageView(message);
}
