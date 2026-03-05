import { z } from 'zod';

const attachmentSchema = z.object({
  type: z.string(),
  url: z.string(),
  name: z.string(),
});

export const messageSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  team_id: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  attachments: z.array(attachmentSchema),
  tool_calls: z.unknown().nullable(),
  rich_card: z.unknown().nullable(),
  created_at: z.date(),
});

export type MessageRow = z.infer<typeof messageSchema>;
