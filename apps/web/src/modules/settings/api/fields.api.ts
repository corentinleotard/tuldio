import type { TeamField, TeamSummary, UpdateTeamFieldRequest, CreateTeamFieldRequest, UpdateTeamSettingsRequest } from '@tuldio/types';
import { apiFetch, API_URL } from '@/lib/api-fetch';

export async function fetchTeamFields(): Promise<TeamField[]> {
  return apiFetch<TeamField[]>('/api/teams/me/fields');
}

export async function updateTeamField(fieldId: string, data: UpdateTeamFieldRequest): Promise<TeamField> {
  return apiFetch<TeamField>(`/api/teams/me/fields/${fieldId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function createTeamField(data: CreateTeamFieldRequest): Promise<TeamField> {
  return apiFetch<TeamField>('/api/teams/me/fields', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTeamField(fieldId: string): Promise<void> {
  return apiFetch<void>(`/api/teams/me/fields/${fieldId}`, {
    method: 'DELETE',
  });
}

export async function uploadLogo(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/api/teams/me/logo`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) throw new Error('Erreur lors de l\'envoi du logo');
  const body = await res.json();
  return body.data.logoUrl;
}

export async function deleteLogo(): Promise<void> {
  return apiFetch<void>('/api/teams/me/logo', { method: 'DELETE' });
}

export async function updateTeamSettings(data: UpdateTeamSettingsRequest): Promise<TeamSummary> {
  return apiFetch<TeamSummary>('/api/teams/me/settings', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
