import { findProspectsDueForStep } from '../repository/find-prospects-due-for-step.js';
import { advanceProspectStep } from '../repository/advance-prospect-step.js';
import { findChannelLimits } from '../repository/find-channel-limits.js';
import { getDailyCount, incrementDailyCount } from '../repository/god-send-log.js';
import { findStepsBySequence } from '../repository/find-steps-by-sequence.js';
import { checkProspectStillActive } from '../repository/check-prospect-still-active.js';
import { sendEmail } from '../domain/smtp-client.js';
import { sendWhatsAppMessage, getWhatsAppStatus } from '../domain/whatsapp-client.js';
import { buildMessageText } from '../domain/sequence-template.js';
import { buildProspectionEmailHtml } from '../domain/email-template.js';
import { normalizePhoneToInternational } from '../domain/phone-utils.js';
import { buildInvitePayload } from '../domain/invite-payload.js';
import { insertInviteCode } from '../../auth/repository/insert-invite-code.js';
import { insertSequenceSend } from '../repository/insert-sequence-send.js';
import { logger } from '../../../lib/infra/logger.js';
import type { GodSequenceStepRow } from '../repository/find-steps-by-sequence.js';

const APP_URL = process.env.APP_URL || 'https://app.tuldio.fr';
const DRY_RUN = process.env.PROSPECTION_DRY_RUN === 'true';
const MIN_DELAY_MS = 120_000; // 2 minutes
const MAX_DELAY_MS = 300_000; // 5 minutes

function isBusinessHours(): boolean {
  const now = new Date();
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const hour = parisTime.getHours();
  return hour >= 8 && hour <= 20;
}

function randomDelay(): number {
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

export async function runSequenceStep(): Promise<void> {
  if (!isBusinessHours()) {
    logger.debug('god-prospection.sequence-skip-hours', { reason: 'outside business hours' });
    return;
  }

  const limits = await findChannelLimits();
  const channels = ['email', 'whatsapp'] as const;

  for (const channel of channels) {
    const limitRow = limits.find((l) => l.channel === channel);
    const dailyLimit = limitRow?.dailyLimit ?? 0;
    if (dailyLimit === 0) continue;

    if (channel === 'whatsapp') {
      const status = getWhatsAppStatus();
      if (!status.connected) {
        logger.debug('god-prospection.sequence-skip-whatsapp', { reason: 'not connected' });
        continue;
      }
    }

    const dailyUsed = await getDailyCount({ channel });
    const remaining = Math.max(0, dailyLimit - dailyUsed);
    if (remaining === 0) {
      logger.debug('god-prospection.sequence-limit-reached', { channel, dailyUsed, dailyLimit });
      continue;
    }

    const dueProspects = await findProspectsDueForStep({ channel, dueWithinHours: 0, limit: remaining });
    if (dueProspects.length === 0) continue;

    logger.info('god-prospection.sequence-batch', { channel, count: dueProspects.length });

    const stepsCache = new Map<string, GodSequenceStepRow[]>();

    for (const [i, prospect] of dueProspects.entries()) {
      // ANTI-SPAM GUARD 1: Re-check daily limit before each send
      const currentUsed = await getDailyCount({ channel });
      if (currentUsed >= dailyLimit) {
        logger.info('god-prospection.sequence-limit-mid-batch', { channel, currentUsed, dailyLimit });
        break;
      }

      // ANTI-SPAM GUARD 2: Re-check prospect is still active (may have replied/been paused since batch start)
      const stillActive = await checkProspectStillActive({ prospectId: prospect.id });
      if (!stillActive) {
        logger.info('god-prospection.sequence-skip-inactive', { prospectId: prospect.id });
        continue;
      }

      // ANTI-SPAM GUARD 3: Reserve daily count BEFORE sending (not after)
      // If send fails, we decrement. Better to under-send than over-send.
      if (!DRY_RUN) {
        await incrementDailyCount({ channel, count: 1 });
      }

      try {
        const { payload: invitePayload, expiresAt } = buildInvitePayload({
          fullName: prospect.fullName,
          firstName: prospect.firstName,
          phone: prospect.phone,
          website: prospect.website,
          profession: prospect.profession,
        });
        const code = await insertInviteCode({ payload: invitePayload, expiresAt });
        const inviteUrl = `${APP_URL}/i/${code}`;

        let sentSubject: string | null = null;
        let sentBody = '';

        if (channel === 'email') {
          const html = buildProspectionEmailHtml({
            firstName: prospect.firstName,
            fullName: prospect.fullName,
            profession: prospect.profession,
            body: prospect.body,
            inviteUrl,
          });

          sentSubject = prospect.subject || 'Vos devis et factures, vous les faites comment ?';
          sentBody = html;

          if (DRY_RUN) {
            logger.info('god-prospection.sequence-dry-run', { channel, to: prospect.email, subject: sentSubject });
          } else {
            await sendEmail({ to: prospect.email, subject: sentSubject, html });
          }
        } else if (channel === 'whatsapp') {
          const text = buildMessageText({
            template: prospect.body,
            prospect: { firstName: prospect.firstName, fullName: prospect.fullName, profession: prospect.profession },
            inviteUrl,
          });

          sentBody = text;

          const rawPhone = prospect.whatsappPhone || prospect.phone;
          if (!rawPhone) {
            logger.warn('god-prospection.sequence-no-phone', { prospectId: prospect.id });
            if (!DRY_RUN) {
              await incrementDailyCount({ channel, count: -1 });
            }
            await advanceProspectStep({
              prospectId: prospect.id,
              nextStepOrder: prospect.currentStep,
              nextStepAt: null,
              sequenceStatus: 'error',
            });
            continue;
          }

          const normalizedPhone = normalizePhoneToInternational({ phone: rawPhone });

          if (DRY_RUN) {
            logger.info('god-prospection.sequence-dry-run', { channel, to: normalizedPhone });
          } else {
            await sendWhatsAppMessage({ phone: normalizedPhone, text });
          }
        }

        // Post-send bookkeeping (must not fail the send -- wrapped separately)
        try {
          // Record the send in history with the actual content sent
          if (!DRY_RUN) {
            await insertSequenceSend({
              prospectId: prospect.id,
              sequenceId: prospect.sequenceId,
              stepOrder: prospect.currentStep,
              channel,
              subject: sentSubject,
              body: sentBody,
            });
          }

          // Advance to next step IMMEDIATELY after send (before delay)
          let allSteps = stepsCache.get(prospect.sequenceId);
          if (!allSteps) {
            allSteps = await findStepsBySequence({ sequenceId: prospect.sequenceId });
            stepsCache.set(prospect.sequenceId, allSteps);
          }

          const sortedSteps = allSteps.sort((a, b) => a.stepOrder - b.stepOrder);
          const currentIdx = sortedSteps.findIndex((s) => s.stepOrder === prospect.currentStep);
          const nextStep = currentIdx >= 0 ? sortedSteps[currentIdx + 1] : undefined;

          if (nextStep) {
            const nextStepAt = new Date(Date.now() + nextStep.delayDays * 24 * 60 * 60 * 1000);
            await advanceProspectStep({
              prospectId: prospect.id,
              nextStepOrder: nextStep.stepOrder,
              nextStepAt,
              sequenceStatus: 'active',
            });
          } else {
            await advanceProspectStep({
              prospectId: prospect.id,
              nextStepOrder: prospect.currentStep + 1,
              nextStepAt: null,
              sequenceStatus: 'completed',
            });
          }
        } catch (bookkeepingErr) {
          // Send succeeded but bookkeeping failed -- log but don't mark as error
          logger.error('god-prospection.sequence-bookkeeping-error', {
            prospectId: prospect.id,
            error: bookkeepingErr instanceof Error ? bookkeepingErr.message : 'Unknown error',
          });
        }

        logger.info('god-prospection.sequence-sent', { channel, prospectId: prospect.id, step: prospect.currentStep });
      } catch (err) {
        logger.error('god-prospection.sequence-error', {
          channel,
          prospectId: prospect.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });

        // Decrement daily count since send failed (we pre-reserved)
        if (!DRY_RUN) {
          await incrementDailyCount({ channel, count: -1 });
        }

        await advanceProspectStep({
          prospectId: prospect.id,
          nextStepOrder: prospect.currentStep,
          nextStepAt: null,
          sequenceStatus: 'error',
        });
      }

      // Wait between sends (skip for last one, skip in dry-run)
      if (i < dueProspects.length - 1 && !DRY_RUN) {
        await new Promise((r) => setTimeout(r, randomDelay()));
      }
    }
  }
}
