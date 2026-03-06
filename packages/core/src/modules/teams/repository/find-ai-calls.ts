import { query } from '../../../lib/database/db.js';

interface AiCallRow {
  id: string;
  model: string;
  purpose: string;
  input_tokens: number;
  output_tokens: number;
  cost_cents: number;
  duration_ms: number;
  created_at: Date;
}

interface AiCallsSummaryRow {
  total_cost_cents: number;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

export async function findAiCalls(input: { teamId: string; limit?: number }) {
  const limit = input.limit ?? 100;

  const [summaryResult, callsResult] = await Promise.all([
    query<AiCallsSummaryRow>(
      `SELECT
        COALESCE(SUM(cost_cents), 0) AS total_cost_cents,
        COUNT(*)::int AS total_calls,
        COALESCE(SUM(input_tokens), 0)::int AS total_input_tokens,
        COALESCE(SUM(output_tokens), 0)::int AS total_output_tokens
      FROM ai_calls WHERE team_id = $1`,
      [input.teamId],
    ),
    query<AiCallRow>(
      `SELECT id, model, purpose, input_tokens, output_tokens, cost_cents, duration_ms, created_at
       FROM ai_calls WHERE team_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [input.teamId, limit],
    ),
  ]);

  const summary = summaryResult.rows[0]!;

  return {
    totalCostCents: Number(summary.total_cost_cents),
    totalCalls: summary.total_calls,
    totalInputTokens: summary.total_input_tokens,
    totalOutputTokens: summary.total_output_tokens,
    calls: callsResult.rows.map((row) => ({
      id: row.id,
      model: row.model,
      purpose: row.purpose,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      costCents: Number(row.cost_cents),
      durationMs: row.duration_ms,
      createdAt: row.created_at.toISOString(),
    })),
  };
}
