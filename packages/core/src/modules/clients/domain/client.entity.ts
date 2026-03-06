import { z } from 'zod';

const clientNoteSchema = z.object({
  content: z.string(),
  type: z.enum(['note', 'warning']).default('note'),
  createdAt: z.string(),
});

export const clientSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.array(clientNoteSchema),
  created_at: z.date(),
});

export type ClientRow = z.infer<typeof clientSchema>;
