import { query } from '../../../lib/database/db.js';

export interface SequenceView {
  id: string;
  name: string;
  isActive: boolean;
  steps: Array<{
    id: string;
    stepOrder: number;
    channel: string;
    delayDays: number;
    subject: string | null;
    body: string;
    linkText: string | null;
  }>;
  stats: {
    active: number;
    completed: number;
    replied: number;
    error: number;
  };
}

export async function listSequences(): Promise<SequenceView[]> {
  // Fetch all data in 3 queries instead of N+1
  const [seqResult, stepsResult, statsResult] = await Promise.all([
    query<{
      id: string;
      name: string;
      isActive: boolean;
    }>(
      `SELECT id, name, is_active AS "isActive"
       FROM god_sequences
       ORDER BY created_at DESC`,
      [],
    ),
    query<{
      id: string;
      sequenceId: string;
      stepOrder: number;
      channel: string;
      delayDays: number;
      subject: string | null;
      body: string;
      linkText: string | null;
    }>(
      `SELECT id, sequence_id AS "sequenceId", step_order AS "stepOrder",
              channel, delay_days AS "delayDays", subject, body,
              link_text AS "linkText"
       FROM god_sequence_steps
       ORDER BY step_order ASC`,
      [],
    ),
    query<{
      sequenceId: string;
      active: number;
      completed: number;
      replied: number;
      error: number;
    }>(
      `SELECT sequence_id AS "sequenceId",
              COUNT(*) FILTER (WHERE sequence_status = 'active')::int AS active,
              COUNT(*) FILTER (WHERE sequence_status = 'completed')::int AS completed,
              COUNT(*) FILTER (WHERE sequence_status = 'replied')::int AS replied,
              COUNT(*) FILTER (WHERE sequence_status = 'error')::int AS error
       FROM god_prospects
       WHERE sequence_id IS NOT NULL
       GROUP BY sequence_id`,
      [],
    ),
  ]);

  // Index steps and stats by sequenceId
  const stepsBySeq = new Map<string, SequenceView['steps']>();
  for (const s of stepsResult.rows) {
    const list = stepsBySeq.get(s.sequenceId) ?? [];
    list.push({
      id: s.id,
      stepOrder: s.stepOrder,
      channel: s.channel,
      delayDays: s.delayDays,
      subject: s.subject,
      body: s.body,
      linkText: s.linkText,
    });
    stepsBySeq.set(s.sequenceId, list);
  }

  const statsBySeq = new Map<string, SequenceView['stats']>();
  for (const s of statsResult.rows) {
    statsBySeq.set(s.sequenceId, {
      active: s.active,
      completed: s.completed,
      replied: s.replied,
      error: s.error,
    });
  }

  return seqResult.rows.map((seq) => ({
    id: seq.id,
    name: seq.name,
    isActive: seq.isActive,
    steps: stepsBySeq.get(seq.id) ?? [],
    stats: statsBySeq.get(seq.id) ?? { active: 0, completed: 0, replied: 0, error: 0 },
  }));
}
