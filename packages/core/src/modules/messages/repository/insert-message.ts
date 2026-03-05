import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { MessageRow } from '../domain/message.entity.js';

const insertMessageSchema = z.object({
  userId: z.string().uuid(),
  teamId: z.string().uuid(),
  role: z.string().min(1),
  content: z.string(),
  attachments: z
    .array(z.object({ type: z.string(), url: z.string(), name: z.string() }))
    .optional(),
  toolCalls: z.unknown().optional(),
  richCard: z.unknown().optional(),
});

export async function insertMessage(input: {
  userId: string;
  teamId: string;
  role: string;
  content: string;
  attachments?: { type: string; url: string; name: string }[];
  toolCalls?: unknown;
  richCard?: unknown;
}): Promise<MessageRow> {
  const validated = insertMessageSchema.parse(input);
  const id = generateId();

  const result = await query<MessageRow>(
    `INSERT INTO messages (id, user_id, team_id, role, content, attachments, tool_calls, rich_card)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id,
      validated.userId,
      validated.teamId,
      validated.role,
      validated.content,
      JSON.stringify(validated.attachments ?? []),
      validated.toolCalls ? JSON.stringify(validated.toolCalls) : null,
      validated.richCard ? JSON.stringify(validated.richCard) : null,
    ],
  );

  return result.rows[0]!;
}
