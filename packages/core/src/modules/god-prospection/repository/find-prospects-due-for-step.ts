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
  linkText: string | null;
  nextStepAt: string;
}

/**
 * Find prospects due for a sequence step.
 * - channel: filter by channel type, null = all channels
 * - dueWithinHours: 0 = due now (for cron sending), 24 = due within 24h (for dashboard)
 */
export async function findProspectsDueForStep(input: {
  channel: string | null;
  dueWithinHours: number;
  limit: number;
}): Promise<DueProspectRow[]> {
  const params: Array<string | number> = [];
  const conditions: string[] = [
    `p.sequence_status = 'active'`,
  ];

  // Time window
  if (input.dueWithinHours === 0) {
    conditions.push(`p.next_step_at <= now()`);
  } else {
    params.push(input.dueWithinHours);
    conditions.push(`p.next_step_at <= now() + make_interval(hours => $${params.length}::int)`);
  }

  // Channel filter
  if (input.channel) {
    params.push(input.channel);
    conditions.push(`s.channel = $${params.length}`);
  }

  // WhatsApp steps: only prospects with valid French mobile numbers
  // Applied regardless of channel filter (also for dashboard upcoming list)
  conditions.push(
    `(s.channel != 'whatsapp' OR COALESCE(p.whatsapp_phone, p.phone) ~ '^(\\+33[67]|0[67])')`,
  );

  params.push(input.limit);

  const result = await query<DueProspectRow>(
    `SELECT p.id, p.first_name AS "firstName", p.full_name AS "fullName",
            p.email, p.phone, p.whatsapp_phone AS "whatsappPhone",
            p.profession, p.website,
            p.sequence_id AS "sequenceId", p.current_step AS "currentStep",
            s.step_order AS "stepOrder", s.channel, s.subject, s.body,
            s.link_text AS "linkText", p.next_step_at AS "nextStepAt"
     FROM god_prospects p
     JOIN god_sequence_steps s
       ON s.sequence_id = p.sequence_id
       AND s.step_order = p.current_step
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       p.current_step DESC,
       COALESCE(p.icp_score, 0) DESC,
       p.next_step_at ASC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows;
}
