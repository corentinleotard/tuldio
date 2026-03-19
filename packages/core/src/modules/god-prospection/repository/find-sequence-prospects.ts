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
    stepFilter = `AND current_step = $${params.length}`;
  }

  params.push(input.limit);

  const result = await query<SequenceProspectRow>(
    `SELECT id, full_name AS "fullName", email, phone,
            (COALESCE(phone, '') ~ '^(\\+33[67]|0[67])') AS "hasMobile",
            current_step AS "currentStep",
            sequence_status AS "sequenceStatus",
            next_step_at AS "nextStepAt"
     FROM god_prospects
     WHERE sequence_id = $1
       ${stepFilter}
     ORDER BY sequence_status ASC, current_step DESC, next_step_at ASC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows;
}
