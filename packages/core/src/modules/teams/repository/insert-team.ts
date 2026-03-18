import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { TeamRow } from '../domain/team.entity.js';

const insertTeamSchema = z.object({
  name: z.string(),
});

export async function insertTeam(input: {
  name: string;
}): Promise<TeamRow> {
  const validated = insertTeamSchema.parse(input);
  const id = generateId();

  const result = await query<TeamRow>(
    `INSERT INTO teams (id, name)
     VALUES ($1, $2)
     RETURNING id, name, logo_url, original_document_url, quote_last_number, quote_validity_days, invoice_last_number, avoir_last_number, invoice_payment_delay_days, terms_accepted_at, stripe_customer_id, trial_ends_at, subscription_status, created_at`,
    [id, validated.name],
  );

  return result.rows[0]!;
}
