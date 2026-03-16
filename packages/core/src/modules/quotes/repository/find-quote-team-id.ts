import { query } from '../../../lib/database/db.js';

export async function findQuoteTeamId(input: {
  quoteId: string;
}): Promise<string | null> {
  const result = await query<{ team_id: string }>(
    'SELECT team_id FROM quotes WHERE id = $1 LIMIT 1',
    [input.quoteId],
  );
  return result.rows[0]?.team_id ?? null;
}
