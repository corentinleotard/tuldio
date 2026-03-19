import {
  markProspectReplied,
  insertReceivedMessage,
  fetchInboxEmails,
  getReplyWatermark,
  setReplyWatermark,
} from '@tuldio/core/god-prospection';
import { schedule } from '../lib/schedule.js';
import { logger } from '@tuldio/core/lib';

schedule({
  name: 'god-prospection:check-replies',
  expression: '*/15 * * * *',
  fn: async () => {
    const lastUid = await getReplyWatermark();

    const emails = await fetchInboxEmails({ limit: 100, olderThan: null });
    if (emails.length === 0) return;

    const newEmails = lastUid > 0
      ? emails.filter((e) => parseInt(e.id, 10) > lastUid)
      : emails;

    if (newEmails.length === 0) return;

    let maxUid = lastUid;

    for (const email of newEmails) {
      const uid = parseInt(email.id, 10);
      if (uid > maxUid) maxUid = uid;

      try {
        // Store in unified received messages table
        await insertReceivedMessage({
          channel: 'email',
          sender: email.from,
          senderName: email.fromName,
          subject: email.subject,
          body: email.textBody,
        });

        // Mark prospect as replied (stops sequence)
        await markProspectReplied({ email: email.from });
      } catch (err) {
        logger.error('god-prospection.reply-check-error', {
          from: email.from,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    if (maxUid > lastUid) {
      await setReplyWatermark({ uid: maxUid });
    }

    logger.info('god-prospection.replies-checked', { processed: newEmails.length });
  },
});
