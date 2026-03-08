import { query } from '../../../lib/database/db.js';

export async function deleteQuote(input: {
  teamId: string;
  quoteId: string;
}): Promise<boolean> {
  const result = await query(
    'DELETE FROM quotes WHERE id = $1 AND team_id = $2 AND status = $3',
    [input.quoteId, input.teamId, 'draft'],
  );

  return (result.rowCount ?? 0) > 0;
}
