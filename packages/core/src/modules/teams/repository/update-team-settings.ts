import { query } from '../../../lib/database/db.js';

export async function updateTeamSettings(input: {
  teamId: string;
  quoteLastNumber?: number;
  quoteValidityDays?: number;
  invoiceLastNumber?: number;
  invoicePaymentDelayDays?: number;
}): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.quoteLastNumber !== undefined) {
    sets.push(`quote_last_number = $${idx++}`);
    params.push(input.quoteLastNumber);
  }
  if (input.quoteValidityDays !== undefined) {
    sets.push(`quote_validity_days = $${idx++}`);
    params.push(input.quoteValidityDays);
  }
  if (input.invoiceLastNumber !== undefined) {
    sets.push(`invoice_last_number = $${idx++}`);
    params.push(input.invoiceLastNumber);
  }
  if (input.invoicePaymentDelayDays !== undefined) {
    sets.push(`invoice_payment_delay_days = $${idx++}`);
    params.push(input.invoicePaymentDelayDays);
  }

  if (sets.length === 0) return;

  params.push(input.teamId);

  await query(
    `UPDATE teams SET ${sets.join(', ')} WHERE id = $${idx}`,
    params,
  );
}
