import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WithGrayBackground } from '@/components/with-gray-background';
import { Input } from '@/components/ui/input';
import { sendOtp, verifyOtp } from '../api/auth.api';

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const DEV_BYPASS_EMAILS = ['corentin@lempire.co'];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const normalized = email.trim().toLowerCase();

    try {
      await sendOtp(normalized);

      // Dev bypass: auto-verify without code entry
      if (import.meta.env.DEV && DEV_BYPASS_EMAILS.includes(normalized)) {
        await verifyOtp({ email: normalized, code: '000000' });
        await queryClient.invalidateQueries({ queryKey: ['auth'] });
        navigate('/chat');
        return;
      }

      navigate(`/verify?email=${encodeURIComponent(normalized)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WithGrayBackground>
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary">Tuldio</h1>
          <p className="mt-1 text-sm italic text-muted-foreground">
            Tu lui dis, c&apos;est fait.
          </p>
        </div>

        <div className="text-center">
          <p className="text-xl font-semibold">Connectez-vous</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Recevoir le code
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Pas de mot de passe.
          <br />
          On vous envoie un code par email.
        </p>
      </div>
    </div>
    </WithGrayBackground>
  );
}
