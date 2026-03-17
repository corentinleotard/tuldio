import { findUnsentProspects } from '../repository/find-unsent-prospects.js';
import { updateProspectStatus } from '../repository/update-prospect-status.js';
import { getDailyCount, incrementDailyCount } from '../repository/god-send-log.js';
import { sendEmail } from '../domain/smtp-client.js';
import { buildProspectionEmailHtml } from '../domain/email-template.js';
import { logger } from '../../../lib/infra/logger.js';

const DEFAULT_DAILY_LIMIT = 10;
const DELAY_BETWEEN_EMAILS_MS = 120_000; // 2 minutes

export interface SendBatchAccepted {
  accepted: boolean;
  batchSize: number;
  dailyUsed: number;
  dailyRemaining: number;
}

export interface BatchStatus {
  running: boolean;
  sent: number;
  errors: number;
  total: number;
}

let currentBatch: BatchStatus = { running: false, sent: 0, errors: 0, total: 0 };

export function getBatchStatus(): BatchStatus {
  return { ...currentBatch };
}

const DRY_RUN = process.env.PROSPECTION_DRY_RUN === 'true';

export async function sendBatch(input: {
  count: number;
  subject: string;
  body: string;
}): Promise<SendBatchAccepted> {
  if (currentBatch.running) {
    return { accepted: false, batchSize: 0, dailyUsed: await getDailyCount(), dailyRemaining: 0 };
  }

  const dailyLimit = Number(process.env.PROSPECTION_DAILY_LIMIT || DEFAULT_DAILY_LIMIT);
  const dailyUsed = await getDailyCount();
  const remaining = Math.max(0, dailyLimit - dailyUsed);
  const toSend = Math.min(Math.max(0, input.count), remaining);

  if (toSend === 0) {
    return { accepted: true, batchSize: 0, dailyUsed, dailyRemaining: remaining };
  }

  const batch = await findUnsentProspects({ limit: toSend });

  if (batch.length === 0) {
    return { accepted: true, batchSize: 0, dailyUsed, dailyRemaining: remaining };
  }

  // Reserve the count immediately to prevent race conditions (skip in dry-run)
  if (!DRY_RUN) {
    await incrementDailyCount({ count: batch.length });
  }

  currentBatch = { running: true, sent: 0, errors: 0, total: batch.length };

  // Fire-and-forget — run in background
  runBatch(batch, input).catch((err) => {
    logger.error('god-prospection.batch-crash', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    currentBatch.running = false;
  });

  return {
    accepted: true,
    batchSize: batch.length,
    dailyUsed: dailyUsed + batch.length,
    dailyRemaining: Math.max(0, remaining - batch.length),
  };
}

async function runBatch(
  batch: Array<{ firstName: string; fullName: string; profession: string; email: string }>,
  input: { subject: string; body: string },
): Promise<void> {
  logger.info('god-prospection.batch-start', { count: batch.length, dryRun: DRY_RUN });

  for (const [i, prospect] of batch.entries()) {
    try {
      const html = buildProspectionEmailHtml({
        firstName: prospect.firstName,
        fullName: prospect.fullName,
        profession: prospect.profession,
        body: input.body,
      });

      if (DRY_RUN) {
        logger.info('god-prospection.dry-run', {
          to: prospect.email,
          nom: prospect.fullName,
          subject: input.subject,
          bodyPreview: html.slice(0, 200),
        });
      } else {
        await sendEmail({
          to: prospect.email,
          subject: input.subject,
          html,
        });
      }

      // Mark as sent immediately + store the email content
      if (!DRY_RUN) {
        await updateProspectStatus({
          email: prospect.email,
          status: 'sent',
          sentSubject: input.subject,
          sentBodyHtml: html,
        });
      }

      currentBatch.sent++;
      logger.info('god-prospection.sent', { to: prospect.email, nom: prospect.fullName });
    } catch (err) {
      currentBatch.errors++;
      logger.error('god-prospection.send-error', {
        to: prospect.email,
        error: err instanceof Error ? err.message : 'Unknown error',
      });

      // Mark as error so the prospect is not retried on next batch
      if (!DRY_RUN) {
        await updateProspectStatus({ email: prospect.email, status: 'error' });
      }
    }

    // Wait between emails (skip for last one, skip in dry-run)
    if (i < batch.length - 1 && !DRY_RUN) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_EMAILS_MS));
    }
  }

  currentBatch.running = false;
}

export async function sendTestEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const html = buildProspectionEmailHtml({
    firstName: 'Jean',
    fullName: 'DUPONT Jean',
    profession: 'Ostéopathe',
    body: input.body,
  });

  await sendEmail({
    to: input.to,
    subject: `[TEST] ${input.subject}`,
    html,
  });

  logger.info('god-prospection.test-sent', { to: input.to });
}
