import { apiFetch } from '@/lib/api-fetch';

export interface ProspectListResult {
  prospects: Array<{
    id: string;
    profession: string;
    firstName: string;
    fullName: string;
    email: string;
    phone: string | null;
    status: string;
  }>;
  professions: string[];
  totalWithEmail: number;
  totalSent: number;
  totalUnsent: number;
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
}

export interface SentEmailView {
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  profession: string;
  sentAt: string;
  sentSubject: string | null;
  sentBodyHtml: string | null;
}

export interface ReceivedEmail {
  id: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  date: string;
  textBody: string;
  messageId: string;
  inReplyTo: string | null;
}

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

export async function fetchProspects(): Promise<ProspectListResult> {
  return apiFetch<ProspectListResult>('/api/god-prospection/prospects');
}

export async function fetchSentEmails(input: {
  limit: number;
  offset: number;
}): Promise<{ emails: SentEmailView[]; total: number }> {
  return apiFetch(`/api/god-prospection/sent?limit=${input.limit}&offset=${input.offset}`);
}

export async function fetchReceivedEmails(input: {
  limit: number;
  olderThan?: string;
}): Promise<ReceivedEmail[]> {
  const params = new URLSearchParams({ limit: String(input.limit) });
  if (input.olderThan) params.set('olderThan', input.olderThan);
  return apiFetch(`/api/god-prospection/received?${params}`);
}

export interface ReceivedMessageView {
  id: string;
  channel: 'email' | 'whatsapp';
  from: string;
  fromName: string;
  subject: string | null;
  body: string;
  date: string;
  messageId: string | null;
  inReplyTo: string | null;
}

export async function fetchReceivedMessages(input: {
  channel: 'all' | 'email' | 'whatsapp';
  limit: number;
  olderThan?: string;
}): Promise<ReceivedMessageView[]> {
  const params = new URLSearchParams({ limit: String(input.limit), channel: input.channel });
  if (input.olderThan) params.set('olderThan', input.olderThan);
  return apiFetch(`/api/god-prospection/received-messages?${params}`);
}

export async function sendBatch(input: {
  count: number;
  body: string;
  profession: string | null;
}): Promise<SendBatchAccepted> {
  return apiFetch('/api/god-prospection/send', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function sendTestEmail(input: {
  to: string;
  body: string;
  profession: string | null;
}): Promise<void> {
  await apiFetch('/api/god-prospection/send-test', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchBatchStatus(): Promise<BatchStatus> {
  return apiFetch('/api/god-prospection/batch-status');
}

export async function cancelBatch(): Promise<{ cancelled: boolean }> {
  return apiFetch('/api/god-prospection/cancel', { method: 'POST' });
}

export async function replyToEmail(input: {
  to: string;
  subject: string;
  body: string;
  inReplyTo: string;
}): Promise<void> {
  await apiFetch('/api/god-prospection/reply', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface ProspectReport {
  byProfession: Array<{
    profession: string;
    total: number;
    newCount: number;
    sent: number;
    error: number;
    formContacted: number;
    avgScore: number | null;
  }>;
  total: number;
  totalNew: number;
  totalSent: number;
  totalError: number;
  totalFormContacted: number;
  recentProspects: Array<{
    id: string;
    profession: string;
    fullName: string;
    email: string;
    website: string | null;
    status: string;
    contactedVia: string | null;
    icpScore: number | null;
    icpReason: string | null;
    sentAt: string | null;
    createdAt: string;
  }>;
}

export async function fetchReport(): Promise<ProspectReport> {
  return apiFetch('/api/god-prospection/report');
}

export interface SendQueueProspect {
  id: string;
  profession: string;
  fullName: string;
  email: string;
  phone: string | null;
  website: string | null;
  icpScore: number | null;
  icpReason: string | null;
  hasMobile: boolean;
  status: string;
  sequenceStatus: string | null;
}

export async function fetchSendQueue(input: {
  profession: string | null;
  limit: number;
  includeContacted?: boolean;
}): Promise<SendQueueProspect[]> {
  const params = new URLSearchParams({ limit: String(input.limit) });
  if (input.profession) params.set('profession', input.profession);
  if (input.includeContacted) params.set('includeContacted', 'true');
  return apiFetch(`/api/god-prospection/send-queue?${params}`);
}

// --- Sequences ---

export interface SequenceStepView {
  id: string;
  stepOrder: number;
  channel: string;
  delayDays: number;
  subject: string | null;
  body: string;
}

export interface SequenceView {
  id: string;
  name: string;
  isActive: boolean;
  steps: SequenceStepView[];
  stats: { active: number; completed: number; replied: number; error: number };
}

export interface ChannelLimitView {
  channel: string;
  dailyLimit: number;
  dailyUsed: number;
}

export interface WhatsAppStatus {
  connected: boolean;
  phone: string | null;
}

export interface SequenceReportView {
  sequenceId: string;
  sequenceName: string;
  funnel: Array<{ stepOrder: number; channel: string; sent: number; pending: number }>;
  replyRate: number;
  totalAssigned: number;
  completed: number;
  errors: number;
  recentActivity: Array<{ prospectName: string; channel: string; stepOrder: number; sentAt: string }>;
}

export async function pauseProspect(input: {
  prospectId: string;
  paused: boolean;
}): Promise<void> {
  await apiFetch(`/api/god-prospection/prospects/${input.prospectId}/pause`, {
    method: 'PUT',
    body: JSON.stringify({ paused: input.paused }),
  });
}

export async function fetchSequences(): Promise<SequenceView[]> {
  return apiFetch('/api/god-prospection/sequences');
}

export async function createSequence(input: {
  name: string;
  steps: Array<{
    stepOrder: number;
    channel: string;
    delayDays: number;
    subject: string | null;
    body: string;
  }>;
}): Promise<{ id: string }> {
  return apiFetch('/api/god-prospection/sequences', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSequence(input: {
  id: string;
  name?: string;
  isActive?: boolean;
  steps?: Array<{
    stepOrder: number;
    channel: string;
    delayDays: number;
    subject: string | null;
    body: string;
  }>;
}): Promise<void> {
  const { id, ...body } = input;
  await apiFetch(`/api/god-prospection/sequences/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteSequence(input: { id: string }): Promise<void> {
  await apiFetch(`/api/god-prospection/sequences/${input.id}`, { method: 'DELETE' });
}

export async function assignToSequence(input: {
  prospectIds: string[];
  sequenceId: string;
}): Promise<{ assigned: number }> {
  return apiFetch('/api/god-prospection/sequences/assign', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface SequenceProspectView {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  hasMobile: boolean;
  currentStep: number;
  sequenceStatus: string;
  nextStepAt: string | null;
}

export async function fetchSequenceProspects(input: {
  sequenceId: string;
}): Promise<SequenceProspectView[]> {
  return apiFetch(`/api/god-prospection/sequences/${input.sequenceId}/prospects`);
}

export async function fetchSequenceReport(input: {
  sequenceId: string;
}): Promise<SequenceReportView> {
  return apiFetch(`/api/god-prospection/sequences/${input.sequenceId}/report`);
}

export async function fetchChannelLimits(): Promise<ChannelLimitView[]> {
  return apiFetch('/api/god-prospection/channel-limits');
}

export async function updateChannelLimitApi(input: {
  channel: string;
  dailyLimit: number;
}): Promise<void> {
  await apiFetch(`/api/god-prospection/channel-limits/${input.channel}`, {
    method: 'PUT',
    body: JSON.stringify({ dailyLimit: input.dailyLimit }),
  });
}

export async function setupWhatsApp(): Promise<WhatsAppStatus & { qrCode: string | null }> {
  return apiFetch('/api/god-prospection/whatsapp/setup', { method: 'POST' });
}

export async function fetchWhatsAppStatus(): Promise<WhatsAppStatus> {
  return apiFetch('/api/god-prospection/whatsapp/status');
}
