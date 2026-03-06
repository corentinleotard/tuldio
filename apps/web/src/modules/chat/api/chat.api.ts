import type { Message, MessageMetadata } from '@tuldio/types';
import { apiFetch } from '@/lib/api-fetch';

export async function sendMessage(content: string, metadata?: MessageMetadata): Promise<Message> {
  return apiFetch<Message>('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ content, metadata }),
  });
}

export async function fetchMessages(cursor?: string): Promise<Message[]> {
  const params = cursor ? `?cursor=${cursor}` : '';
  return apiFetch<Message[]>(`/api/messages${params}`);
}
