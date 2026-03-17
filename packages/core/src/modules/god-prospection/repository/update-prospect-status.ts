import { query } from '../../../lib/database/db.js';

export async function updateProspectStatus(input: {
  email: string;
  status: 'sent' | 'error';
  sentSubject?: string;
  sentBodyHtml?: string;
}): Promise<void> {
  await query(
    `UPDATE god_prospects
     SET status = $1,
         sent_at = CASE WHEN $1 = 'sent' THEN now() ELSE sent_at END,
         sent_subject = COALESCE($3, sent_subject),
         sent_body_html = COALESCE($4, sent_body_html),
         updated_at = now()
     WHERE lower(email) = lower($2)
       AND status = 'new'`,
    [input.status, input.email, input.sentSubject ?? null, input.sentBodyHtml ?? null],
  );
}
