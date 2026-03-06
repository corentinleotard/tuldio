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

export async function downloadPreviewPdf(type: 'quote' | 'invoice'): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3003';
  const response = await fetch(`${baseUrl}/api/teams/me/preview-pdf?type=${type}`, {
    credentials: 'include',
  });

  if (!response.ok) throw new Error('Erreur lors du telechargement');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = type === 'quote' ? 'apercu-devis.pdf' : 'apercu-facture.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

export async function uploadDocument(file: File): Promise<TeamSummary> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<TeamSummary>('/api/teams/me/document', {
    method: 'POST',
    body: formData,
  });
}
