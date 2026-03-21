import { query as defaultQuery } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type pg from 'pg';

export async function insertSequenceSteps(input: {
  sequenceId: string;
  steps: Array<{
    stepOrder: number;
    channel: string;
    delayDays: number;
    subject: string | null;
    body: string;
    linkText: string | null;
  }>;
  tx?: { query: <R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) => Promise<pg.QueryResult<R>> };
}): Promise<void> {
  if (input.steps.length === 0) return;

  const q = input.tx?.query ?? defaultQuery;
  const values: string[] = [];
  const params: Array<string | number | null> = [];

  for (const step of input.steps) {
    const offset = params.length;
    values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
    params.push(generateId(), input.sequenceId, step.stepOrder, step.channel, step.delayDays, step.subject, step.body, step.linkText);
  }

  await q(
    `INSERT INTO god_sequence_steps (id, sequence_id, step_order, channel, delay_days, subject, body, link_text)
     VALUES ${values.join(', ')}`,
    params,
  );
}
