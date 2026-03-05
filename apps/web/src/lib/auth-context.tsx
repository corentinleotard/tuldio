import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { AuthUser, TeamSummary, BootstrapResponse } from '@tuldio/types';
import { apiFetch } from '@/lib/api-fetch';

interface AuthContextValue {
  user: AuthUser | null;
  team: TeamSummary | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const bootstrapQuery = useQuery({
    queryKey: ['auth', 'bootstrap'],
    queryFn: () => apiFetch<BootstrapResponse>('/api/auth/bootstrap'),
    retry: false,
    staleTime: Infinity,
  });

  const signOut = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    queryClient.clear();
    navigate('/login');
  }, [queryClient, navigate]);

  return (
    <AuthContext.Provider
      value={{
        user: bootstrapQuery.data?.user ?? null,
        team: bootstrapQuery.data?.team ?? null,
        isLoading: bootstrapQuery.isLoading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
