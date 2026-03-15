import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api-fetch';
import { Badge } from '@/components/ui/badge';

const FEATURES = [
  'Devis et factures illimites',
  'Assistant IA pour gerer ton activite',
  'Gestion clients et depenses',
  'Statistiques et suivi d\'activite',
  'PDF conformes aux normes francaises',
];

function getDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function PlanFeatures() {
  return (
    <ul className="space-y-2.5">
      {FEATURES.map((feature) => (
        <li key={feature} className="flex items-center gap-2.5 text-sm">
          <Check className="h-4 w-4 shrink-0 text-success" strokeWidth={2.5} />
          {feature}
        </li>
      ))}
    </ul>
  );
}

function SubscribeButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <>
      <button
        onClick={onClick}
        disabled={loading}
        className="flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-70 disabled:opacity-50"
      >
        {loading ? 'Redirection...' : 'S\'abonner - 49 EUR/mois'}
      </button>
      <p className="mt-3 text-center text-[13px] text-muted-foreground">
        Paiement securise par Stripe. Annulable a tout moment.
      </p>
    </>
  );
}

export function SubscriptionPage() {
  const { team } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const status = team?.subscriptionStatus ?? 'trial';
  const [daysRemaining] = useState(() => getDaysRemaining(team?.trialEndsAt ?? null));

  async function handleCheckout() {
    setLoading(true);
    try {
      const { url } = await apiFetch<{ url: string }>('/api/subscriptions/checkout', {
        method: 'POST',
      });
      window.location.href = url;
    } finally {
      setLoading(false);
    }
  }

  async function handlePortal() {
    setLoading(true);
    try {
      const { url } = await apiFetch<{ url: string }>('/api/subscriptions/portal', {
        method: 'POST',
      });
      window.location.href = url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-4 md:p-6">
      <button
        onClick={() => navigate('/settings')}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Compte
      </button>

      <h1 className="mb-6 text-[22px] font-bold tracking-tight text-primary">Abonnement</h1>

      {/* Trial state */}
      {status === 'trial' && (
        <>
          <div className="mb-4 rounded-2xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-bold">Essai gratuit</span>
              <Badge variant="success">{daysRemaining} jours restants</Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              Tu profites de toutes les fonctionnalites de Tuldio gratuitement pendant 14 jours.
            </p>

            <div className="my-4 h-px bg-border" />

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Fin de l'essai</span>
              <span className="text-sm font-semibold">{formatDate(team?.trialEndsAt ?? null)}</span>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <div className="mb-1 flex items-baseline gap-1">
              <span className="text-[28px] font-extrabold text-primary">49 EUR</span>
              <span className="text-sm text-muted-foreground">/ mois</span>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">Tout Tuldio, sans limites.</p>

            <PlanFeatures />

            <div className="mt-5">
              <SubscribeButton loading={loading} onClick={handleCheckout} />
            </div>
          </div>
        </>
      )}

      {/* Expired / Cancelled state */}
      {(status === 'expired' || status === 'cancelled') && (
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-lg font-bold">Essai termine</span>
            <Badge variant="destructive">Expire</Badge>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            Ton essai gratuit est termine. Abonne-toi pour retrouver l'acces a Tuldio.
          </p>

          <div className="my-4 h-px bg-border" />

          <div className="mb-4 flex items-baseline gap-1">
            <span className="text-[28px] font-extrabold text-primary">49 EUR</span>
            <span className="text-sm text-muted-foreground">/ mois</span>
          </div>

          <PlanFeatures />

          <div className="mt-5">
            <SubscribeButton loading={loading} onClick={handleCheckout} />
          </div>
        </div>
      )}

      {/* Active state */}
      {status === 'active' && (
        <>
          <div className="mb-4 rounded-2xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-bold">Tuldio Pro</span>
              <Badge variant="success">Actif</Badge>
            </div>

            <div className="mb-1 flex items-baseline gap-1">
              <span className="text-[28px] font-extrabold text-primary">49 EUR</span>
              <span className="text-sm text-muted-foreground">/ mois</span>
            </div>

            <div className="my-4 h-px bg-border" />

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Prochain paiement</span>
              <span className="text-sm font-semibold">
                {formatDate(team?.subscriptionPeriodEnd ?? null)}
              </span>
            </div>
          </div>

          <button
            onClick={handlePortal}
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl border bg-card py-3.5 text-[15px] font-semibold transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {loading ? 'Redirection...' : 'Gerer mon abonnement'}
          </button>
          <p className="mt-3 text-center text-[13px] text-muted-foreground">
            Modifier le paiement, telecharger les factures, ou annuler.
          </p>
        </>
      )}
    </div>
  );
}
