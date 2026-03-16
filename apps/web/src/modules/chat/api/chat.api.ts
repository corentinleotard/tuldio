import type { Message, MessageMetadata } from '@tuldio/common';
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

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  const result = await apiFetch<{ text: string }>('/api/messages/transcribe', {
    method: 'POST',
    body: formData,
  });
  return result.text;
}
