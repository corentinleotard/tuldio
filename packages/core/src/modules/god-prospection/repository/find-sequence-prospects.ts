import { query } from '../../../lib/database/db.js';

export interface SequenceProspectRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  hasMobile: boolean;
  currentStep: number;
  sequenceStatus: string;
  nextStepAt: string | null;
  lastSentAt: string | null;
}

export async function findSequenceProspects(input: {
  sequenceId: string;
  step?: number;
  limit: number;
}): Promise<SequenceProspectRow[]> {
  const params: Array<string | number> = [input.sequenceId];
  let stepFilter = '';

  if (input.step !== undefined) {
    params.push(input.step);
    stepFilter = `AND p.current_step = $${params.length}`;
  }

  params.push(input.limit);

  const result = await query<SequenceProspectRow>(
    `SELECT p.id, p.full_name AS "fullName", p.email, p.phone,
            (COALESCE(p.phone, '') ~ '^(\\+33[67]|0[67])') AS "hasMobile",
            p.current_step AS "currentStep",
            p.sequence_status AS "sequenceStatus",
            p.next_step_at AS "nextStepAt",
            ls.last_sent AS "lastSentAt"
     FROM god_prospects p
     LEFT JOIN (
       SELECT prospect_id, MAX(sent_at) AS last_sent
       FROM god_sequence_sends
       GROUP BY prospect_id
     ) ls ON ls.prospect_id = p.id
     WHERE p.sequence_id = $1
       ${stepFilter}
     ORDER BY ls.last_sent DESC NULLS LAST
     LIMIT $${params.length}`,
    params,
  );
  return result.rows;
}
