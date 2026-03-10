import { query } from '../../../lib/database/db.js';

/**
 * Recompute derived fields on all draft quotes and invoices for a team.
 * Called when team settings or tva_exempt change.
 *
 * - tvaExempt changed → update line tva_rates + recompute totals
 * - quoteValidityDays changed → recompute valid_until on draft quotes
 * - invoicePaymentDelayDays changed → recompute due_date on draft invoices
 */
export async function refreshDraftDocuments(input: {
  teamId: string;
  tvaExempt?: boolean;
  quoteValidityDays?: number;
  invoicePaymentDelayDays?: number;
}): Promise<void> {
  const { teamId, tvaExempt, quoteValidityDays, invoicePaymentDelayDays } = input;

  // --- TVA ---
  if (tvaExempt !== undefined) {
    const tvaRate = tvaExempt ? 0 : 2000;

    await query(
      `UPDATE quote_lines SET tva_rate = $1
       WHERE quote_id IN (SELECT id FROM quotes WHERE team_id = $2 AND status = 'draft')`,
      [tvaRate, teamId],
    );

    await query(
      `UPDATE quotes SET
         total_ttc = total_ht + ROUND(total_ht::bigint * $1 / 10000)
       WHERE team_id = $2 AND status = 'draft'`,
      [tvaRate, teamId],
    );

    await query(
      `UPDATE invoice_lines SET tva_rate = $1
       WHERE invoice_id IN (SELECT id FROM invoices WHERE team_id = $2 AND status = 'draft')`,
      [tvaRate, teamId],
    );

    await query(
      `UPDATE invoices SET
         total_ttc = total_ht + ROUND(total_ht::bigint * $1 / 10000)
       WHERE team_id = $2 AND status = 'draft'`,
      [tvaRate, teamId],
    );
  }

  // --- Quote validity ---
  if (quoteValidityDays !== undefined) {
    await query(
      `UPDATE quotes SET
         valid_until = created_at + make_interval(days => $1)
       WHERE team_id = $2 AND status = 'draft'`,
      [quoteValidityDays, teamId],
    );
  }

  // --- Invoice payment delay ---
  if (invoicePaymentDelayDays !== undefined) {
    await query(
      `UPDATE invoices SET
         due_date = created_at + make_interval(days => $1)
       WHERE team_id = $2 AND status = 'draft'`,
      [invoicePaymentDelayDays, teamId],
    );
  }
}
