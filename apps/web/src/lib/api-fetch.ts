export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (isRefreshing) return refreshPromise!;

  isRefreshing = true;
  refreshPromise = fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const doFetch = () =>
    fetch(`${API_URL}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options?.headers,
      },
    });

  let res: Response;

  try {
    res = await doFetch();
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Erreur réseau');
  }

  // Auto-refresh on 401
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      try {
        res = await doFetch();
      } catch {
        throw new ApiError('NETWORK_ERROR', 'Erreur réseau');
      }
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (body?.error?.code && body?.error?.message) {
      throw new ApiError(body.error.code, body.error.message);
    }
    throw new ApiError('UNKNOWN', 'Une erreur est survenue');
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json();
  return body.data as T;
}
