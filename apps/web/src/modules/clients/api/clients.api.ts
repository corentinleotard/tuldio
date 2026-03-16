import type { ClientView } from '@tuldio/common';
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

export async function updateClient(input: {
  id: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  siret?: string;
  tvaNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<ClientView> {
  const { id, ...body } = input;
  return apiFetch<ClientView>(`/api/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
