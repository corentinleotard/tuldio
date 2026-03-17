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

export async function sendBatch(input: {
  count: number;
  subject: string;
  body: string;
}): Promise<SendBatchAccepted> {
  return apiFetch('/api/god-prospection/send', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function sendTestEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  await apiFetch('/api/god-prospection/send-test', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchBatchStatus(): Promise<BatchStatus> {
  return apiFetch('/api/god-prospection/batch-status');
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
