import { query } from '../../../lib/database/db.js';
import type { MessageRow } from '../domain/message.entity.js';

export async function findMessageById(input: { id: string; userId: string }): Promise<MessageRow | null> {
  const result = await query<MessageRow>(
    'SELECT id, user_id, team_id, role, content, attachments, tool_calls, rich_card, quick_replies, debug_trace, created_at FROM messages WHERE id = $1 AND user_id = $2 LIMIT 1',
    [input.id, input.userId],
  );

  return result.rows[0] ?? null;
}
