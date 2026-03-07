import type { Message } from '@tuldio/types';
import type { MessageRow } from './message.entity.js';

export type MessageView = Message;

export function toMessageView(row: MessageRow): MessageView {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    attachments: row.attachments,
    toolCalls: row.tool_calls,
    richCard: row.rich_card as MessageView['richCard'],
    quickReplies: row.quick_replies,
    debugTrace: row.debug_trace as MessageView['debugTrace'],
    createdAt: row.created_at.toISOString(),
  };
}
