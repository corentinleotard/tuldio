export { listProspects, type ProspectListResult } from './use-cases/list-prospects.js';
export { sendBatch, sendTestEmail, getBatchStatus, cancelBatch, type SendBatchAccepted, type BatchStatus } from './use-cases/send-batch.js';
export { listSentEmails, type SentEmailView } from './use-cases/list-sent-emails.js';
export { listReceivedEmails, type ReceivedEmail } from './use-cases/list-received-emails.js';
export { replyToEmail } from './use-cases/reply-to-email.js';
export { upsertProspects } from './repository/upsert-prospects.js';
export { getProspectReport, type ProspectReport } from './use-cases/get-prospect-report.js';
export { findSendQueue, type SendQueueProspect } from './repository/find-send-queue.js';

// Sequences
export { createSequence } from './use-cases/create-sequence.js';
export { updateSequenceUc } from './use-cases/update-sequence.js';
export { deleteSequenceUc } from './use-cases/delete-sequence.js';
export { listSequences, type SequenceView } from './use-cases/list-sequences.js';
export { assignToSequence } from './use-cases/assign-to-sequence.js';
export { runSequenceStep } from './use-cases/run-sequence-step.js';
export { getSequenceReport, type SequenceReportView } from './use-cases/get-sequence-report.js';

// Channel limits
export { getChannelLimits, type ChannelLimitView } from './use-cases/get-channel-limits.js';
export { updateChannelLimitsUc } from './use-cases/update-channel-limits.js';

// WhatsApp
export { setupWhatsApp } from './use-cases/setup-whatsapp.js';
export { getWhatsAppStatusUc } from './use-cases/get-whatsapp-status.js';
export { readWhatsAppStatus, requestWhatsAppConnect, consumeConnectRequest } from './domain/whatsapp-status-file.js';

// Prospect management
export { pauseProspectUc } from './use-cases/pause-prospect.js';
export { findSequenceProspects, type SequenceProspectRow } from './repository/find-sequence-prospects.js';
export { findProspectById, type GodProspectRow } from './repository/find-prospect-by-id.js';
export { updateProspectFields } from './repository/update-prospect-fields.js';

// Domain helpers (for test endpoints)
export { sendWhatsAppMessage } from './domain/whatsapp-client.js';
export { normalizePhoneToInternational } from './domain/phone-utils.js';
export { buildMessageText } from './domain/sequence-template.js';

// Send history
export { findRecentSends, type RecentSendRow } from './repository/find-recent-sends.js';
export { findProspectsDueForStep, type DueProspectRow } from './repository/find-prospects-due-for-step.js';

// Received messages
export { listReceivedMessages, type ReceivedMessageView } from './use-cases/list-received-messages.js';
export { insertReceivedMessage } from './repository/insert-received-message.js';

// Reply detection
export { markProspectReplied } from './repository/mark-prospect-replied.js';
export { getReplyWatermark, setReplyWatermark } from './repository/find-reply-watermark.js';
export { fetchInboxEmails } from './domain/imap-client.js';
