import { query } from '../../../lib/database/db.js';

export async function updateQuoteStatus(input: {
  teamId: string;
  quoteId: string;
  status: string;
}): Promise<void> {
  const timestampSetMap: Record<string, string> = {
    sent: ', sent_at = NOW()',
    accepted: ', accepted_at = NOW()',
    refused: ', refused_at = NOW()',
    cancelled: ', cancelled_at = NOW()',
  };
  const extraSets = timestampSetMap[input.status] ?? '';

  await query(
    `UPDATE quotes SET status = $1${extraSets} WHERE id = $2 AND team_id = $3`,
    [input.status, input.quoteId, input.teamId],
  );
}
