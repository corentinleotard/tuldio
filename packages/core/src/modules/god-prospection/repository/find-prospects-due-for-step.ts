import { query } from '../../../lib/database/db.js';

export interface DueProspectRow {
  id: string;
  firstName: string;
  fullName: string;
  email: string;
  phone: string | null;
  whatsappPhone: string | null;
  profession: string;
  website: string | null;
  sequenceId: string;
  currentStep: number;
  stepOrder: number;
  channel: string;
  subject: string | null;
  body: string;
}

export async function findProspectsDueForStep(input: {
  channel: string;
  limit: number;
}): Promise<DueProspectRow[]> {
  // For WhatsApp: only fetch prospects with a valid French mobile number (+336/+337)
  const phoneFilter = input.channel === 'whatsapp'
    ? `AND (COALESCE(p.whatsapp_phone, p.phone) ~ '^(\\+33[67]|0[67])' )`
    : '';

  const result = await query<DueProspectRow>(
    `SELECT p.id, p.first_name AS "firstName", p.full_name AS "fullName",
            p.email, p.phone, p.whatsapp_phone AS "whatsappPhone",
            p.profession, p.website,
            p.sequence_id AS "sequenceId", p.current_step AS "currentStep",
            s.step_order AS "stepOrder", s.channel, s.subject, s.body
     FROM god_prospects p
     JOIN god_sequence_steps s
       ON s.sequence_id = p.sequence_id
       AND s.step_order = p.current_step
     WHERE p.sequence_status = 'active'
       AND p.next_step_at <= now()
       AND s.channel = $1
       ${phoneFilter}
     ORDER BY
       p.current_step DESC,
       COALESCE(p.icp_score, 0) DESC,
       p.next_step_at ASC
     LIMIT $2`,
    [input.channel, input.limit],
  );
  return result.rows;
}
