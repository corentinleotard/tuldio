import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { verifyOtp } from '../api/auth.api';

export function VerifyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await verifyOtp({ email, code: code.trim() });
      await queryClient.invalidateQueries({ queryKey: ['auth'] });
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setLoading(false);
    }
  }

  if (!email) {
    navigate('/login');
    return null;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className="h-2 w-6 rounded-full bg-primary" />
          <div className="h-2 w-2 rounded-full bg-secondary" />
          <div className="h-2 w-2 rounded-full bg-secondary" />
        </div>

        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary">Tuldio</h1>
          <p className="mt-1 text-sm italic text-muted-foreground">
            Tu lui dis, c&apos;est fait.
          </p>
        </div>

        <div className="text-center">
          <p className="text-xl font-semibold">Entrez le code</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Envoye a {email}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <OtpInput value={code} onChange={setCode} disabled={loading} />

          {error && <p className="text-center text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verifier
          </Button>

          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => navigate('/login')}
          >
            Renvoyer le code
          </button>
        </form>
      </div>
    </div>
  );
}
