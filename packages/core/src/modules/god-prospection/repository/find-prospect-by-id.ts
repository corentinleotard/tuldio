import { query } from '../../../lib/database/db.js';

export interface GodProspectRow {
  id: string;
  profession: string;
  firstName: string;
  fullName: string;
  email: string;
  phone: string | null;
  whatsappPhone: string | null;
  website: string | null;
  status: string;
  sequenceStatus: string | null;
  currentStep: number;
  nextStepAt: string | null;
  sentAt: string | null;
  sentSubject: string | null;
  icpScore: number | null;
  icpReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function findProspectById(input: {
  id: string;
}): Promise<GodProspectRow | null> {
  const result = await query<GodProspectRow>(
    `SELECT id, profession, first_name AS "firstName", full_name AS "fullName",
            email, phone, whatsapp_phone AS "whatsappPhone", website, status,
            sequence_status AS "sequenceStatus", current_step AS "currentStep",
            next_step_at AS "nextStepAt", sent_at AS "sentAt",
            sent_subject AS "sentSubject",
            icp_score AS "icpScore", icp_reason AS "icpReason",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM god_prospects
     WHERE id = $1`,
    [input.id],
  );
  return result.rows[0] ?? null;
}
