import type { ClientView } from '@tuldio/types';
import { apiFetch } from '@/lib/api-fetch';

export async function fetchClients(): Promise<ClientView[]> {
  return apiFetch<ClientView[]>('/api/clients');
}

export async function fetchClientById(id: string): Promise<ClientView> {
  return apiFetch<ClientView>(`/api/clients/${id}`);
}

export async function searchClients(q: string): Promise<ClientView[]> {
  return apiFetch<ClientView[]>(`/api/clients/search?q=${encodeURIComponent(q)}`);
}
