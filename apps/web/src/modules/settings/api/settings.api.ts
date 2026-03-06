import type { AiCostsSummary, Message } from '@tuldio/types';
import { apiFetch } from '@/lib/api-fetch';

export async function fetchAiCosts(): Promise<AiCostsSummary> {
  return apiFetch<AiCostsSummary>('/api/teams/me/ai-costs');
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  teamId: string;
}

export async function fetchUsers(): Promise<UserSummary[]> {
  return apiFetch<UserSummary[]>('/api/admin/users');
}

export async function fetchDebugMessages(userId: string): Promise<Message[]> {
  return apiFetch<Message[]>(`/api/admin/users/${userId}/messages`);
}
