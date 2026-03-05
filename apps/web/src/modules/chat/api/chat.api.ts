import type { Message } from '@tuldio/types';
import { apiFetch } from '@/lib/api-fetch';

export async function sendMessage(content: string): Promise<Message> {
  return apiFetch<Message>('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function fetchMessages(cursor?: string): Promise<Message[]> {
  const params = cursor ? `?cursor=${cursor}` : '';
  return apiFetch<Message[]>(`/api/messages${params}`);
}
