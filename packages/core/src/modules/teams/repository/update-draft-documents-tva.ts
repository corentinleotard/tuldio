import { query } from '../../../lib/database/db.js';

/**
 * When tva_exempt changes, update all draft quote/invoice lines and recompute totals.
 * - exempt = true  → set all lines to tva_rate = 0
 * - exempt = false → set all lines to tva_rate = 2000 (20% default)
 */
export async function updateDraftDocumentsTva(input: {
  teamId: string;
  tvaExempt: boolean;
}): Promise<void> {
  const tvaRate = input.tvaExempt ? 0 : 2000;

  // Update quote lines + recompute quote totals
  await query(
    `UPDATE quote_lines SET tva_rate = $1
     WHERE quote_id IN (SELECT id FROM quotes WHERE team_id = $2 AND status = 'draft')`,
    [tvaRate, input.teamId],
  );

  await query(
    `UPDATE quotes SET
       total_ttc = total_ht + ROUND(total_ht::bigint * $1 / 10000)
     WHERE team_id = $2 AND status = 'draft'`,
    [tvaRate, input.teamId],
  );

  // Update invoice lines + recompute invoice totals
  await query(
    `UPDATE invoice_lines SET tva_rate = $1
     WHERE invoice_id IN (SELECT id FROM invoices WHERE team_id = $2 AND status = 'draft')`,
    [tvaRate, input.teamId],
  );

  await query(
    `UPDATE invoices SET
       total_ttc = total_ht + ROUND(total_ht::bigint * $1 / 10000)
     WHERE team_id = $2 AND status = 'draft'`,
    [tvaRate, input.teamId],
  );
}
