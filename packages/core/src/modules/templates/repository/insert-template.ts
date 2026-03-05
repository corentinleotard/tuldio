import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { TemplateRow } from '../domain/template.entity.js';

const insertTemplateSchema = z.object({
  teamId: z.string().uuid(),
  type: z.enum(['quote', 'invoice']),
  layoutData: z.unknown(),
  originalUrl: z.string().optional(),
});

export async function insertTemplate(input: {
  teamId: string;
  type: 'quote' | 'invoice';
  layoutData: unknown;
  originalUrl?: string;
}): Promise<TemplateRow> {
  const validated = insertTemplateSchema.parse(input);
  const id = generateId();

  const result = await query<TemplateRow>(
    `INSERT INTO templates (id, team_id, type, layout_data, original_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      id,
      validated.teamId,
      validated.type,
      JSON.stringify(validated.layoutData),
      validated.originalUrl ?? null,
    ],
  );

  return result.rows[0]!;
}
