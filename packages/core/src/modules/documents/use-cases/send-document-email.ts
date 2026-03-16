import { randomBytes } from 'node:crypto';
import type { QuoteView, InvoiceView } from '@tuldio/common';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { sendEmail } from '../../../lib/infra/send-email.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { getQuote } from '../../quotes/use-cases/get-quote.js';
import { getInvoice } from '../../invoices/use-cases/get-invoice.js';
import { updateQuoteStatusUc } from '../../quotes/use-cases/update-quote-status-uc.js';
import { updateInvoiceStatusUc } from '../../invoices/use-cases/update-invoice-status-uc.js';
import { insertDocumentLog } from '../repository/insert-document-log.js';
import { findDocumentLogs } from '../repository/find-document-logs.js';
import { buildDocumentEmailHtml } from '../domain/build-document-email-html.js';

export async function sendDocumentEmail(input: {
  teamId: string;
  documentType: 'quote' | 'invoice';
  documentId: string;
  baseUrl: string;
}): Promise<QuoteView | InvoiceView> {
  // 1. Fetch document
  let doc: QuoteView | InvoiceView;
  if (input.documentType === 'quote') {
    doc = await getQuote({ teamId: input.teamId, quoteId: input.documentId });
  } else {
    doc = await getInvoice({ teamId: input.teamId, invoiceId: input.documentId });
  }

  // 2. Rate limit: reject if email sent < 1 min ago (prevents spam on resend)
  if (doc.status !== 'draft') {
    const recentLogs = await findDocumentLogs({
      teamId: input.teamId,
      documentType: input.documentType,
      documentId: input.documentId,
      limit: 1,
    });
    const lastEmailSent = recentLogs.find((l) => l.event === 'email_sent');
    if (lastEmailSent && Date.now() - lastEmailSent.created_at.getTime() < 60_000) {
      throw new HandledError(errorCodes.emailRateLimited);
    }
  }

  // 3. Check client email
  if (!doc.clientEmail) {
    throw new HandledError(errorCodes.clientEmailRequired);
  }
  const recipientEmail = doc.clientEmail;

  // 3. If draft → transition to sent (handles readiness, PDF freeze, numbering)
  if (doc.status === 'draft') {
    if (input.documentType === 'quote') {
      doc = await updateQuoteStatusUc({ teamId: input.teamId, quoteId: input.documentId, status: 'sent' });
    } else {
      doc = await updateInvoiceStatusUc({ teamId: input.teamId, invoiceId: input.documentId, status: 'sent' });
    }
  }

  // 4. Generate download token (256-bit random, Stripe-style)
  const downloadToken = randomBytes(32).toString('hex');
  const downloadUrl = `${input.baseUrl}/api/d/${downloadToken}`;

  // 5. Build email
  const team = await findTeamById(input.teamId);
  const teamName = team?.name ?? 'Votre prestataire';
  const docLabel = input.documentType === 'quote' ? 'Devis' : 'Facture';
  const subject = `${docLabel} ${doc.number} — ${teamName}`;
  const html = buildDocumentEmailHtml({
    teamName,
    documentType: input.documentType,
    documentNumber: doc.number,
    totalTtc: doc.totalTtc,
    downloadUrl,
  });

  // 6. Send via Resend — if this fails, status is already 'sent' but that's recoverable (user can resend)
  try {
    await sendEmail({ to: recipientEmail, subject, html });
  } catch (err) {
    logger.error('document.email_failed', {
      teamId: input.teamId,
      documentType: input.documentType,
      documentId: input.documentId,
      recipientEmail,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // 7. Log email_sent with download token
  await insertDocumentLog({
    teamId: input.teamId,
    documentType: input.documentType,
    documentId: input.documentId,
    event: 'email_sent',
    recipientEmail,
    downloadToken,
  });

  logger.info('document.email_sent', {
    teamId: input.teamId,
    documentType: input.documentType,
    documentId: input.documentId,
    recipientEmail,
  });

  return doc;
}
