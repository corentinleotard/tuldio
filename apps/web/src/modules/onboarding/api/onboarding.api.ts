import type { SiretLookupResponse, TeamSummary } from '@tuldio/types';
import { apiFetch } from '@/lib/api-fetch';

export async function lookupSiret(siret: string): Promise<SiretLookupResponse> {
  return apiFetch<SiretLookupResponse>(`/api/teams/siret/${siret}`);
}

export async function updateTeam(data: {
  name?: string;
  siret?: string;
  address?: string;
}): Promise<TeamSummary> {
  return apiFetch<TeamSummary>('/api/teams/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function uploadTemplate(input: {
  file: File;
  type: 'quote' | 'invoice';
}): Promise<void> {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('type', input.type);

  await apiFetch('/api/templates', {
    method: 'POST',
    body: JSON.stringify({ type: input.type, layoutData: {}, originalUrl: '' }),
  });
}
