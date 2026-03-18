import { useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-fetch';

interface InvitePayload {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  profession: string | null;
  firstName: string | null;
}

export function InviteCodePage() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: payload, isLoading, isError } = useQuery({
    queryKey: ['invite-code', code],
    queryFn: () => apiFetch<InvitePayload>(`/api/auth/invite/code/${code}`),
    enabled: !!code && !user,
    retry: false,
  });

  if (user) {
    return <Navigate to="/chat" replace />;
  }

  if (!code) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !payload) {
    return <Navigate to="/login" replace />;
  }

  async function handleActivate() {
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/auth/invite', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ce lien n'est plus valide");
    } finally {
      setLoading(false);
    }
  }

  const firstName = payload.firstName || payload.name.split(' ')[0] || '';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary">Tuldio</h1>
          <p className="mt-1 text-sm italic text-muted-foreground">Tu lui dis, c&apos;est fait.</p>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-semibold">
            {firstName ? `Bienvenue, ${firstName} !` : 'Bienvenue !'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Nous avons préparé votre espace avec les informations de votre cabinet.
          </p>
        </div>

        <div className="rounded-[14px] border border-primary/15 bg-primary-lightest p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-primary">{payload.name}</span>
          </div>
          <div className="space-y-1">
            {payload.address && (
              <p className="text-[13px]">
                <span className="text-muted-foreground">Adresse </span>
                {payload.address}
              </p>
            )}
            {payload.phone && (
              <p className="text-[13px]">
                <span className="text-muted-foreground">Tél </span>
                {payload.phone}
              </p>
            )}
            {payload.website && (
              <p className="text-[13px]">
                <span className="text-muted-foreground">Site </span>
                {payload.website}
              </p>
            )}
          </div>
        </div>

        <div>
          <Button
            className="w-full"
            onClick={handleActivate}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Commencer
          </Button>

          {error && (
            <p className="mt-3 text-center text-sm text-destructive">{error}</p>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            En continuant, vous acceptez les{' '}
            <a href="https://tuldio.fr/cgu" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              CGU
            </a>{' '}
            et la{' '}
            <a href="https://tuldio.fr/confidentialite" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              politique de confidentialité
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
