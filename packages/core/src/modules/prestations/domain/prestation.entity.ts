import { z } from 'zod';

export const prestationSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  type: z.enum(['service', 'fourniture']),
  description: z.string(),
  reference: z.string().nullable(),
  unit: z.string(),
  default_unit_price: z.number().int().nullable(),
  default_tva_rate: z.number().int(),
  archived: z.boolean(),
  created_at: z.date(),
});

export type PrestationRow = z.infer<typeof prestationSchema>;
