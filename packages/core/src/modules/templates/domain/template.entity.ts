import { z } from 'zod';

export const templateSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  type: z.enum(['quote', 'invoice']),
  layout_data: z.unknown(),
  original_url: z.string().nullable(),
  created_at: z.date(),
});

export type TemplateRow = z.infer<typeof templateSchema>;
