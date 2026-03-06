import { query } from '../../../lib/database/db.js';
import { getCurrentUser } from '../../users/index.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import type { Message } from '@tuldio/types';

interface DebugMessageRow {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: unknown;
  tool_calls: unknown;
  rich_card: unknown;
  debug_trace: unknown;
  created_at: Date;
}

export async function listDebugMessages(input: {
  godUserId: string;
  targetUserId: string;
  limit?: number;
}): Promise<Message[]> {
  const god = await getCurrentUser(input.godUserId);
  if (!god.god) {
    throw new HandledError(errorCodes.forbidden);
  }

  const limit = input.limit ?? 50;

  const result = await query<DebugMessageRow>(
    `SELECT id, user_id, role, content, attachments, tool_calls, rich_card, debug_trace, created_at
     FROM messages WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [input.targetUserId, limit],
  );

  return result.rows.reverse().map((row) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    attachments: row.attachments as Message['attachments'],
    toolCalls: row.tool_calls,
    richCard: row.rich_card as Message['richCard'],
    debugTrace: row.debug_trace as Message['debugTrace'],
    createdAt: row.created_at.toISOString(),
  }));
}
