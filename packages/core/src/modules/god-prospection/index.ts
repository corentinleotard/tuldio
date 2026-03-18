export { listProspects, type ProspectListResult } from './use-cases/list-prospects.js';
export { sendBatch, sendTestEmail, getBatchStatus, type SendBatchAccepted, type BatchStatus } from './use-cases/send-batch.js';
export { listSentEmails, type SentEmailView } from './use-cases/list-sent-emails.js';
export { listReceivedEmails, type ReceivedEmail } from './use-cases/list-received-emails.js';
export { replyToEmail } from './use-cases/reply-to-email.js';
export { upsertProspects } from './repository/upsert-prospects.js';
export { getProspectReport, type ProspectReport } from './use-cases/get-prospect-report.js';
export { findSendQueue, type SendQueueProspect } from './repository/find-send-queue.js';
