import type { SiretLookupResponse, TeamSummary } from '@tuldio/types';
import { apiFetch } from '@/lib/api-fetch';

export { uploadTemplate } from '@/modules/settings/api/templates.api';

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
