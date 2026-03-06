import type { TeamSummary, UpdateTeamRequest } from '@tuldio/types';
import { apiFetch } from '@/lib/api-fetch';

export async function updateTeam(data: UpdateTeamRequest): Promise<TeamSummary> {
  return apiFetch<TeamSummary>('/api/teams/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function acceptTerms(): Promise<TeamSummary> {
  return apiFetch<TeamSummary>('/api/teams/me/accept-terms', {
    method: 'POST',
  });
}

export async function uploadDocument(file: File): Promise<{ originalDocumentUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<{ originalDocumentUrl: string }>('/api/teams/me/document', {
    method: 'POST',
    body: formData,
  });
}
