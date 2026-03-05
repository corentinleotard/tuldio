import type { AuthResponse, BootstrapResponse } from '@tuldio/types';
import { apiFetch } from '@/lib/api-fetch';

export async function sendOtp(email: string): Promise<void> {
  await apiFetch('/api/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(input: { email: string; code: string }): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getBootstrap(): Promise<BootstrapResponse> {
  return apiFetch<BootstrapResponse>('/api/auth/bootstrap');
}

export async function signOut(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}
