import type { TemplateView } from '@tuldio/types';
import { apiFetch } from '@/lib/api-fetch';

export async function fetchTemplates(): Promise<TemplateView[]> {
  return apiFetch<TemplateView[]>('/api/templates');
}

export async function uploadTemplate(input: {
  file: File;
  type: 'quote' | 'invoice';
}): Promise<TemplateView> {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('type', input.type);

  return apiFetch<TemplateView>('/api/templates', {
    method: 'POST',
    body: formData,
  });
}
