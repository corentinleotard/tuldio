import { query } from '../../../lib/database/db.js';
import type { MessageRow } from '../domain/message.entity.js';

export async function findMessagesByUser(input: {
  userId: string;
  limit?: number;
  cursor?: string;
}): Promise<MessageRow[]> {
  const limit = input.limit ?? 30;
  const params: unknown[] = [input.userId, limit];

  let sql = 'SELECT id, user_id, team_id, role, content, attachments, tool_calls, rich_card, quick_replies, debug_trace, created_at FROM messages WHERE user_id = $1';

  if (input.cursor) {
    params.push(input.cursor);
    sql += ` AND created_at < $${params.length}`;
  }

  sql += ' ORDER BY created_at DESC LIMIT $2';

  const result = await query<MessageRow>(sql, params);

  return result.rows;
}
